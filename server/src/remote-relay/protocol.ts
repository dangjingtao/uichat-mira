export const RELAY_PROTOCOL_VERSION = 1 as const;
export const RELAY_MAX_REQUEST_BODY_BYTES = 1024 * 1024;
export const RELAY_MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
export const RELAY_STREAM_CHUNK_BYTES = 48 * 1024;

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:~-]{1,220}$/u;
const METHOD_PATTERN = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/u;

export type RelayHelloFrame = {
  version: 1;
  type: "hello";
  role: "host";
  relayId: string;
  token: string;
  clientToken: string;
};

export type RelayHelloAckFrame = {
  version: 1;
  type: "hello_ack";
  role: "host" | "client";
  relayId: string;
  protocolVersion: number;
  hostConnected?: boolean;
};

export type RelayRequestFrame = {
  version: 1;
  type: "request";
  requestId: string;
  method: string;
  path: string;
  headers?: Record<string, string>;
  bodyBase64?: string;
};

export type RelayResponseFrame = {
  version: 1;
  type: "response";
  requestId: string;
  status: number;
  headers: Record<string, string>;
};

export type RelayChunkFrame = {
  version: 1;
  type: "chunk";
  requestId: string;
  encoding: "base64";
  data: string;
};

export type RelayCompleteFrame = {
  version: 1;
  type: "complete";
  requestId: string;
};

export type RelayCancelFrame = {
  version: 1;
  type: "cancel";
  requestId: string;
};

export type RelayErrorFrame = {
  version: 1;
  type: "error";
  requestId?: string;
  code: string;
  message: string;
  retryable: boolean;
};

export type RelayInboundHostFrame =
  | RelayHelloAckFrame
  | RelayRequestFrame
  | RelayCancelFrame
  | RelayErrorFrame;

export type RelayOutboundHostFrame =
  | RelayHelloFrame
  | RelayResponseFrame
  | RelayChunkFrame
  | RelayCompleteFrame
  | RelayErrorFrame;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRequestId = (value: unknown): value is string =>
  typeof value === "string" && REQUEST_ID_PATTERN.test(value);

const parseHeaders = (value: unknown): Record<string, string> | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value);
  if (
    entries.length > 64 ||
    entries.some(
      ([key, item]) =>
        !key || key.length > 128 || typeof item !== "string" || item.length > 8192,
    )
  ) {
    return undefined;
  }
  return Object.fromEntries(entries) as Record<string, string>;
};

const parsePath = (value: unknown) => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 4096 ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return null;
  }
  return value;
};

export const parseRelayInboundHostFrame = (
  raw: string,
): RelayInboundHostFrame | null => {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== RELAY_PROTOCOL_VERSION) {
    return null;
  }

  if (value.type === "hello_ack") {
    if (
      (value.role !== "host" && value.role !== "client") ||
      typeof value.relayId !== "string" ||
      typeof value.protocolVersion !== "number"
    ) {
      return null;
    }
    return {
      version: RELAY_PROTOCOL_VERSION,
      type: "hello_ack",
      role: value.role,
      relayId: value.relayId,
      protocolVersion: value.protocolVersion,
      ...(typeof value.hostConnected === "boolean"
        ? { hostConnected: value.hostConnected }
        : {}),
    };
  }

  if (value.type === "request") {
    const path = parsePath(value.path);
    const headers = parseHeaders(value.headers);
    if (
      !isRequestId(value.requestId) ||
      typeof value.method !== "string" ||
      !METHOD_PATTERN.test(value.method.toUpperCase()) ||
      !path ||
      (value.headers !== undefined && headers === undefined) ||
      (value.bodyBase64 !== undefined && typeof value.bodyBase64 !== "string")
    ) {
      return null;
    }
    return {
      version: RELAY_PROTOCOL_VERSION,
      type: "request",
      requestId: value.requestId,
      method: value.method.toUpperCase(),
      path,
      ...(headers ? { headers } : {}),
      ...(typeof value.bodyBase64 === "string"
        ? { bodyBase64: value.bodyBase64 }
        : {}),
    };
  }

  if (value.type === "cancel") {
    return isRequestId(value.requestId)
      ? {
          version: RELAY_PROTOCOL_VERSION,
          type: "cancel",
          requestId: value.requestId,
        }
      : null;
  }

  if (value.type === "error") {
    if (
      (value.requestId !== undefined && !isRequestId(value.requestId)) ||
      typeof value.code !== "string" ||
      typeof value.message !== "string" ||
      typeof value.retryable !== "boolean"
    ) {
      return null;
    }
    return {
      version: RELAY_PROTOCOL_VERSION,
      type: "error",
      ...(typeof value.requestId === "string"
        ? { requestId: value.requestId }
        : {}),
      code: value.code,
      message: value.message,
      retryable: value.retryable,
    };
  }

  return null;
};

export const serializeRelayFrame = (frame: RelayOutboundHostFrame) =>
  JSON.stringify(frame);
