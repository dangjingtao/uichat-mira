import { integrationCapabilitiesRepository } from "@/db/repositories/integration-capabilities.repository.js";
import { integrationInstancesRepository } from "@/db/repositories/integration-instances.repository.js";
import { mcpBadRequest, mcpInternalError } from "@/mcp/core/errors.js";
import { writeStructuredLog } from "@/logger";
import { microAppRuntime } from "@/microapps/runtime.js";
import { resolveWecomConfig } from "./config.js";

export type SmartRobotConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "stopped"
  | "error";

export type SmartRobotStatus = {
  enabled: boolean;
  status: SmartRobotConnectionStatus;
  botId: string;
  hasSecret: boolean;
  lastError: string | null;
  lastConnectedAt: string | null;
};

type SmartRobotClient = {
  connect: () => unknown;
  disconnect: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  reply: (frame: unknown, body: Record<string, unknown>) => Promise<unknown>;
  replyStream?: (
    frame: unknown,
    streamId: string,
    content: string,
    finish?: boolean,
  ) => Promise<unknown>;
  generateReqId?: (prefix: string) => string;
  isConnected?: boolean;
  sendMessage?: (
    chatid: string,
    body: Record<string, unknown>,
  ) => Promise<unknown>;
};

type SmartRobotRuntimeEntry = {
  capabilityId: string;
  client: SmartRobotClient | null;
  status: SmartRobotConnectionStatus;
  lastError: string | null;
  lastConnectedAt: string | null;
};

type SmartRobotResolvedCapability = {
  capabilityId: string;
  botId: string;
  secret: string;
  replyMode: "stream" | "send";
};

const runtimeEntries = new Map<string, SmartRobotRuntimeEntry>();

const loadSdk = async () => {
  const sdk = await import("@wecom/aibot-node-sdk");
  return (sdk.default ?? sdk) as {
    WSClient: new (options: { botId: string; secret: string }) => SmartRobotClient;
    generateReqId?: (prefix: string) => string;
  };
};

const normalizeIncomingText = (frame: unknown) => {
  const body = (frame as {
    body?: {
      text?: { content?: string };
      mixed?: {
        msg_item?: Array<{ msgtype?: string; text?: { content?: string } }>;
      };
    };
  })?.body;

  const textContent = body?.text?.content?.trim();
  if (textContent) {
    return textContent;
  }

  const mixedText = body?.mixed?.msg_item
    ?.filter((item) => item.msgtype === "text")
    .map((item) => item.text?.content?.trim() ?? "")
    .filter(Boolean)
    .join("")
    .trim();

  return mixedText ?? "";
};

const getIncomingMeta = (frame: unknown) => {
  const body = frame as {
    body?: {
      msgtype?: string;
      chatid?: string;
      chattype?: string;
      from?: { userid?: string };
      event?: { eventtype?: string };
    };
  };

  return {
    msgtype: body.body?.msgtype ?? null,
    chatid: body.body?.chatid ?? null,
    chattype: body.body?.chattype ?? null,
    fromUserId: body.body?.from?.userid ?? null,
    eventType: body.body?.event?.eventtype ?? null,
  };
};

const getFrameChatId = (frame: unknown) =>
  ((frame as { body?: { chatid?: string } })?.body?.chatid ?? "").trim();

const normalizeSmartRobotQuestion = (question: string) =>
  question.replace(/^@[\p{L}\p{N}_-]+/u, "").replace(/^@[^\s]+\s*/u, "").trim();

const previewText = (value: string, limit = 800) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit)}...`;
};

const extractIncomingPreview = (frame: unknown) => {
  const body = (frame as {
    body?: {
      msgtype?: string;
      text?: { content?: string };
      voice?: { content?: string };
      mixed?: {
        msg_item?: Array<{ msgtype?: string; text?: { content?: string } }>;
      };
      quote?: {
        msgtype?: string;
        text?: { content?: string };
      };
    };
  })?.body;

  const text = body?.text?.content?.trim();
  if (text) {
    return text;
  }

  const voice = body?.voice?.content?.trim();
  if (voice) {
    return `[voice] ${voice}`;
  }

  const mixed = body?.mixed?.msg_item
    ?.map((item) =>
      item.msgtype === "text" ? item.text?.content?.trim() ?? "" : `[${item.msgtype ?? "unknown"}]`,
    )
    .filter(Boolean)
    .join(" ")
    .trim();
  if (mixed) {
    return mixed;
  }

  const quoted = body?.quote?.text?.content?.trim();
  if (quoted) {
    return `[quote:${body?.quote?.msgtype ?? "unknown"}] ${quoted}`;
  }

  return "";
};

const getDefaultSmartRobotCapability = () => {
  const defaultInstance = integrationInstancesRepository.getDefault("wecom");
  if (!defaultInstance) {
    return null;
  }

  return (
    integrationCapabilitiesRepository
      .listByInstance(defaultInstance.id)
      .find((item) => item.type === "wecom.smart_robot") ?? null
  );
};

const resolveCapabilityConfig = (
  capabilityId: string,
): SmartRobotResolvedCapability | null => {
  const capability = integrationCapabilitiesRepository.getById(capabilityId);
  if (!capability || capability.type !== "wecom.smart_robot") {
    return null;
  }

  const config = capability.config as Record<string, unknown>;
  const botId = typeof config.botId === "string" ? config.botId.trim() : "";
  const secret = typeof config.secret === "string" ? config.secret.trim() : "";
  const replyMode = config.replyMode === "send" ? "send" : "stream";

  return {
    capabilityId: capability.id,
    botId,
    secret,
    replyMode,
  };
};

const resolveDefaultCapabilityConfig = (): SmartRobotResolvedCapability | null => {
  const capability = getDefaultSmartRobotCapability();
  if (!capability) {
    return null;
  }

  return resolveCapabilityConfig(capability.id);
};

const getOrCreateRuntimeEntry = (capabilityId: string) => {
  const existing = runtimeEntries.get(capabilityId);
  if (existing) {
    return existing;
  }

  const entry: SmartRobotRuntimeEntry = {
    capabilityId,
    client: null,
    status: "idle",
    lastError: null,
    lastConnectedAt: null,
  };
  runtimeEntries.set(capabilityId, entry);
  return entry;
};

const buildStatusFromCapability = (
  capability: SmartRobotResolvedCapability | null,
  entry?: SmartRobotRuntimeEntry | null,
): SmartRobotStatus => ({
  enabled: Boolean(capability?.botId && capability.secret),
  status: entry?.status ?? "idle",
  botId: capability?.botId ?? "",
  hasSecret: Boolean(capability?.secret),
  lastError: entry?.lastError ?? null,
  lastConnectedAt: entry?.lastConnectedAt ?? null,
});

const setEntryStatus = (
  entry: SmartRobotRuntimeEntry,
  capability: SmartRobotResolvedCapability | null,
  patch: Partial<SmartRobotRuntimeEntry>,
) => {
  entry.status = patch.status ?? entry.status;
  entry.lastError =
    patch.lastError === undefined ? entry.lastError : patch.lastError;
  entry.lastConnectedAt =
    patch.lastConnectedAt === undefined
      ? entry.lastConnectedAt
      : patch.lastConnectedAt;

  return buildStatusFromCapability(capability, entry);
};

const replyToFrame = async (
  entry: SmartRobotRuntimeEntry,
  capability: SmartRobotResolvedCapability,
  frame: unknown,
  content: string,
) => {
  const client = entry.client;
  if (!client) {
    throw new Error("WeCom smart robot client is not connected");
  }

  const meta = getIncomingMeta(frame);
  writeStructuredLog("info", {
    msg: "WeCom smart robot preparing reply",
    capabilityId: capability.capabilityId,
    replyMode: capability.replyMode,
    answerLength: Array.from(content).length,
    answerPreview: previewText(content),
    ...meta,
  });

  if (capability.replyMode === "send") {
    const chatId = getFrameChatId(frame);
    if (!chatId) {
      throw new Error("WeCom smart robot chatid is missing for send mode");
    }
    if (typeof client.sendMessage !== "function") {
      throw new Error("WeCom smart robot client does not support sendMessage");
    }

    await client.sendMessage(chatId, {
      msgtype: "markdown",
      markdown: { content },
    });
    writeStructuredLog("info", {
      msg: "WeCom smart robot send reply dispatched",
      capabilityId: capability.capabilityId,
      replyMode: capability.replyMode,
      answerLength: Array.from(content).length,
      answerPreview: previewText(content),
      ...meta,
    });
    return;
  }

  const streamId =
    typeof client.generateReqId === "function"
      ? client.generateReqId("stream")
      : `stream_${Date.now()}`;

  if (typeof client.replyStream !== "function") {
    throw new Error("WeCom smart robot client does not support replyStream");
  }

  await client.replyStream(frame, streamId, content, true);
  writeStructuredLog("info", {
    msg: "WeCom smart robot stream reply dispatched",
    capabilityId: capability.capabilityId,
    replyMode: capability.replyMode,
    streamId,
    answerLength: Array.from(content).length,
    answerPreview: previewText(content),
    ...meta,
  });
};

const registerRuntimeHandlers = (
  entry: SmartRobotRuntimeEntry,
  capability: SmartRobotResolvedCapability,
  client: SmartRobotClient,
) => {
  client.on("authenticated", () => {
    writeStructuredLog("info", {
      msg: "WeCom smart robot authenticated",
      capabilityId: capability.capabilityId,
      botId: capability.botId,
    });
    setEntryStatus(entry, capability, {
      status: "connected",
      lastError: null,
      lastConnectedAt: new Date().toISOString(),
    });
  });

  client.on("connected", () => {
    writeStructuredLog("info", {
      msg: "WeCom smart robot websocket connected",
      capabilityId: capability.capabilityId,
      botId: capability.botId,
    });
  });

  client.on("disconnected", (reason: unknown) => {
    writeStructuredLog("warn", {
      msg: "WeCom smart robot disconnected",
      capabilityId: capability.capabilityId,
      reason: typeof reason === "string" ? reason : String(reason),
    });
    setEntryStatus(entry, capability, {
      status: "stopped",
      lastError:
        typeof reason === "string" ? reason : "smart robot disconnected",
    });
  });

  client.on("error", (error: unknown) => {
    writeStructuredLog("error", {
      msg: "WeCom smart robot error",
      capabilityId: capability.capabilityId,
      error: error instanceof Error ? error.message : String(error),
    });
    setEntryStatus(entry, capability, {
      status: "error",
      lastError: error instanceof Error ? error.message : String(error),
    });
  });

  client.on("message", async (frame: unknown) => {
    const meta = getIncomingMeta(frame);
    writeStructuredLog("info", {
      msg: "WeCom smart robot received message frame",
      capabilityId: capability.capabilityId,
      contentPreview: previewText(extractIncomingPreview(frame) || `[${meta.msgtype ?? "unknown"}]`),
      ...meta,
    });
  });

  client.on("event", async (frame: unknown) => {
    const meta = getIncomingMeta(frame);
    writeStructuredLog("info", {
      msg: "WeCom smart robot received event frame",
      capabilityId: capability.capabilityId,
      ...meta,
    });
  });

  const handleQuestion = async (frame: unknown) => {
    const rawQuestion = normalizeIncomingText(frame);
    const question = normalizeSmartRobotQuestion(rawQuestion);
    const meta = getIncomingMeta(frame);
    writeStructuredLog("info", {
      msg: "WeCom smart robot received text message",
      capabilityId: capability.capabilityId,
      ...meta,
      question: rawQuestion,
    });
    if (!question) {
      return;
    }

    try {
      writeStructuredLog("info", {
        msg: "WeCom smart robot invoking MicroAPP",
        capabilityId: capability.capabilityId,
        ...meta,
        question,
      });
      const result = await microAppRuntime.invokeForCapability(capability.capabilityId, {
        provider: "wecom",
        accessPointType: "wecom.smart_robot",
        instanceId:
          integrationCapabilitiesRepository.getById(capability.capabilityId)?.instanceId ??
          "",
        accessPointId: capability.capabilityId,
        messageId:
          ((frame as { body?: { msgid?: string } })?.body?.msgid ?? "").trim() || undefined,
        conversation: {
          id: meta.chatid ?? "",
          kind: meta.chattype === "single" ? "direct" : "group",
        },
        sender: {
          externalUserId: meta.fromUserId ?? "",
        },
        text: question,
        context: {
          receivedAt: new Date().toISOString(),
          rawProviderEventType: meta.msgtype ?? undefined,
        },
      });
      if (result.mode === "no_reply") {
        writeStructuredLog("info", {
          msg: "WeCom smart robot MicroAPP returned no_reply",
          capabilityId: capability.capabilityId,
          ...meta,
          question,
        });
        return;
      }

      if (result.mode === "error") {
        throw new Error(result.errorMessage || "MicroAPP execution failed");
      }

      const finalAnswer = result.message?.content?.trim() || "我没有检索到可用答案。";
      writeStructuredLog("info", {
        msg: "WeCom smart robot MicroAPP completed",
        capabilityId: capability.capabilityId,
        ...meta,
        question,
        answerLength: Array.from(finalAnswer).length,
        answerPreview: previewText(finalAnswer),
        microAppMeta: result.meta ?? null,
      });
      await replyToFrame(entry, capability, frame, finalAnswer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "MicroAPP 调用失败";
      writeStructuredLog("error", {
        msg: "WeCom smart robot MicroAPP failed",
        capabilityId: capability.capabilityId,
        ...meta,
        question,
        error: errorMessage,
      });
      setEntryStatus(entry, capability, {
        status: "error",
        lastError: errorMessage,
      });
      try {
        await replyToFrame(entry, capability, frame, `MicroAPP 调用失败：${errorMessage}`);
      } catch {
        // Keep runtime error state only when reply fails too.
      }
    }
  };

  client.on("message.text", handleQuestion);
  client.on("message.mixed", handleQuestion);
  client.on("message.image", async (frame: unknown) => {
    const meta = getIncomingMeta(frame);
    writeStructuredLog("info", {
      msg: "WeCom smart robot received image message",
      capabilityId: capability.capabilityId,
      contentPreview: previewText(extractIncomingPreview(frame) || "[image]"),
      ...meta,
    });
  });
  client.on("message.voice", async (frame: unknown) => {
    const meta = getIncomingMeta(frame);
    writeStructuredLog("info", {
      msg: "WeCom smart robot received voice message",
      capabilityId: capability.capabilityId,
      contentPreview: previewText(extractIncomingPreview(frame) || "[voice]"),
      ...meta,
    });
  });
  client.on("message.file", async (frame: unknown) => {
    const meta = getIncomingMeta(frame);
    writeStructuredLog("info", {
      msg: "WeCom smart robot received file message",
      capabilityId: capability.capabilityId,
      contentPreview: "[file]",
      ...meta,
    });
  });
  client.on("message.video", async (frame: unknown) => {
    const meta = getIncomingMeta(frame);
    writeStructuredLog("info", {
      msg: "WeCom smart robot received video message",
      capabilityId: capability.capabilityId,
      contentPreview: "[video]",
      ...meta,
    });
  });
};

export const getSmartRobotStatus = (): SmartRobotStatus => {
  const capability = resolveDefaultCapabilityConfig();
  if (!capability) {
    const config = resolveWecomConfig();
    return {
      enabled: Boolean(config.smartRobotBotId && config.smartRobotSecret),
      status: "idle",
      botId: config.smartRobotBotId,
      hasSecret: Boolean(config.smartRobotSecret),
      lastError: null,
      lastConnectedAt: null,
    };
  }

  const entry = runtimeEntries.get(capability.capabilityId) ?? null;
  return buildStatusFromCapability(capability, entry);
};

export const getSmartRobotStatusByCapability = (
  capabilityId: string,
): SmartRobotStatus | null => {
  const capability = resolveCapabilityConfig(capabilityId);
  if (!capability) {
    return null;
  }

  return buildStatusFromCapability(
    capability,
    runtimeEntries.get(capability.capabilityId) ?? null,
  );
};

export const startWecomSmartRobotByCapability = async (capabilityId: string) => {
  const capability = resolveCapabilityConfig(capabilityId);
  if (!capability) {
    throw mcpBadRequest(`Smart robot capability not found: ${capabilityId}`);
  }
  if (!capability.botId || !capability.secret) {
    throw mcpBadRequest("Smart robot botId and secret are required");
  }

  const entry = getOrCreateRuntimeEntry(capabilityId);
  if (entry.client && entry.status === "connected") {
    return buildStatusFromCapability(capability, entry);
  }

  writeStructuredLog("info", {
    msg: "WeCom smart robot start requested",
    capabilityId,
    botId: capability.botId,
    hasSecret: Boolean(capability.secret),
  });

  setEntryStatus(entry, capability, {
    status: "connecting",
    lastError: null,
  });

  try {
    if (entry.client) {
      writeStructuredLog("info", {
        msg: "WeCom smart robot disposing previous client",
        capabilityId,
      });
      entry.client.disconnect();
      entry.client = null;
    }

    const sdk = await loadSdk();
    const nextClient = new sdk.WSClient({
      botId: capability.botId,
      secret: capability.secret,
    });
    if (typeof sdk.generateReqId === "function") {
      nextClient.generateReqId = sdk.generateReqId;
    }

    registerRuntimeHandlers(entry, capability, nextClient);
    entry.client = nextClient;

    writeStructuredLog("info", {
      msg: "WeCom smart robot calling connect()",
      capabilityId,
      botId: capability.botId,
    });
    nextClient.connect();
    return buildStatusFromCapability(capability, entry);
  } catch (error) {
    entry.client = null;
    setEntryStatus(entry, capability, {
      status: "error",
      lastError: error instanceof Error ? error.message : String(error),
    });
    writeStructuredLog("error", {
      msg: "WeCom smart robot start failed",
      capabilityId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw mcpInternalError(
      error instanceof Error
        ? `Failed to start WeCom smart robot: ${error.message}`
        : "Failed to start WeCom smart robot",
      { cause: error },
    );
  }
};

export const stopWecomSmartRobotByCapability = (capabilityId: string) => {
  const capability = resolveCapabilityConfig(capabilityId);
  if (!capability) {
    throw mcpBadRequest(`Smart robot capability not found: ${capabilityId}`);
  }

  const entry = getOrCreateRuntimeEntry(capabilityId);
  if (entry.client) {
    writeStructuredLog("info", {
      msg: "WeCom smart robot stop requested",
      capabilityId,
    });
    entry.client.disconnect();
    entry.client = null;
  }

  return setEntryStatus(entry, capability, {
    status: "stopped",
    lastError: null,
  });
};

export const startWecomSmartRobot = async () => {
  const capability = resolveDefaultCapabilityConfig();
  if (!capability) {
    const config = resolveWecomConfig();
    if (!config.smartRobotBotId || !config.smartRobotSecret) {
      throw mcpBadRequest("Smart robot botId and secret are required");
    }
    throw mcpBadRequest("Default WeCom smart robot capability is not configured");
  }

  return startWecomSmartRobotByCapability(capability.capabilityId);
};

export const stopWecomSmartRobot = () => {
  const capability = resolveDefaultCapabilityConfig();
  if (!capability) {
    return getSmartRobotStatus();
  }

  return stopWecomSmartRobotByCapability(capability.capabilityId);
};
