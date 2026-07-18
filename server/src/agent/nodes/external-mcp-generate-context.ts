import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import type {
  AgentNodeState,
  EmitAgentExecutionNode,
} from "../node-runtime";
import type { AgentToolExecutionResult } from "../types";
import { generateNode as baseGenerateNode } from "./generate";

const EXTERNAL_MCP_CONTEXT_CHAR_LIMIT = 24_000;
const EXTERNAL_MCP_MAX_DEPTH = 12;
const EXTERNAL_MCP_MAX_ARRAY_ITEMS = 100;
const EXTERNAL_MCP_MAX_OBJECT_KEYS = 100;
const EXTERNAL_MCP_MAX_STRING_CHARS = 20_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const tryParseJsonText = (value: string): unknown => {
  const text = value.trim();
  if (
    text.length < 2 ||
    !(
      (text.startsWith("{") && text.endsWith("}")) ||
      (text.startsWith("[") && text.endsWith("]"))
    )
  ) {
    return value;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return value;
  }
};

const projectValueForGenerate = (
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown => {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    const parsed = tryParseJsonText(value);
    if (parsed !== value) {
      return projectValueForGenerate(parsed, depth, seen);
    }
    return value.length > EXTERNAL_MCP_MAX_STRING_CHARS
      ? `${value.slice(0, EXTERNAL_MCP_MAX_STRING_CHARS)}\n...[string truncated]`
      : value;
  }

  if (typeof value === "undefined") {
    return "[undefined]";
  }

  if (typeof value === "function" || typeof value === "symbol") {
    return `[${typeof value}]`;
  }

  if (depth >= EXTERNAL_MCP_MAX_DEPTH) {
    return "[max depth reached]";
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    return "[circular reference]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const projected = value
      .slice(0, EXTERNAL_MCP_MAX_ARRAY_ITEMS)
      .map((item) => projectValueForGenerate(item, depth + 1, seen));
    if (value.length > EXTERNAL_MCP_MAX_ARRAY_ITEMS) {
      projected.push(
        `[${value.length - EXTERNAL_MCP_MAX_ARRAY_ITEMS} array item(s) omitted]`,
      );
    }
    return projected;
  }

  const entries = Object.entries(value);
  const projected: Record<string, unknown> = {};
  for (const [key, entryValue] of entries.slice(0, EXTERNAL_MCP_MAX_OBJECT_KEYS)) {
    projected[key] = projectValueForGenerate(entryValue, depth + 1, seen);
  }
  if (entries.length > EXTERNAL_MCP_MAX_OBJECT_KEYS) {
    projected.__omittedKeys =
      entries.length - EXTERNAL_MCP_MAX_OBJECT_KEYS;
  }
  return projected;
};

const serializeExternalMcpResult = (value: unknown, limit: number) => {
  let serialized: string;
  try {
    const projected = projectValueForGenerate(value, 0, new WeakSet<object>());
    serialized =
      typeof projected === "string"
        ? projected
        : JSON.stringify(projected, null, 2) ?? "[unserializable result]";
  } catch (error) {
    serialized = `[external MCP result serialization failed: ${
      error instanceof Error ? error.message : String(error)
    }]`;
  }

  if (serialized.length <= limit) {
    return {
      text: serialized,
      truncated: false,
      originalCharCount: serialized.length,
    };
  }

  const marker = `\n...[external MCP result truncated; originalCharCount=${serialized.length}]`;
  const boundedLength = Math.max(0, limit - marker.length);
  return {
    text: `${serialized.slice(0, boundedLength).trimEnd()}${marker}`,
    truncated: true,
    originalCharCount: serialized.length,
  };
};

const getExternalMcpEnvelope = (execution: AgentToolExecutionResult) => {
  if (execution.status !== "completed" || !isRecord(execution.result)) {
    return null;
  }

  const envelope = execution.result;
  if (
    envelope.type !== "external_mcp" ||
    typeof envelope.serverId !== "string" ||
    typeof envelope.remoteToolName !== "string"
  ) {
    return null;
  }

  return {
    serverId: envelope.serverId,
    remoteToolName: envelope.remoteToolName,
    result: envelope.result,
  };
};

export const buildExternalMcpGenerateContextText = (
  executions: AgentToolExecutionResult[],
  totalCharLimit = EXTERNAL_MCP_CONTEXT_CHAR_LIMIT,
) => {
  const envelopes = executions
    .map((execution) => ({ execution, envelope: getExternalMcpEnvelope(execution) }))
    .filter(
      (
        item,
      ): item is {
        execution: AgentToolExecutionResult;
        envelope: NonNullable<ReturnType<typeof getExternalMcpEnvelope>>;
      } => Boolean(item.envelope),
    );

  if (envelopes.length === 0 || totalCharLimit <= 0) {
    return null;
  }

  const sections: string[] = [
    "以下是已实际执行完成的外部 MCP 工具返回结果。",
    "这些内容是最终回答所需的真实数据，不只是执行摘要。请直接依据它们回答用户。",
    "若某段标记为 truncated，只能使用已展示部分，不得编造被省略内容。",
  ];
  let usedChars = sections.join("\n").length;

  for (const [index, item] of envelopes.entries()) {
    const header = [
      `# external_mcp_result_${index + 1}`,
      `toolId: ${item.execution.toolId}`,
      `serverId: ${item.envelope.serverId}`,
      `remoteToolName: ${item.envelope.remoteToolName}`,
    ].join("\n");
    const remaining = totalCharLimit - usedChars - header.length - 80;
    if (remaining <= 200) {
      sections.push(
        `# external_mcp_result_${index + 1}\n[omitted because the external MCP context budget was exhausted]`,
      );
      break;
    }

    const serialized = serializeExternalMcpResult(item.envelope.result, remaining);
    const section = [
      header,
      `resultTruncated: ${serialized.truncated}`,
      `originalCharCount: ${serialized.originalCharCount}`,
      "result:",
      serialized.text || "(empty result)",
    ].join("\n");
    sections.push(section);
    usedChars += section.length + 2;

    if (usedChars >= totalCharLimit) {
      break;
    }
  }

  const text = sections.join("\n\n");
  if (text.length <= totalCharLimit) {
    return text;
  }

  const marker = "\n...[external MCP generate context truncated by total budget]";
  const boundedLength = Math.max(0, totalCharLimit - marker.length);
  return `${text.slice(0, boundedLength).trimEnd()}${marker}`;
};

const insertBeforeLatestMessage = (
  messages: NormalizedChatMessage[],
  contextMessage: NormalizedChatMessage,
) => {
  if (messages.length === 0) {
    return [contextMessage];
  }

  return [
    ...messages.slice(0, -1),
    contextMessage,
    messages[messages.length - 1]!,
  ];
};

export type GenerateNodeHandler = (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
) => Promise<Partial<AgentNodeState>>;

export const createExternalMcpAwareGenerateNode = (
  generate: GenerateNodeHandler = baseGenerateNode,
): GenerateNodeHandler =>
  async (state, emit) => {
    const contextText = buildExternalMcpGenerateContextText(
      state.evidence?.toolExecutions ?? [],
    );
    if (!contextText) {
      return generate(state, emit);
    }

    const contextMessage: NormalizedChatMessage = {
      role: "system",
      content: contextText,
      parts: [{ type: "text", text: contextText }],
    };

    return generate(
      {
        ...state,
        messages: insertBeforeLatestMessage(state.messages, contextMessage),
      },
      emit,
    );
  };

export const externalMcpAwareGenerateNode =
  createExternalMcpAwareGenerateNode();
