import type {
  CodebaseCandidate,
  CodebaseCandidateKind,
  CodebaseExploreCommand,
  CodebaseExploreFallbackSignal,
  CodebaseExploreInternalRequest,
  CodebaseExploreLimitation,
  CodebaseExploreResult,
  CodebaseExploreScope,
  CodebaseTraceStatus,
} from "./types.js";
import { ManagedCodeGraphProcessManager } from "./managed-codegraph-process-manager.js";
import { createCodebaseExploreTrace } from "./codegraph-trace-diagnostics.js";

type ProviderCommand = Exclude<CodebaseExploreCommand, "mixed">;

type ProviderCandidate = {
  path?: string;
  startLine?: number | null;
  endLine?: number | null;
  kind?: string | null;
  summary?: string | null;
  snippet?: string | null;
  score?: number | null;
};

type ProviderResponse = {
  candidates?: ProviderCandidate[];
  unavailableReason?: "provider_unavailable";
  unavailableMessage?: string;
};

type CodebaseExploreLimits = {
  maxFiles: number;
  maxSnippets: number;
  maxSnippetLines: number;
  maxTotalLines: number;
  maxRawChars: number;
};

const DEFAULT_LIMITS = {
  maxFiles: 8,
  maxSnippets: 12,
  maxSnippetLines: 24,
  maxTotalLines: 160,
  maxRawChars: 16_000,
} as const;

const DEFAULT_EXCLUDE_PATHS = [
  "node_modules/**",
  ".git/**",
  "dist/**",
  "build/**",
  "coverage/**",
  "release/**",
  ".artifacts/**",
  ".test-artifact/**",
] as const;

const SCOPE_INCLUDE_PATHS: Record<CodebaseExploreScope, string[]> = {
  "agent-runtime": ["server/src/agent/**"],
  "harness-mcp": ["server/src/mcp/**", "server/src/harness/**"],
  "desktop-ui": ["desktop/src/**", "electron/**"],
  microapps: [
    "server/src/microapps/**",
    "server/src/routes/microapps/**",
    "desktop/src/features/Settings/pages/MicroApps/**",
    "docs/microapp/**",
  ],
  docs: ["docs/**", "README.md", "AGENTS.md"],
  "workspace-general": [
    "server/**",
    "desktop/**",
    "electron/**",
    "packages/**",
    "docs/**",
    "scripts/**",
    "runtime.config.cjs",
    "README.md",
  ],
};

const AGENT_RUNTIME_PATTERNS = [
  /agent-runtime/i,
  /\bplanner\b/i,
  /\btoolnode\b/i,
  /\bpolicy\b/i,
  /\bnormalize\b/i,
  /\bagent\b/i,
];
const HARNESS_MCP_PATTERNS = [/\bharness\b/i, /\bmcp\b/i, /tool runtime/i, /json-rpc/i];
const DESKTOP_UI_PATTERNS = [/\bdesktop\b/i, /\brenderer\b/i, /\belectron\b/i, /\bui\b/i];
const MICROAPP_PATTERNS = [/\bmicroapp\b/i, /microapps/i, /image generation/i, /computer use/i];
const DOCS_PATTERNS = [/\bdocs?\b/i, /readme/i, /architecture/i, /agents\.md/i];
const AFFECTED_PATTERNS = [/影响/, /依赖/, /where used/i, /who uses/i, /affected/i, /impact/i];
const EXPLORE_PATTERNS = [/overview/i, /怎么串起来/, /how .*work/i, /flow/i, /architecture/i];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const trimSnippet = (snippet: string | null | undefined, maxLines: number) => {
  if (!snippet) {
    return null;
  }
  const lines = snippet.split(/\r?\n/);
  return lines.slice(0, maxLines).join("\n");
};

const toLineCount = (snippet: string | null) => (snippet ? snippet.split(/\r?\n/).length : 0);

const unique = <T>(values: T[]) => [...new Set(values)];

const extractLineNumber = (value: string) => {
  const match = value.match(/^(\d+)\t(.*)$/);
  if (!match) {
    return null;
  }

  return {
    lineNumber: Number(match[1]),
    text: match[2]!.replace(/^\uFEFF/, ""),
  };
};

const parseExploreToolResponse = (text: string): ProviderResponse => {
  const normalized = text.trim();
  if (!normalized) {
    return { candidates: [] };
  }

  if (/isn't indexed|not initialized|no \.codegraph\/ index exists/i.test(normalized)) {
    return {
      candidates: [],
      unavailableReason: "provider_unavailable",
      unavailableMessage: normalized,
    };
  }

  if (/No relevant code found/i.test(normalized)) {
    return { candidates: [] };
  }

  const candidates: ProviderCandidate[] = [];
  const sectionPattern =
    /\*\*`([^`]+)`\*\*(?:\s+[—-]\s+([^\n]+))?\s*\n\s*```[^\n]*\n([\s\S]*?)\n```/g;
  for (const match of normalized.matchAll(sectionPattern)) {
    const filePath = match[1]?.trim();
    if (!filePath) {
      continue;
    }

    const summary = match[2]?.trim() || "CodeGraph explore returned a file section.";
    const numberedLines = (match[3] ?? "")
      .split(/\r?\n/)
      .map((line) => extractLineNumber(line))
      .filter((line): line is NonNullable<typeof line> => line !== null);

    const startLine = numberedLines[0]?.lineNumber ?? null;
    const endLine = numberedLines[numberedLines.length - 1]?.lineNumber ?? startLine;
    const snippet =
      numberedLines.length > 0
        ? numberedLines.map((line) => line.text).join("\n")
        : (match[3] ?? "").trim() || null;

    candidates.push({
      path: filePath,
      startLine,
      endLine,
      kind: "file-entry",
      summary,
      snippet,
      score: startLine !== null && endLine !== null ? 0.92 : 0.58,
    });
  }

  return {
    candidates,
  };
};

const pickScope = (query: string): CodebaseExploreScope => {
  if (AGENT_RUNTIME_PATTERNS.some((pattern) => pattern.test(query))) {
    return "agent-runtime";
  }
  if (HARNESS_MCP_PATTERNS.some((pattern) => pattern.test(query))) {
    return "harness-mcp";
  }
  if (MICROAPP_PATTERNS.some((pattern) => pattern.test(query))) {
    return "microapps";
  }
  if (DESKTOP_UI_PATTERNS.some((pattern) => pattern.test(query))) {
    return "desktop-ui";
  }
  if (DOCS_PATTERNS.some((pattern) => pattern.test(query))) {
    return "docs";
  }
  return "workspace-general";
};

const pickCommand = (query: string, scope: CodebaseExploreScope): CodebaseExploreCommand => {
  if (AFFECTED_PATTERNS.some((pattern) => pattern.test(query))) {
    return "affected";
  }
  if (scope === "workspace-general" || MICROAPP_PATTERNS.some((pattern) => pattern.test(query))) {
    return "mixed";
  }
  if (EXPLORE_PATTERNS.some((pattern) => pattern.test(query))) {
    return "explore";
  }
  return "query";
};

const normalizeKind = (kind: string | null | undefined): CodebaseCandidateKind => {
  switch (kind) {
    case "symbol-definition":
    case "reference":
    case "impact-edge":
    case "text-hit":
    case "file-entry":
      return kind;
    default:
      return "unknown";
  }
};

const normalizeConfidence = (
  score: number | null | undefined,
  startLine: number | null,
  endLine: number | null,
) => {
  const base = typeof score === "number" ? clamp(score, 0, 1) : 0.55;
  if (startLine === null || endLine === null) {
    return Math.min(base, 0.39);
  }
  return clamp(base, 0, 1);
};

const sortCandidates = (left: CodebaseCandidate, right: CodebaseCandidate) => {
  if (right.confidence !== left.confidence) {
    return right.confidence - left.confidence;
  }
  if ((left.startLine === null) !== (right.startLine === null)) {
    return left.startLine === null ? 1 : -1;
  }
  return left.path.localeCompare(right.path);
};

const DEFAULT_SUGGESTED_CHAIN: CodebaseExploreFallbackSignal["suggestedChain"] = [
  "codegraph",
  "scoped_search_text",
  "workspace_inventory",
  "read_file_slice",
];

export class CodebaseExploreWrapper {
  constructor(private readonly manager: ManagedCodeGraphProcessManager) {}

  inferScope(query: string) {
    return pickScope(query);
  }

  async explore(request: CodebaseExploreInternalRequest): Promise<CodebaseExploreResult> {
    const startedAt = Date.now();
    const originalQuery = request.query;
    const normalizedQuery = request.query.trim();
    const scope = request.scope ?? this.inferScope(normalizedQuery);
    const command = pickCommand(normalizedQuery, scope);
    const includePaths = unique([
      ...SCOPE_INCLUDE_PATHS[scope],
      ...(request.includePaths ?? []),
    ]);
    const excludePaths = unique([
      ...DEFAULT_EXCLUDE_PATHS,
      ...(request.excludePaths ?? []),
    ]);
    const limits = {
      maxFiles: request.maxFiles ?? DEFAULT_LIMITS.maxFiles,
      maxSnippets: request.maxSnippets ?? DEFAULT_LIMITS.maxSnippets,
      maxSnippetLines: request.maxSnippetLines ?? DEFAULT_LIMITS.maxSnippetLines,
      maxTotalLines: request.maxTotalLines ?? DEFAULT_LIMITS.maxTotalLines,
      maxRawChars: request.maxRawChars ?? DEFAULT_LIMITS.maxRawChars,
    };

    const started = await this.manager.start();
    if (started.status !== "ready") {
      const traceStatus: CodebaseTraceStatus = "failed";
      return {
        status: "degraded",
        scope: [scope],
        query: normalizedQuery,
        engine: "codegraph",
        command,
        includePaths,
        excludePaths,
        candidates: [],
        followUpReads: [],
        truncated: false,
        degraded: true,
        followUpHints: ["CodeGraph 不可用，下一步应走 scoped search_text 或 workspace_inventory。"],
        limitations: [
          started.workspaceMatches ? "provider_unavailable" : "workspace_mismatch",
          "query_failed",
        ],
        fallbackSignal: {
          required: true,
          reason: started.workspaceMatches ? "provider_unavailable" : "workspace_mismatch",
          suggestedChain: ["codegraph", "scoped_search_text", "workspace_inventory", "read_file_slice"],
        },
        trace: createCodebaseExploreTrace({
          originalQuery,
          normalizedQuery,
          selectedScope: [scope],
          includePaths,
          excludePaths,
          internalCommand: command,
          resultCount: 0,
          truncated: false,
          limitations: [
            started.workspaceMatches ? "provider_unavailable" : "workspace_mismatch",
            "query_failed",
          ],
          fallbackSignal: {
            required: true,
            reason: started.workspaceMatches ? "provider_unavailable" : "workspace_mismatch",
            suggestedChain: ["codegraph", "scoped_search_text", "workspace_inventory", "read_file_slice"],
          },
          verificationReadCount: 0,
          durationMs: Date.now() - startedAt,
          status: traceStatus,
          runtimeStatus: started,
        }),
      };
    }

    try {
      const providerResponses =
        command === "mixed"
          ? await Promise.all([
              this.runProviderCommand("query", normalizedQuery, includePaths, excludePaths),
              this.runProviderCommand("explore", normalizedQuery, includePaths, excludePaths),
            ])
          : [
              await this.runProviderCommand(
                command,
                normalizedQuery,
                includePaths,
                excludePaths,
              ),
            ];
      const unavailableResponse = providerResponses.find((response) => response.unavailableReason);
      if (unavailableResponse) {
        const fallbackSignal: CodebaseExploreFallbackSignal = {
          required: true,
          reason: "provider_unavailable",
          suggestedChain: [...DEFAULT_SUGGESTED_CHAIN],
        };

        return {
          status: "degraded",
          scope: [scope],
          query: normalizedQuery,
          engine: "codegraph",
          command,
          includePaths,
          excludePaths,
          candidates: [],
          followUpReads: [],
          truncated: false,
          degraded: true,
          followUpHints: [
            unavailableResponse.unavailableMessage ??
              "CodeGraph provider is available but the workspace is not indexed.",
          ],
          limitations: ["provider_unavailable", "query_failed"],
          fallbackSignal,
          trace: createCodebaseExploreTrace({
            originalQuery,
            normalizedQuery,
            selectedScope: [scope],
            includePaths,
            excludePaths,
            internalCommand: command,
            resultCount: 0,
            truncated: false,
            limitations: ["provider_unavailable", "query_failed"],
            fallbackSignal,
            verificationReadCount: 0,
            durationMs: Date.now() - startedAt,
            status: "degraded",
            runtimeStatus: this.manager.getStatus(),
          }),
        };
      }

      const rawCandidates = providerResponses.flatMap((response) => response.candidates ?? []);
      return this.normalizeResult({
        originalQuery,
        query: normalizedQuery,
        scope,
        command,
        includePaths,
        excludePaths,
        rawCandidates,
        limits,
        durationMs: Date.now() - startedAt,
        runtimeStatus: this.manager.getStatus(),
      });
    } catch {
      const fallbackSignal: CodebaseExploreFallbackSignal = {
        required: true,
        reason: "query_failed",
        suggestedChain: [...DEFAULT_SUGGESTED_CHAIN],
      };
      return {
        status: "degraded",
        scope: [scope],
        query: normalizedQuery,
        engine: "codegraph",
        command,
        includePaths,
        excludePaths,
        candidates: [],
        followUpReads: [],
        truncated: false,
        degraded: true,
        followUpHints: [
          "CodeGraph 查询失败，下一步应改走 scoped search_text，再决定是否读原文。",
        ],
        limitations: ["query_failed"],
        fallbackSignal,
        trace: createCodebaseExploreTrace({
          originalQuery,
          normalizedQuery,
          selectedScope: [scope],
          includePaths,
          excludePaths,
          internalCommand: command,
          resultCount: 0,
          truncated: false,
          limitations: ["query_failed"],
          fallbackSignal,
          verificationReadCount: 0,
          durationMs: Date.now() - startedAt,
          status: "failed",
          runtimeStatus: this.manager.getStatus(),
        }),
      };
    }
  }

  private async runProviderCommand(
    command: ProviderCommand,
    query: string,
    includePaths: string[],
    excludePaths: string[],
  ) {
    try {
      return await this.manager.request<ProviderResponse>(
        `codegraph/${command}`,
        {
          query,
          includePaths,
          excludePaths,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/Method not found|Unknown tool/i.test(message)) {
        throw error;
      }
    }

    try {
      const toolResult = await this.manager.callTool("codegraph_explore", {
        query,
      });
      const toolText = (toolResult.content ?? [])
        .map((entry) => entry.text ?? "")
        .filter(Boolean)
        .join("\n")
        .trim();
      if (toolResult.isError) {
        throw new Error(toolText || "codegraph_explore returned an error");
      }

      return parseExploreToolResponse(toolText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/isn't indexed|not initialized|no \.codegraph\/ index exists/i.test(message)) {
        return {
          candidates: [],
          unavailableReason: "provider_unavailable",
          unavailableMessage: message,
        };
      }
      throw error;
    }
  }

  private normalizeResult(input: {
    originalQuery: string;
    query: string;
    scope: CodebaseExploreScope;
    command: CodebaseExploreCommand;
    includePaths: string[];
    excludePaths: string[];
    rawCandidates: ProviderCandidate[];
    limits: CodebaseExploreLimits;
    durationMs: number;
    runtimeStatus: ReturnType<ManagedCodeGraphProcessManager["getStatus"]>;
  }): CodebaseExploreResult {
    const limitations = new Set<CodebaseExploreLimitation>();
    const followUpHints: string[] = [];
    const fileSet = new Set<string>();
    let totalLines = 0;
    let rawChars = 0;
    const normalizedCandidates = input.rawCandidates
      .map((candidate): CodebaseCandidate | null => {
        const path = candidate.path?.trim();
        if (!path) {
          return null;
        }
        const startLine =
          Number.isInteger(candidate.startLine) && Number(candidate.startLine) > 0
            ? Number(candidate.startLine)
            : null;
        const endLine =
          Number.isInteger(candidate.endLine) && Number(candidate.endLine) >= (startLine ?? 0)
            ? Number(candidate.endLine)
            : startLine;
        const snippet = trimSnippet(candidate.snippet, input.limits.maxSnippetLines);
        const summary = (candidate.summary ?? "").trim() || "CodeGraph 返回了候选，但摘要不足。";
        const candidateLimitations: CodebaseExploreLimitation[] = [];
        if (startLine === null || endLine === null) {
          candidateLimitations.push("missing_line_range", "requires_follow_up_read");
        }
        return {
          path,
          startLine,
          endLine,
          kind: normalizeKind(candidate.kind),
          summary: summary.slice(0, 280),
          confidence: normalizeConfidence(candidate.score, startLine, endLine),
          snippet,
          source: {
            engine: "codegraph" as const,
            command: input.command,
          },
          verification: {
            required: true as const,
            status: "pending" as const,
          },
          limitations: candidateLimitations,
        };
      })
      .filter((candidate): candidate is CodebaseCandidate => candidate !== null)
      .sort(sortCandidates);

    const keptCandidates: CodebaseCandidate[] = [];
    for (const candidate of normalizedCandidates) {
      const candidateLineCount =
        candidate.startLine !== null && candidate.endLine !== null
          ? Math.max(0, candidate.endLine - candidate.startLine + 1)
          : toLineCount(candidate.snippet);
      const effectiveLineCount = Math.min(candidateLineCount, input.limits.maxSnippetLines);
      const nextRawChars =
        rawChars +
        candidate.summary.length +
        (candidate.snippet?.length ?? 0) +
        candidate.path.length;

      if (
        keptCandidates.length >= input.limits.maxSnippets ||
        (!fileSet.has(candidate.path) && fileSet.size >= input.limits.maxFiles) ||
        totalLines + effectiveLineCount > input.limits.maxTotalLines ||
        nextRawChars > input.limits.maxRawChars
      ) {
        limitations.add("result_trimmed");
        limitations.add("requires_follow_up_read");
        continue;
      }

      keptCandidates.push(candidate);
      fileSet.add(candidate.path);
      totalLines += effectiveLineCount;
      rawChars = nextRawChars;
      for (const limitation of candidate.limitations) {
        limitations.add(limitation);
      }
    }

    const isBroadNoise =
      input.command === "explore" || input.command === "mixed"
        ? input.rawCandidates.length > keptCandidates.length || normalizedCandidates.length > 6
        : false;
    if (isBroadNoise) {
      limitations.add("broad_query_noise_detected");
      limitations.add("requires_follow_up_read");
      followUpHints.push("当前结果属于 broad explore，建议继续缩 scope 或直接读原文。");
    }
    if (limitations.has("missing_line_range")) {
      followUpHints.push("存在无 line range 的候选，不能当高置信事实使用。");
    }
    if (limitations.has("result_trimmed")) {
      followUpHints.push("结果已裁剪，当前列表不是完整命中集合。");
    }

    const resultLimitations = [...limitations];
    const status =
      resultLimitations.includes("query_failed")
        ? "degraded"
        : resultLimitations.includes("broad_query_noise_detected") ||
            resultLimitations.includes("result_trimmed")
          ? "partial"
          : "ok";

    const followUpReads: CodebaseExploreResult["followUpReads"] = keptCandidates.map((
      candidate,
      candidateIndex,
    ) => ({
      candidateIndex,
      path: candidate.path,
      startLine: candidate.startLine,
      endLine: candidate.endLine,
      reason:
        candidate.startLine === null || candidate.endLine === null
          ? "missing_line_range"
          : isBroadNoise
            ? "broad_scope_follow_up"
            : "verify_candidate_excerpt",
      toolId: "read_file_slice",
    }));

    const traceFallbackSignal: CodebaseExploreFallbackSignal | null =
      status === "degraded" || isBroadNoise
        ? {
            required: true,
            reason:
              status === "degraded"
                ? "query_failed"
                : "broad_scope_requery_recommended",
            suggestedChain: [...DEFAULT_SUGGESTED_CHAIN],
          }
        : null;

    return {
      status,
      scope: [input.scope],
      query: input.query,
      engine: "codegraph",
      command: input.command,
      includePaths: input.includePaths,
      excludePaths: input.excludePaths,
      candidates: keptCandidates,
      followUpReads,
      truncated: limitations.has("result_trimmed"),
      degraded: status === "degraded",
      followUpHints,
      limitations: resultLimitations,
      fallbackSignal: traceFallbackSignal,
      trace: createCodebaseExploreTrace({
        originalQuery: input.originalQuery,
        normalizedQuery: input.query,
        selectedScope: [input.scope],
        includePaths: input.includePaths,
        excludePaths: input.excludePaths,
        internalCommand: input.command,
        resultCount: keptCandidates.length,
        truncated: limitations.has("result_trimmed"),
        limitations: resultLimitations,
        fallbackSignal: traceFallbackSignal,
        verificationReadCount: followUpReads.length,
        durationMs: input.durationMs,
        status:
          status === "ok"
            ? "ok"
            : status === "partial"
              ? "partial"
              : "degraded",
        runtimeStatus: input.runtimeStatus,
      }),
    };
  }
}
