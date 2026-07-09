import { integrationCapabilitiesRepository } from "@/db/repositories/integration-capabilities.repository.js";
import { integrationCapabilityMicroAppsRepository } from "@/db/repositories/integration-capability-micro-apps.repository.js";
import { microAppsRepository } from "@/db/repositories/micro-apps.repository.js";
import { writeStructuredLog } from "@/logger";
import { mcpBadRequest } from "@/mcp/core/errors.js";
import {
  ensureMicroAppBindingForCapability,
  migrateLegacyMicroAppBindings,
} from "./legacy-sync.js";
import { computerUseMicroApp } from "./apps/computer-use.microapp.js";
import { imageGenerationMicroApp } from "./apps/image-generation.microapp.js";
import { knowledgeQueryMicroApp } from "./apps/knowledge-query.microapp.js";
import { newsHubMicroApp } from "./apps/news-hub.microapp.js";
import { ttsMicroApp } from "./apps/tts.microapp.js";
import type {
  MicroAppDefinition,
  MicroAppInvokeRequest,
  MicroAppInvokeResponse,
} from "./types.js";

const definitions = new Map<string, MicroAppDefinition>([
  [knowledgeQueryMicroApp.type, knowledgeQueryMicroApp],
  [newsHubMicroApp.type, newsHubMicroApp],
  [imageGenerationMicroApp.type, imageGenerationMicroApp],
  [computerUseMicroApp.type, computerUseMicroApp],
  [ttsMicroApp.type, ttsMicroApp],
]);

const getDefinition = (type: string) => definitions.get(type) ?? null;

export const supportsMicroAppBinding = (
  capabilityType: string,
  microAppType: string,
) => {
  const definition = getDefinition(microAppType);
  if (!definition) {
    return false;
  }

  return definition.supportedAccessPoints.includes(capabilityType as never);
};

export const microAppRuntime = {
  getDefinition,

  async resolveBoundMicroApp(capabilityId: string) {
    const explicitBinding =
      integrationCapabilityMicroAppsRepository.getByCapabilityId(capabilityId);
    if (explicitBinding) {
      const microApp = microAppsRepository.getById(
        explicitBinding.microAppDefinitionId,
      );
      if (microApp) {
        return { binding: explicitBinding, microApp };
      }
    }

    const ensured = ensureMicroAppBindingForCapability(capabilityId);
    if (!ensured) {
      return null;
    }

    const microApp = microAppsRepository.getById(ensured.microAppDefinitionId);
    if (!microApp) {
      return null;
    }

    return { binding: ensured, microApp };
  },

  migrateLegacyBindings() {
    migrateLegacyMicroAppBindings();
  },

  async invokeForCapability(
    capabilityId: string,
    request: Omit<MicroAppInvokeRequest, "microAppId">,
  ): Promise<MicroAppInvokeResponse> {
    const capability = integrationCapabilitiesRepository.getById(capabilityId);
    if (!capability) {
      throw mcpBadRequest(`Integration capability not found: ${capabilityId}`);
    }

    const resolved = await this.resolveBoundMicroApp(capabilityId);
    if (!resolved) {
      throw mcpBadRequest(`No MicroAPP is bound to capability: ${capabilityId}`);
    }
    const { binding, microApp } = resolved;

    const definition = getDefinition(microApp.type);
    if (!definition) {
      throw mcpBadRequest(`Unsupported MicroAPP type: ${microApp.type}`);
    }

    if (!microApp.enabled || !binding.enabled) {
      throw mcpBadRequest(`MicroAPP is disabled: ${microApp.id}`);
    }

    if (!supportsMicroAppBinding(capability.type, microApp.type)) {
      throw mcpBadRequest(
        `MicroAPP "${microApp.type}" does not support capability "${capability.type}"`,
      );
    }

    writeStructuredLog("info", {
      msg: "MicroAPP invoke requested",
      capabilityId,
      microAppId: microApp.id,
      microAppType: microApp.type,
      accessPointType: capability.type,
    });

    return definition.invoke(microApp, binding, {
      ...request,
      microAppId: microApp.id,
    });
  },
};
