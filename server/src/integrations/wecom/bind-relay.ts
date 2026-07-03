import CONFIG from "@/config/index.js";
import { mcpInternalError } from "@/mcp/core/errors.js";

type WecomRelayPollResponse =
  | {
      success: true;
      status: "pending" | "ready";
      ticket: string;
      userid?: string | null;
      externalUnionId?: string | null;
      bindSource?: "oauth";
    }
  | {
      success: false;
      message: string;
    };

const resolveRelayBaseUrl = () => {
  const baseUrl = CONFIG.WECOM_BIND_RELAY_BASE_URL.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw mcpInternalError(
      "WECOM_BIND_RELAY_BASE_URL is not configured. Set it to the Cloudflare Worker base URL.",
    );
  }

  return baseUrl;
};

export const startWecomOAuthRelay = async () => {
  const ticket = crypto.randomUUID().replace(/-/g, "");
  return {
    success: true as const,
    ticket,
    authorizeUrl: `${resolveRelayBaseUrl()}/wecom/start?ticket=${encodeURIComponent(ticket)}`,
  };
};

export const pollWecomOAuthRelay = async (ticket: string) => {
  const response = await fetch(
    `${resolveRelayBaseUrl()}/wecom/poll?ticket=${encodeURIComponent(ticket)}`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw mcpInternalError(`WeCom relay poll failed: ${response.status}`);
  }

  const data = (await response.json()) as WecomRelayPollResponse;
  if (!data.success) {
    throw mcpInternalError(
      `WeCom relay poll failed: ${data.message ?? "unknown error"}`,
    );
  }

  return data;
};
