import {
  Agent,
  type AgentOptions,
  type AgentTool,
} from "@earendil-works/pi-agent-core";
import { getProviderDefinition } from "@/providers/catalog.js";
import { resolveAgentTaskProvider } from "@/services/provider-proxy.service/resolution.js";
import type {
  SkillAgentExecutionInput,
  SkillAgentExecutionResult,
  SkillAgentRequirement,
  SkillAgentToolBinding,
} from "./types.js";
import { renderSkillAgentToolResult } from "./tool-adapters.js";

const asPositiveNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

type PiModel = NonNullable<NonNullable<AgentOptions["initialState"]>["model"]>;

const resolvePiModel = (): { model: PiModel; apiKey: string } => {
  const resolved = resolveAgentTaskProvider("default");
  const provider = getProviderDefinition(resolved.providerCode);
  const configuredBaseUrl = resolved.baseUrl.replace(/\/+$/, "");
  const baseUrl =
    provider.chatAdapter === "ollama" && !/\/v1$/i.test(configuredBaseUrl)
      ? `${configuredBaseUrl}/v1`
      : configuredBaseUrl;

  const contextWindow = asPositiveNumber(
    resolved.params.contextWindow ?? resolved.params.context_window,
    128_000,
  );
  const maxTokens = asPositiveNumber(
    resolved.params.maxTokens ?? resolved.params.max_tokens,
    8_192,
  );

  const model = {
    id: resolved.model,
    name: resolved.model,
    api: "openai-completions",
    provider: resolved.providerCode,
    baseUrl,
    reasoning: false,
    input: ["text"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow,
    maxTokens,
  } as PiModel;

  return { model, apiKey: resolved.apiKey };
};

const extractAssistantText = (messages: unknown[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as {
      role?: string;
      content?: unknown;
    };
    if (message?.role !== "assistant") continue;
    if (typeof message.content === "string") return message.content.trim();
    if (!Array.isArray(message.content)) continue;
    const text = message.content
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const block = item as { type?: string; text?: string };
        return block.type === "text" && typeof block.text === "string" ? block.text : "";
      })
      .join("")
      .trim();
    if (text) return text;
  }
  return "";
};

const parseCompletionEnvelope = (raw: string) => {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const candidates = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const status = parsed.status;
      if (
        status === "completed" ||
        status === "insufficient_evidence" ||
        status === "needs_input" ||
        status === "failed"
      ) {
        return parsed;
      }
    } catch {
      // Final output is a protocol boundary: malformed JSON is not repaired by guessing.
    }
  }
  return null;
};

const normalizeCompletionRequirements = (
  value: unknown,
): SkillAgentRequirement[] => {
  if (!Array.isArray(value)) return [];

  const allowedKinds = new Set<SkillAgentRequirement["kind"]>([
    "user_input",
    "evidence",
    "resource",
    "capability",
  ]);

  return value.flatMap((item, index) => {
    if (typeof item === "string" && item.trim()) {
      return [
        {
          id: `completion:user_input:${index}`,
          kind: "user_input" as const,
          description: item.trim(),
          requiredFor: "delegated_goal",
        },
      ];
    }

    const record = asRecord(item);
    const description =
      typeof record?.description === "string" ? record.description.trim() : "";
    if (!record || !description) return [];

    const requestedKind = record.kind;
    const kind =
      typeof requestedKind === "string" &&
      allowedKinds.has(requestedKind as SkillAgentRequirement["kind"])
        ? (requestedKind as Exclude<SkillAgentRequirement["kind"], "approval">)
        : "user_input";

    return [
      {
        id:
          typeof record.id === "string" && record.id.trim()
            ? record.id.trim()
            : `completion:${kind}:${index}`,
        kind,
        description,
        requiredFor:
          typeof record.requiredFor === "string" && record.requiredFor.trim()
            ? record.requiredFor.trim()
            : "delegated_goal",
      },
    ];
  });
};

const buildSystemPrompt = (input: SkillAgentExecutionInput) => {
  const primary = input.skillContext.primary;
  if (!primary) throw new Error("Forked Skill agent requires one primary SkillContext");

  const disclosed = input.skillContext.disclosedResources
    .map((resource) => `<resource uri="${resource.uri}">\n${resource.content}\n</resource>`)
    .join("\n\n");
  const availableUris = input.skillContext.resources.map((resource) => resource.uri);

  return [
    "You are an isolated professional Skill execution agent inside Mira.",
    "You own task-local planning, tool use, observation, evidence coverage and repair until you can return a terminal execution status.",
    "You are not Mira's final conversational spokesperson. Do not address the user conversationally and do not fabricate success.",
    "Only use the tools exposed to this agent. Never assume access to Main Agent tools that are not present.",
    "All file paths and artifacts must stay inside the bound workspace unless a provided tool explicitly returns another managed artifact reference.",
    "When deterministic runtime execution fails, treat the runtime result as authoritative. Never reinterpret failure as success.",
    "If evidence is insufficient, keep working while an allowed tool can materially close the gap. If the gap cannot be closed, return insufficient_evidence or needs_input.",
    "Approval requirements are emitted only by tools. Never invent an approval requirement in your final JSON.",
    "For needs_input, requirements must be objects with kind user_input|evidence|resource|capability, description, and requiredFor.",
    "At the end, output exactly one JSON object and no prose outside it:",
    '{"status":"completed|insufficient_evidence|needs_input|failed","summary":"...","missingEvidence":[],"requirements":[{"kind":"user_input","description":"...","requiredFor":"..."}],"recoverable":true}',
    "",
    `<skill id="${primary.id}" version="${primary.version}" name="${primary.name}">`,
    primary.body,
    "</skill>",
    "",
    `<available-skill-resources>${JSON.stringify(availableUris)}</available-skill-resources>`,
    disclosed ? `<preloaded-resources>\n${disclosed}\n</preloaded-resources>` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

const toPiTool = (input: {
  binding: SkillAgentToolBinding;
  evidence: unknown[];
  artifacts: unknown[];
  requirements: SkillAgentRequirement[];
  toolCalls: string[];
}): AgentTool<any> => ({
  name: input.binding.id,
  label: input.binding.label,
  description: input.binding.description,
  parameters: input.binding.inputSchema as any,
  executionMode: "sequential",
  execute: async (_toolCallId, params, signal) => {
    input.toolCalls.push(input.binding.id);
    const executed = await input.binding.execute(
      (params ?? {}) as Record<string, unknown>,
      signal,
    );
    if (executed.evidence !== undefined) input.evidence.push(executed.evidence);
    if (executed.artifacts?.length) input.artifacts.push(...executed.artifacts);
    if (executed.requirement) input.requirements.push(executed.requirement);

    return {
      content: [
        {
          type: "text",
          text: renderSkillAgentToolResult(executed),
        },
      ],
      details: {
        toolId: input.binding.id,
        result: executed.result ?? null,
        evidence: executed.evidence ?? null,
        artifacts: executed.artifacts ?? [],
        requirement: executed.requirement ?? null,
      },
      ...(executed.terminate ? { terminate: true } : {}),
    };
  },
});

export const runPiSkillAgent = async (input: {
  execution: SkillAgentExecutionInput;
  tools: SkillAgentToolBinding[];
}): Promise<SkillAgentExecutionResult> => {
  const primary = input.execution.skillContext.primary;
  if (!primary) {
    return {
      status: "failed",
      recoverable: false,
      error: "Forked Skill agent cannot start without a primary SkillContext",
      evidence: [],
      artifacts: [],
    };
  }

  const evidence: unknown[] = [];
  const artifacts: unknown[] = [];
  const requirements: SkillAgentRequirement[] = [];
  const toolCalls: string[] = [];
  const { model, apiKey } = resolvePiModel();
  const tools = input.tools.map((binding) =>
    toPiTool({ binding, evidence, artifacts, requirements, toolCalls }),
  );

  const agent = new Agent({
    initialState: {
      systemPrompt: buildSystemPrompt(input.execution),
      model,
      tools,
    },
    getApiKey: () => apiKey || undefined,
    toolExecution: "sequential",
    sessionId: `mira-skill:${primary.id}:${input.execution.threadId ?? "standalone"}`,
  });

  try {
    await agent.prompt(
      [
        `<goal>${input.execution.goal}</goal>`,
        `<workspace>${input.execution.workspaceRoot}</workspace>`,
        "Execute the goal using only the supplied Skill context and tools.",
      ].join("\n"),
    );
  } catch (error) {
    return {
      status: "failed",
      recoverable: true,
      error: error instanceof Error ? error.message : String(error),
      evidence,
      artifacts,
      trace: { engine: "pi-agent-core", skillId: primary.id, toolCalls },
    };
  }

  // Tool-produced requirements are authoritative governance boundaries. This is
  // the only path allowed to carry an approval requirement with exact invocation
  // metadata; model-authored completion JSON cannot mint approval authority.
  if (requirements.length > 0) {
    return {
      status: "needs_input",
      summary: "Forked Skill agent stopped at a governed requirement boundary.",
      requirements,
      evidence,
      artifacts,
      trace: { engine: "pi-agent-core", skillId: primary.id, toolCalls },
    };
  }

  const finalText = extractAssistantText(agent.state.messages as unknown[]);
  const completion = parseCompletionEnvelope(finalText);
  if (!completion) {
    return {
      status: "failed",
      recoverable: true,
      error: "Pi Skill agent returned an invalid completion envelope",
      evidence,
      artifacts,
      trace: { engine: "pi-agent-core", skillId: primary.id, toolCalls },
    };
  }

  const status = completion.status as SkillAgentExecutionResult["status"];
  return {
    status,
    ...(typeof completion.summary === "string" ? { summary: completion.summary } : {}),
    evidence,
    artifacts,
    ...(status === "insufficient_evidence"
      ? {
          missingEvidence: Array.isArray(completion.missingEvidence)
            ? completion.missingEvidence
            : [],
        }
      : {}),
    ...(status === "needs_input"
      ? { requirements: normalizeCompletionRequirements(completion.requirements) }
      : {}),
    ...(status === "failed"
      ? {
          recoverable: completion.recoverable !== false,
          error:
            typeof completion.error === "string"
              ? completion.error
              : "Skill agent reported failure",
        }
      : {}),
    trace: { engine: "pi-agent-core", skillId: primary.id, toolCalls },
  };
};
