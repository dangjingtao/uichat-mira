import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { toPlannerSkillDirective, type SkillDirective } from "./types.js";

const DIRECTIVE_PREFIX = "MIRA_SKILL_DIRECTIVE_V1:";
const DELIVERY_PREFIX = "MIRA_SKILL_DELIVERY_V1:";

export const buildSkillFlowRequestContextMessages = (
  directive: SkillDirective | undefined,
): NormalizedChatMessage[] => {
  if (!directive) return [];
  const plannerDirective = toPlannerSkillDirective(directive);
  const messages: NormalizedChatMessage[] = [
    {
      role: "system",
      content: `${DIRECTIVE_PREFIX}${JSON.stringify(plannerDirective)}`,
      parts: [],
      requestContextScope: "agent-execution",
    },
  ];

  if (directive.delivery?.content) {
    messages.push({
      role: "system",
      content: `${DELIVERY_PREFIX}${JSON.stringify({
        kind: directive.delivery.kind,
        content: directive.delivery.content,
      })}`,
      parts: [],
    });
  }

  return messages;
};

export const readSkillDirectiveFromRequestContext = (
  messages: NormalizedChatMessage[] | undefined,
): SkillDirective | undefined => {
  const message = [...(messages ?? [])]
    .reverse()
    .find((item) => item.role === "system" && item.content.startsWith(DIRECTIVE_PREFIX));
  if (!message) return undefined;
  try {
    const parsed = JSON.parse(message.content.slice(DIRECTIVE_PREFIX.length)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const value = parsed as SkillDirective;
    return typeof value.skillId === "string" && typeof value.phase === "string"
      ? value
      : undefined;
  } catch {
    return undefined;
  }
};

export const readSkillDeliveryFromRequestContext = (
  messages: NormalizedChatMessage[] | undefined,
): { kind: "markdown" | "inline_html"; content: string } | undefined => {
  const message = [...(messages ?? [])]
    .reverse()
    .find((item) => item.role === "system" && item.content.startsWith(DELIVERY_PREFIX));
  if (!message) return undefined;
  try {
    const parsed = JSON.parse(message.content.slice(DELIVERY_PREFIX.length)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const value = parsed as Record<string, unknown>;
    if (
      (value.kind === "markdown" || value.kind === "inline_html") &&
      typeof value.content === "string" &&
      value.content.trim()
    ) {
      return { kind: value.kind, content: value.content };
    }
    return undefined;
  } catch {
    return undefined;
  }
};
