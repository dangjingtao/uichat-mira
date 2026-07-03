import { get, post, put, del } from "../lib/request";

export type WecomIntegrationStatus = {
  config: {
    corpId: string;
    agentId: string;
    hasAppSecret: boolean;
    hasContactsSecret: boolean;
    hasRobotWebhook: boolean;
    hasSmartRobot: boolean;
  };
  smartRobotKnowledgeBaseId: string | null;
  smartRobot: {
    enabled: boolean;
    status: "idle" | "connecting" | "connected" | "stopped" | "error";
    botId: string;
    hasSecret: boolean;
    lastError: string | null;
    lastConnectedAt: string | null;
  };
  binding: {
    bound: boolean;
    externalUserId?: string;
    externalUnionId?: string | null;
    bindSource?: "manual" | "oauth";
  };
};

export type WecomOAuthStartResponse = {
  authorizeUrl: string;
  ticket: string;
};

export type WecomOAuthPollResponse = {
  status: "pending" | "ready";
  ticket: string;
  userid?: string | null;
  externalUnionId?: string | null;
  bindSource?: "oauth";
};

export type WecomManualBindPayload = {
  externalUserId: string;
  externalUnionId?: string;
  bindSource?: "manual" | "oauth";
};

export type WecomConfigPayload = {
  corpId?: string;
  agentId?: string;
  appSecret?: string;
  contactsSecret?: string;
  robotWebhookUrl?: string;
  robotWebhookSecret?: string;
  smartRobotBotId?: string;
  smartRobotSecret?: string;
  smartRobotKnowledgeBaseId?: string;
  smartRobotReplyMode?: "stream" | "send";
};

export function getWecomIntegrationStatus() {
  return get<WecomIntegrationStatus>("/integrations/wecom/status");
}

export function getWecomBindingMe() {
  return get<WecomIntegrationStatus["binding"]>("/integrations/wecom/bind/me");
}

export function bindWecomUserManually(input: WecomManualBindPayload) {
  return post<WecomIntegrationStatus["binding"]>("/integrations/wecom/bind/manual", input);
}

export function startWecomOAuthBinding() {
  return post<WecomOAuthStartResponse>("/integrations/wecom/bind/oauth/start");
}

export function pollWecomOAuthBinding(ticket: string) {
  return post<WecomOAuthPollResponse>("/integrations/wecom/bind/oauth/poll", { ticket });
}

export function unbindWecomUser() {
  return del<{ deleted: boolean }>("/integrations/wecom/bind/me");
}

export function getWecomConfig() {
  return get<{
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
  }>("/mcp/wecom/config");
}

export function updateWecomConfig(input: WecomConfigPayload) {
  return put<{
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
  }>("/mcp/wecom/config", input);
}

export type WecomSmartRobotConfigPayload = {
  smartRobotBotId?: string;
  smartRobotSecret?: string;
};

export type WecomRobotTestMessagePayload = {
  title?: string;
  content: string;
  mentionAll?: boolean;
  mentionedUserIds?: string[];
  format?: "markdown" | "text";
};

export function sendWecomRobotTestMessage(input: WecomRobotTestMessagePayload) {
  return post<{
    success: boolean;
    target: string;
    summary: string;
  }>("/integrations/wecom/test/send-message", input);
}

export function getWecomSmartRobotStatus() {
  return get<WecomIntegrationStatus["smartRobot"]>("/integrations/wecom/smart-robot/status");
}

export function startWecomSmartRobot() {
  return post<WecomIntegrationStatus["smartRobot"]>("/integrations/wecom/smart-robot/start");
}

export function stopWecomSmartRobot() {
  return post<WecomIntegrationStatus["smartRobot"]>("/integrations/wecom/smart-robot/stop");
}
