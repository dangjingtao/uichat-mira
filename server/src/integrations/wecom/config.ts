import { integrationCapabilitiesRepository } from "@/db/repositories/integration-capabilities.repository.js";
import { integrationInstancesRepository } from "@/db/repositories/integration-instances.repository.js";
import { wecomSettingsRepository } from "@/db/repositories/wecom-settings.repository.js";

export type ResolvedWecomConfig = {
  corpId: string;
  agentId: string;
  appSecret: string;
  contactsSecret: string;
  robotWebhookUrl: string;
  robotWebhookSecret: string;
  smartRobotBotId: string;
  smartRobotSecret: string;
  smartRobotKnowledgeBaseId: string;
  smartRobotReplyMode: "stream" | "send";
};

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const getDefaultWecomInstance = () =>
  integrationInstancesRepository.getDefault("wecom");

const getDefaultWecomCapabilityConfig = (
  type: "wecom.webhook_robot" | "wecom.smart_robot",
) => {
  const instance = getDefaultWecomInstance();
  if (!instance) {
    return null;
  }

  const capability = integrationCapabilitiesRepository
    .listByInstance(instance.id)
    .find((item) => item.type === type);

  return capability ?? null;
};

export const resolveWecomConfig = (): ResolvedWecomConfig => {
  const instance = getDefaultWecomInstance();
  const webhookCapability = getDefaultWecomCapabilityConfig("wecom.webhook_robot");
  const smartRobotCapability = getDefaultWecomCapabilityConfig("wecom.smart_robot");
  const stored = wecomSettingsRepository.get();
  const instanceConfig = (instance?.config ?? {}) as Record<string, unknown>;
  const webhookConfig = (webhookCapability?.config ?? {}) as Record<string, unknown>;
  const smartRobotConfig = (smartRobotCapability?.config ?? {}) as Record<
    string,
    unknown
  >;

  return {
    corpId:
      normalizeString(instanceConfig.corpId) ||
      stored.corpId ||
      process.env.WECOM_CORP_ID?.trim() ||
      "",
    agentId:
      normalizeString(instanceConfig.agentId) ||
      stored.agentId ||
      process.env.WECOM_AGENT_ID?.trim() ||
      "",
    appSecret:
      normalizeString(instanceConfig.appSecret) ||
      stored.appSecret ||
      process.env.WECOM_APP_SECRET?.trim() ||
      "",
    contactsSecret:
      normalizeString(instanceConfig.contactsSecret) ||
      stored.contactsSecret ||
      process.env.WECOM_CONTACTS_SECRET?.trim() ||
      "",
    robotWebhookUrl:
      normalizeString(webhookConfig.webhookUrl) ||
      stored.robotWebhookUrl ||
      process.env.WECOM_ROBOT_WEBHOOK_URL?.trim() ||
      "",
    robotWebhookSecret:
      normalizeString(webhookConfig.webhookSecret) ||
      stored.robotWebhookSecret ||
      process.env.WECOM_ROBOT_WEBHOOK_SECRET?.trim() ||
      "",
    smartRobotBotId:
      normalizeString(smartRobotConfig.botId) ||
      stored.smartRobotBotId ||
      process.env.WECOM_SMART_ROBOT_BOT_ID?.trim() ||
      "",
    smartRobotSecret:
      normalizeString(smartRobotConfig.secret) ||
      stored.smartRobotSecret ||
      process.env.WECOM_SMART_ROBOT_SECRET?.trim() ||
      "",
    smartRobotKnowledgeBaseId:
      normalizeString(smartRobotCapability?.knowledgeBaseId) ||
      normalizeString(smartRobotConfig.knowledgeBaseId) ||
      stored.smartRobotKnowledgeBaseId ||
      process.env.WECOM_SMART_ROBOT_KNOWLEDGE_BASE_ID?.trim() ||
      "",
    smartRobotReplyMode:
      process.env.WECOM_SMART_ROBOT_REPLY_MODE?.trim() === "send"
        ? "send"
        : smartRobotConfig.replyMode === "send"
          ? "send"
          : stored.smartRobotReplyMode,
  };
};

export const hasWecomAppConfig = () => {
  const config = resolveWecomConfig();
  return Boolean(config.corpId && config.agentId && config.appSecret);
};

export const hasWecomContactsConfig = () => {
  const config = resolveWecomConfig();
  return Boolean(config.corpId && config.contactsSecret);
};

export const hasWecomRobotConfig = () => {
  const config = resolveWecomConfig();
  return Boolean(config.robotWebhookUrl);
};

export const hasWecomSmartRobotConfig = () => {
  const config = resolveWecomConfig();
  return Boolean(config.smartRobotBotId && config.smartRobotSecret);
};

export const resolveWecomSmartRobotKnowledgeBaseId = () => {
  const config = resolveWecomConfig();
  return config.smartRobotKnowledgeBaseId.trim() || null;
};
