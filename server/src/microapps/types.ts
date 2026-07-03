import type { IntegrationCapabilityType } from "@/db/repositories/integration-capabilities.repository.js";
import type { IntegrationProvider } from "@/db/repositories/integration-instances.repository.js";
import type { IntegrationCapabilityMicroAppBindingRecord } from "@/db/repositories/integration-capability-micro-apps.repository.js";
import type { MicroAppRecord, MicroAppType } from "@/db/repositories/micro-apps.repository.js";

export type MicroAppSupportedAccessPoint = Extract<
  IntegrationCapabilityType,
  "wecom.smart_robot"
>;

export type IntegrationConversationKind = "direct" | "group";

export type MicroAppInvokeRequest = {
  provider: IntegrationProvider;
  accessPointType: MicroAppSupportedAccessPoint;
  instanceId: string;
  accessPointId: string;
  microAppId: string;
  messageId?: string;
  conversation: {
    id: string;
    kind: IntegrationConversationKind;
  };
  sender: {
    externalUserId: string;
    displayName?: string;
  };
  text?: string;
  mentions?: string[];
  attachments?: Array<{
    type: "image" | "file" | "link";
    name?: string;
    url?: string;
  }>;
  context?: {
    receivedAt: string;
    rawProviderEventType?: string;
  };
};

export type MicroAppInvokeResponse = {
  mode: "reply" | "no_reply" | "error";
  message?: {
    type: "text" | "markdown";
    content: string;
  };
  errorCode?: string;
  errorMessage?: string;
  meta?: Record<string, unknown>;
};

export type MicroAppDefinition = {
  type: MicroAppType;
  label: string;
  supportedAccessPoints: MicroAppSupportedAccessPoint[];
  description: string;
  runtimeKey: string;
  bindingSchema: MicroAppRecord["bindingSchema"];
  invoke: (
    microApp: MicroAppRecord,
    binding: IntegrationCapabilityMicroAppBindingRecord,
    request: MicroAppInvokeRequest,
  ) => Promise<MicroAppInvokeResponse>;
};
