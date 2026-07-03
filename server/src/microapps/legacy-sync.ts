import { integrationCapabilitiesRepository } from "@/db/repositories/integration-capabilities.repository.js";
import { integrationCapabilityMicroAppsRepository } from "@/db/repositories/integration-capability-micro-apps.repository.js";
import { microAppsRepository } from "@/db/repositories/micro-apps.repository.js";
import { getSqlite } from "@/db/index.js";

type LegacyBindingRow = {
  capability_id: string;
  micro_app_id: string;
};

type LegacyMicroAppRow = {
  id: string;
  type: string;
  knowledge_base_id: string | null;
};

const getKnowledgeBaseIdFromCapability = (capabilityId: string) => {
  const capability = integrationCapabilitiesRepository.getById(capabilityId);
  if (!capability) {
    return null;
  }

  const config = capability.config as Record<string, unknown>;
  const configKnowledgeBaseId =
    typeof config.knowledgeBaseId === "string" ? config.knowledgeBaseId.trim() : "";

  return capability.knowledgeBaseId?.trim() || configKnowledgeBaseId || null;
};

const getKnowledgeBaseIdFromSiblingLegacyCapability = (capabilityId: string) => {
  const capability = integrationCapabilitiesRepository.getById(capabilityId);
  if (!capability) {
    return null;
  }

  const sibling = integrationCapabilitiesRepository
    .listByInstance(capability.instanceId)
    .find((item) => item.type === "wecom.knowledge_query");

  if (!sibling) {
    return null;
  }

  return sibling.knowledgeBaseId?.trim() || null;
};

const getLegacyBindingMaps = () => {
  const sqlite = getSqlite();
  const hasLegacyBindingTable = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='integration_capability_micro_apps'",
    )
    .get();
  const hasLegacyMicroAppsTable = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='micro_apps'",
    )
    .get();

  const legacyBindings = hasLegacyBindingTable
    ? (sqlite
        .prepare(
          "SELECT capability_id, micro_app_id FROM integration_capability_micro_apps",
        )
        .all() as LegacyBindingRow[])
    : [];
  const legacyMicroApps = hasLegacyMicroAppsTable
    ? (sqlite
        .prepare(
          "SELECT id, type, knowledge_base_id FROM micro_apps",
        )
        .all() as LegacyMicroAppRow[])
    : [];

  return {
    bindingByCapabilityId: new Map(
      legacyBindings.map((item) => [item.capability_id, item.micro_app_id]),
    ),
    legacyMicroAppById: new Map(legacyMicroApps.map((item) => [item.id, item])),
  };
};

const resolveLegacyKnowledgeBaseIdForCapability = (
  capabilityId: string,
  bindingByCapabilityId: Map<string, string>,
  legacyMicroAppById: Map<string, LegacyMicroAppRow>,
) => {
  const legacyMicroAppId = bindingByCapabilityId.get(capabilityId);
  if (legacyMicroAppId) {
    const legacyMicroApp = legacyMicroAppById.get(legacyMicroAppId);
    const knowledgeBaseId = legacyMicroApp?.knowledge_base_id?.trim() || null;
    if (knowledgeBaseId) {
      return knowledgeBaseId;
    }
  }

  return (
    getKnowledgeBaseIdFromCapability(capabilityId) ??
    getKnowledgeBaseIdFromSiblingLegacyCapability(capabilityId)
  );
};

export const ensureMicroAppBindingForCapability = (capabilityId: string) => {
  const capability = integrationCapabilitiesRepository.getById(capabilityId);
  if (!capability || capability.type !== "wecom.smart_robot") {
    return null;
  }

  const definition = microAppsRepository.getByType("knowledge_query");
  if (!definition) {
    return null;
  }

  const existing = integrationCapabilityMicroAppsRepository.getByCapabilityId(
    capabilityId,
  );
  if (existing) {
    return existing;
  }

  const { bindingByCapabilityId, legacyMicroAppById } = getLegacyBindingMaps();
  const knowledgeBaseId = resolveLegacyKnowledgeBaseIdForCapability(
    capabilityId,
    bindingByCapabilityId,
    legacyMicroAppById,
  );

  if (!knowledgeBaseId) {
    return null;
  }

  return integrationCapabilityMicroAppsRepository.bind(capabilityId, {
    microAppDefinitionId: definition.id,
    enabled: capability.enabled,
    config: {
      knowledgeBaseId,
    },
  });
};

export const migrateLegacyMicroAppBindings = () => {
  const definition = microAppsRepository.getByType("knowledge_query");
  if (!definition) {
    return;
  }

  const { bindingByCapabilityId, legacyMicroAppById } = getLegacyBindingMaps();
  const smartRobotCapabilities = integrationCapabilitiesRepository
    .listAll()
    .filter((item) => item.type === "wecom.smart_robot");

  for (const capability of smartRobotCapabilities) {
    const existing = integrationCapabilityMicroAppsRepository.getByCapabilityId(
      capability.id,
    );
    if (existing) {
      continue;
    }

    const knowledgeBaseId = resolveLegacyKnowledgeBaseIdForCapability(
      capability.id,
      bindingByCapabilityId,
      legacyMicroAppById,
    );
    if (!knowledgeBaseId) {
      continue;
    }

    integrationCapabilityMicroAppsRepository.bind(capability.id, {
      microAppDefinitionId: definition.id,
      enabled: capability.enabled,
      config: {
        knowledgeBaseId,
      },
    });
  }
};
