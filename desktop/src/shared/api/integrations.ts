import { del, get, patch, post, put } from "../lib/request";

export type IntegrationProviderCode = "wecom" | "lark" | "dingtalk";

export type IntegrationProviderSummary = {
  code: IntegrationProviderCode;
  label: string;
  enabled: boolean;
  implemented: boolean;
};

export type IntegrationInstanceRecord = {
  id: string;
  provider: IntegrationProviderCode;
  name: string;
  externalTenantId: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  capabilities?: IntegrationCapabilityRecord[];
};

export type IntegrationCapabilityRecord = {
  id: string;
  instanceId: string;
  provider: IntegrationProviderCode;
  type: string;
  name: string;
  enabled: boolean;
  knowledgeBaseId: string | null;
  config: Record<string, unknown>;
  runtime: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type IntegrationCapabilityStatus = {
  enabled: boolean;
  status: "idle" | "connecting" | "connected" | "stopped" | "error";
  botId: string;
  hasSecret: boolean;
  lastError: string | null;
  lastConnectedAt: string | null;
};

export type IntegrationInstancePayload = {
  provider: IntegrationProviderCode;
  name?: string;
  externalTenantId?: string | null;
  config?: Record<string, unknown>;
  enabled?: boolean;
  isDefault?: boolean;
};

export type IntegrationCapabilityPayload = {
  instanceId: string;
  provider: IntegrationProviderCode;
  type: string;
  name?: string;
  enabled?: boolean;
  knowledgeBaseId?: string | null;
  config?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
  isDefault?: boolean;
};

export function getIntegrationProviders() {
  return get<{ providers: IntegrationProviderSummary[] }>("/integrations/providers");
}

export function getIntegrationInstances(params?: {
  provider?: IntegrationProviderCode;
  includeCapabilities?: boolean;
}) {
  const search = new URLSearchParams();
  if (params?.provider) {
    search.set("provider", params.provider);
  }
  if (params?.includeCapabilities) {
    search.set("includeCapabilities", "true");
  }

  const query = search.toString();
  return get<{ instances: IntegrationInstanceRecord[] }>(
    `/integrations/instances${query ? `?${query}` : ""}`,
  );
}

export function getIntegrationCapabilities(params?: {
  provider?: IntegrationProviderCode;
  instanceId?: string;
}) {
  const search = new URLSearchParams();
  if (params?.provider) {
    search.set("provider", params.provider);
  }
  if (params?.instanceId) {
    search.set("instanceId", params.instanceId);
  }

  const query = search.toString();
  return get<{ capabilities: IntegrationCapabilityRecord[] }>(
    `/integrations/capabilities${query ? `?${query}` : ""}`,
  );
}

export function createIntegrationInstance(payload: IntegrationInstancePayload) {
  return post<{ instance: IntegrationInstanceRecord }>(
    "/integrations/instances",
    payload,
  );
}

export function updateIntegrationInstance(
  id: string,
  payload: Partial<IntegrationInstancePayload>,
) {
  return patch<{ instance: IntegrationInstanceRecord }>(
    `/integrations/instances/${id}`,
    payload,
  );
}

export function createIntegrationCapability(payload: IntegrationCapabilityPayload) {
  return post<{ capability: IntegrationCapabilityRecord }>(
    "/integrations/capabilities",
    payload,
  );
}

export function updateIntegrationCapability(
  id: string,
  payload: Partial<IntegrationCapabilityPayload>,
) {
  return patch<{ capability: IntegrationCapabilityRecord }>(
    `/integrations/capabilities/${id}`,
    payload,
  );
}

export function deleteIntegrationCapability(id: string) {
  return del<{ deleted: boolean }>(`/integrations/capabilities/${id}`);
}

export function getIntegrationCapabilityStatus(id: string) {
  return get<IntegrationCapabilityStatus>(`/integrations/capabilities/${id}/status`);
}

export function startIntegrationCapability(id: string) {
  return post<IntegrationCapabilityStatus>(`/integrations/capabilities/${id}/start`);
}

export function stopIntegrationCapability(id: string) {
  return post<IntegrationCapabilityStatus>(`/integrations/capabilities/${id}/stop`);
}

export function getWecomIntegrationStatus() {
  return get<{
    config: {
      corpId: string;
      agentId: string;
      hasAppSecret: boolean;
      hasContactsSecret: boolean;
      hasRobotWebhook: boolean;
      hasSmartRobot: boolean;
    };
    smartRobotKnowledgeBaseId: string | null;
    smartRobot: IntegrationCapabilityStatus;
    binding: {
      bound: boolean;
      externalUserId?: string;
      externalUnionId?: string | null;
      bindSource?: "manual" | "oauth";
    };
  }>("/integrations/wecom/status");
}

export function sendWecomRobotTestMessage(input: {
  title?: string;
  content: string;
  mentionAll?: boolean;
  mentionedUserIds?: string[];
  format?: "markdown" | "text";
}) {
  return post<{
    success: boolean;
    target: string;
    summary: string;
  }>("/integrations/wecom/test/send-message", input);
}

export function sendWecomRobotCapabilityTestMessage(
  capabilityId: string,
  input: {
    title?: string;
    content: string;
    mentionAll?: boolean;
    mentionedUserIds?: string[];
    format?: "markdown" | "text";
  },
) {
  return post<{
    success: boolean;
    target: string;
    summary: string;
  }>(`/integrations/wecom/capabilities/${capabilityId}/test/send-message`, input);
}
