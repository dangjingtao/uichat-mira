import { mcpInternalError } from "@/mcp/core/errors.js";
import { integrationCapabilitiesRepository } from "@/db/repositories/integration-capabilities.repository.js";
import { resolveWecomConfig } from "./config.js";

type WecomRobotSendResponse = {
  errcode?: number;
  errmsg?: string;
};

const WECOM_ROBOT_BASE = "https://qyapi.weixin.qq.com/cgi-bin/webhook";

const normalizeRobotWebhookKey = (url: string) => {
  try {
    const parsed = new URL(url);
    const key = parsed.searchParams.get("key")?.trim();
    if (!key) {
      throw new Error("missing key");
    }
    return key;
  } catch {
    throw mcpInternalError("WeCom robot webhook url is invalid.");
  }
};

const assertRobotSuccess = (response: WecomRobotSendResponse) => {
  if ((response.errcode ?? 0) !== 0) {
    throw mcpInternalError(
      `WeCom robot send failed: ${response.errcode ?? "unknown"} ${response.errmsg ?? ""}`.trim(),
    );
  }
};

const sendWecomRobotPayload = async (key: string, payload: Record<string, unknown>) => {
  const response = await fetch(
    `${WECOM_ROBOT_BASE}/send?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw mcpInternalError(`WeCom robot send failed: ${response.status}`);
  }

  const data = (await response.json()) as WecomRobotSendResponse;
  assertRobotSuccess(data);
  return data;
};

export const sendWecomRobotMarkdownMessage = async (input: {
  title: string;
  content: string;
}) => {
  const config = resolveWecomConfig();
  if (!config.robotWebhookUrl) {
    throw mcpInternalError("WeCom robot webhook is not configured.");
  }

  const key = normalizeRobotWebhookKey(config.robotWebhookUrl);
  return sendWecomRobotPayload(key, {
    msgtype: "markdown",
    markdown: {
      content: `### ${input.title}\n${input.content}`,
    },
  });
};

export const sendWecomRobotTextMessage = async (input: {
  content: string;
  mentionAll?: boolean;
  mentionedUserIds?: string[];
}) => {
  const config = resolveWecomConfig();
  if (!config.robotWebhookUrl) {
    throw mcpInternalError("WeCom robot webhook is not configured.");
  }

  const key = normalizeRobotWebhookKey(config.robotWebhookUrl);
  const mentionedList = input.mentionAll
    ? ["@all"]
    : (input.mentionedUserIds ?? []).filter(Boolean);
  return sendWecomRobotPayload(key, {
    msgtype: "text",
    text: {
      content: input.content,
      ...(mentionedList.length > 0 ? { mentioned_list: mentionedList } : {}),
    },
  });
};

export const sendWecomRobotTestMessageByCapability = async (
  capabilityId: string,
  input: {
    title?: string;
    content: string;
    mentionAll?: boolean;
    mentionedUserIds?: string[];
    format?: "markdown" | "text";
  },
) => {
  const capability = integrationCapabilitiesRepository.getById(capabilityId);
  if (!capability || capability.type !== "wecom.webhook_robot") {
    throw mcpInternalError(`WeCom webhook capability not found: ${capabilityId}`);
  }

  const config = capability.config as Record<string, unknown>;
  const webhookUrl = typeof config.webhookUrl === "string" ? config.webhookUrl.trim() : "";
  if (!webhookUrl) {
    throw mcpInternalError("WeCom robot webhook is not configured.");
  }

  const key = normalizeRobotWebhookKey(webhookUrl);
  const format = input.format ?? "markdown";
  if (format === "text") {
    const mentionedList = input.mentionAll
      ? ["@all"]
      : (input.mentionedUserIds ?? []).filter(Boolean);
    return sendWecomRobotPayload(key, {
      msgtype: "text",
      text: {
        content: input.content,
        ...(mentionedList.length > 0 ? { mentioned_list: mentionedList } : {}),
      },
    });
  }

  return sendWecomRobotPayload(key, {
    msgtype: "markdown",
    markdown: {
      content: `### ${input.title?.trim() || "WeCom test message"}\n${input.content}`,
    },
  });
};
