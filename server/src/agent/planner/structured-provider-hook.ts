import { writeStructuredLog } from "@/logger";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import { generateTaskStructuredOutput } from "@/services/provider-proxy.service/task-structured-output";
import type { AgentToolExposureState } from "../types";
import {
  buildPlannerStructuredOutputJsonSchema,
  normalizePlannerStructuredDecision,
  type PlannerStructuredDecisionEnvelope,
} from "./structured-output";

const INSTALL_KEY = Symbol.for("uichat-mira.planner-structured-output-installed");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseMessagePayload = (message: NormalizedChatMessage | undefined) => {
  if (!message?.content) return null;
  try {
    const parsed = JSON.parse(message.content) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeToolMeta = (value: unknown) => {
  if (!isRecord(value) || typeof value.toolId !== "string") return null;
  return {
    toolId: value.toolId,
    title: typeof value.title === "string" ? value.title : value.toolId,
    description: typeof value.description === "string" ? value.description : "",
    ...(isRecord(value.inputSchema) ? { inputSchema: value.inputSchema } : {}),
    ...(typeof value.domain === "string" ? { domain: value.domain } : {}),
    ...(typeof value.source === "string" ? { source: value.source } : {}),
  } as AgentToolExposureState["toolMeta"][number];
};

const extractPlannerToolExposure = (
  messages: NormalizedChatMessage[],
): AgentToolExposureState => {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const payload = parseMessagePayload(lastUser);
  const toolExposure = isRecord(payload?.toolExposure) ? payload.toolExposure : null;

  if (toolExposure) {
    const exposedTools = Array.isArray(toolExposure.exposedTools)
      ? toolExposure.exposedTools.filter(
          (item): item is string => typeof item === "string" && Boolean(item.trim()),
        )
      : [];
    const toolMeta = Array.isArray(toolExposure.toolMeta)
      ? toolExposure.toolMeta
          .map(normalizeToolMeta)
          .filter(
            (item): item is AgentToolExposureState["toolMeta"][number] => Boolean(item),
          )
      : [];
    return { exposedTools, toolMeta };
  }

  const allowedTools = Array.isArray(payload?.allowedTools) ? payload.allowedTools : [];
  const toolMeta = allowedTools
    .map(normalizeToolMeta)
    .filter(
      (item): item is AgentToolExposureState["toolMeta"][number] => Boolean(item),
    );
  return {
    exposedTools: toolMeta.map((item) => item.toolId),
    toolMeta,
  };
};

const isPlannerStructuredRequest = (messages: NormalizedChatMessage[]) =>
  messages.some(
    (message) =>
      message.role === "system" && message.content.includes("RUNTIME PLAN CONTRACT:"),
  );

/**
 * Planner keeps the existing streamTaskChatText call site for compatibility,
 * but planner-marked requests are fulfilled by one native schema-constrained
 * generation. The resulting object is yielded once as JSON so the existing
 * parser/validator boundary remains intact.
 */
export const installPlannerStructuredOutputHook = () => {
  const installState = providerProxyService as unknown as Record<PropertyKey, unknown>;
  if (installState[INSTALL_KEY] === true) return;

  const originalStreamTaskChatText = providerProxyService.streamTaskChatText.bind(
    providerProxyService,
  );

  providerProxyService.streamTaskChatText = ((messages: NormalizedChatMessage[]) => {
    if (!isPlannerStructuredRequest(messages)) {
      return originalStreamTaskChatText(messages);
    }

    return (async function* () {
      try {
        const toolExposure = extractPlannerToolExposure(messages);
        const envelope = await generateTaskStructuredOutput<PlannerStructuredDecisionEnvelope>({
          messages,
          schema: buildPlannerStructuredOutputJsonSchema(toolExposure),
          name: "planner_decision",
          description:
            "Exactly one next-action Planner decision plus a lightweight runtime todo patch.",
        });
        const decision = normalizePlannerStructuredDecision(envelope);
        yield JSON.stringify(decision);
      } catch (error) {
        writeStructuredLog("warn", {
          msg: "Planner native structured output unavailable; falling back to text JSON",
          event: "agent-next-action-planner-structured-fallback",
          reason: error instanceof Error ? error.message : String(error),
        });
        yield* originalStreamTaskChatText(messages);
      }
    })();
  }) as typeof providerProxyService.streamTaskChatText;

  installState[INSTALL_KEY] = true;
};

installPlannerStructuredOutputHook();
