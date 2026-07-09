import fs from "node:fs";
import path from "node:path";

import { sliceExtractedText } from "@/mcp/document-readers";
import {
  isWindowsAbsolutePath,
  normalizeWorkspaceRelativePathArg,
} from "@/mcp/workspace-path-args";
import type { AgentRetrievalEvidence } from "@/agent/types";
import type {
  CodebaseCandidate,
  CodebaseExploreResult,
  CodebaseExploreTrace,
  CodebaseVerifiedCandidate,
  CodebaseVerificationResult,
  ManagedCodeGraphRuntimeStatus,
} from "./types.js";
import { createCodebaseExploreTrace } from "./codegraph-trace-diagnostics.js";

type VerificationBridgeOptions = {
  workspaceRoot: string;
  maxExcerptLines?: number;
};

const DEFAULT_MAX_EXCERPT_LINES = 24;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

const getSummaryTokens = (summary: string) =>
  normalizeWhitespace(summary)
    .split(/[^a-z0-9_\-/]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);

const buildTracePointer = (candidate: CodebaseCandidate, candidateIndex: number) => ({
  engine: candidate.source.engine,
  command: candidate.source.command,
  candidateIndex,
  path: candidate.path,
});

const createBaseVerifiedCandidate = (candidate: CodebaseCandidate, candidateIndex: number) => ({
  candidateIndex,
  path: candidate.path,
  verifiedPath: null,
  startLine: candidate.startLine,
  endLine: candidate.endLine,
  verifiedStartLine: null,
  verifiedEndLine: null,
  minimalExcerpt: null,
  verifiedSummary: null,
  providerTracePointer: buildTracePointer(candidate, candidateIndex),
  mismatchNotes: [] as string[],
  limitations: [...candidate.limitations],
});

const resolveCandidatePath = (workspaceRoot: string, candidatePath: string) => {
  const trimmed = candidatePath.trim();
  if (!trimmed || isWindowsAbsolutePath(trimmed)) {
    return null;
  }

  const normalized = normalizeWorkspaceRelativePathArg(trimmed);
  if (normalized.type === "reject") {
    return null;
  }

  const relativePath = normalized.value;
  const resolved = path.resolve(workspaceRoot, relativePath);
  const relative = path.relative(workspaceRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return {
    relativePath: relativePath.replace(/\\/g, "/"),
    absolutePath: resolved,
  };
};

const findMismatchNotes = (candidate: CodebaseCandidate, excerpt: string) => {
  const notes: string[] = [];
  const tokens = getSummaryTokens(candidate.summary);
  if (tokens.length === 0) {
    return notes;
  }

  const excerptText = normalizeWhitespace(excerpt);
  const matchedTokenCount = tokens.filter((token) => excerptText.includes(token)).length;
  if (matchedTokenCount === 0) {
    notes.push("provider_summary_mismatch: summary tokens are absent from the verified excerpt.");
  }

  return notes;
};

const verifyCandidate = (
  candidate: CodebaseCandidate,
  candidateIndex: number,
  options: VerificationBridgeOptions,
): CodebaseVerifiedCandidate => {
  const base = createBaseVerifiedCandidate(candidate, candidateIndex);

  if (candidate.startLine === null || candidate.endLine === null) {
    return {
      ...base,
      status: "unverifiable",
      mismatchNotes: ["candidate has no stable line range and cannot be verified."],
    };
  }

  const resolved = resolveCandidatePath(options.workspaceRoot, candidate.path);
  if (!resolved) {
    return {
      ...base,
      status: "rejected",
      mismatchNotes: ["candidate path is outside the allowed workspace boundary."],
    };
  }

  if (!fs.existsSync(resolved.absolutePath)) {
    return {
      ...base,
      status: "rejected",
      verifiedPath: resolved.relativePath,
      mismatchNotes: ["candidate file is missing at verification time."],
    };
  }

  const rawText = fs.readFileSync(resolved.absolutePath, "utf8");
  const excerpt = sliceExtractedText(rawText, {
    startLine: candidate.startLine,
    endLine: candidate.endLine,
    maxLines: options.maxExcerptLines ?? DEFAULT_MAX_EXCERPT_LINES,
  });
  if (!excerpt.text.trim()) {
    return {
      ...base,
      status: "rejected",
      verifiedPath: resolved.relativePath,
      verifiedStartLine: excerpt.startLine,
      verifiedEndLine: excerpt.endLine,
      mismatchNotes: ["candidate excerpt is empty after reading the original file."],
    };
  }

  const mismatchNotes = findMismatchNotes(candidate, excerpt.text);
  if (mismatchNotes.length > 0) {
    return {
      ...base,
      status: "rejected",
      verifiedPath: resolved.relativePath,
      verifiedStartLine: excerpt.startLine,
      verifiedEndLine: excerpt.endLine,
      minimalExcerpt: excerpt.text,
      mismatchNotes,
    };
  }

  return {
    ...base,
    status: "verified",
    verifiedPath: resolved.relativePath,
    verifiedStartLine: excerpt.startLine,
    verifiedEndLine: excerpt.endLine,
    minimalExcerpt: excerpt.text,
    verifiedSummary: candidate.summary,
    mismatchNotes: [],
  };
};

const toManagedRuntimeStatus = (value: string | null | undefined): ManagedCodeGraphRuntimeStatus => {
  switch (value) {
    case "blocked":
    case "starting":
    case "ready":
    case "degraded":
    case "failed":
    case "stopped":
      return value;
    default:
      return "unavailable";
  }
};

export const verifyCodebaseExploreResult = (
  exploreResult: CodebaseExploreResult,
  options: VerificationBridgeOptions,
): CodebaseVerificationResult => {
  const startedAt = Date.now();
  const baseTrace: CodebaseExploreTrace =
    exploreResult.trace ??
    createCodebaseExploreTrace({
      originalQuery: exploreResult.query,
      normalizedQuery: exploreResult.query,
      selectedScope: [...exploreResult.scope],
      includePaths: [...exploreResult.includePaths],
      excludePaths: [...exploreResult.excludePaths],
      internalCommand: exploreResult.command,
      resultCount: exploreResult.candidates.length,
      truncated: exploreResult.truncated,
      limitations: [...exploreResult.limitations],
      fallbackSignal: exploreResult.fallbackSignal,
      verificationReadCount: exploreResult.followUpReads.length,
      durationMs: 0,
      status:
        exploreResult.status === "ok"
          ? "ok"
          : exploreResult.status === "partial"
            ? "partial"
            : "degraded",
      runtimeStatus: null,
    });
  const verified: CodebaseVerifiedCandidate[] = [];
  const rejected: CodebaseVerifiedCandidate[] = [];
  const unverifiable: CodebaseVerifiedCandidate[] = [];

  for (const followUpRead of exploreResult.followUpReads) {
    const candidate = exploreResult.candidates[followUpRead.candidateIndex];
    if (!candidate) {
      continue;
    }

    const result = verifyCandidate(candidate, followUpRead.candidateIndex, options);
    if (result.status === "verified") {
      verified.push(result);
      continue;
    }
    if (result.status === "rejected") {
      rejected.push(result);
      continue;
    }
    unverifiable.push(result);
  }

  return {
    query: exploreResult.query,
    scope: [...exploreResult.scope],
    verified,
    rejected,
    unverifiable,
    verifiedEvidenceInput: {
      query: exploreResult.query,
      chunks: verified.map((entry) => ({
        chunkId: `codegraph:${entry.path}:${entry.verifiedStartLine ?? "na"}-${entry.verifiedEndLine ?? "na"}:${entry.candidateIndex}`,
        documentName: entry.verifiedPath ?? entry.path,
        score: exploreResult.candidates[entry.candidateIndex]?.confidence ?? 0,
        content: entry.minimalExcerpt ?? "",
      })),
    },
    trace: createCodebaseExploreTrace({
      originalQuery: baseTrace.originalQuery,
      normalizedQuery: baseTrace.normalizedQuery,
      selectedScope: [...exploreResult.scope],
      includePaths: [...exploreResult.includePaths],
      excludePaths: [...exploreResult.excludePaths],
      internalCommand: exploreResult.command,
      resultCount: verified.length,
      truncated: exploreResult.truncated,
      limitations: [
        ...exploreResult.limitations,
        ...rejected.flatMap((entry) => entry.limitations),
        ...unverifiable.flatMap((entry) => entry.limitations),
      ],
      fallbackSignal: exploreResult.fallbackSignal,
      verificationReadCount: exploreResult.followUpReads.length,
      durationMs: Date.now() - startedAt,
      status:
        rejected.length > 0 && verified.length === 0
          ? "failed"
          : rejected.length > 0 ||
              unverifiable.length > 0 ||
              exploreResult.trace?.status === "partial"
            ? "partial"
            : baseTrace.status,
      runtimeStatus: {
        providerVersion: baseTrace.providerVersion,
        workspaceHash: baseTrace.workspaceHash,
        status: toManagedRuntimeStatus(baseTrace.indexStatus),
        telemetryStatus: baseTrace.telemetryStatus,
      },
    }),
  };
};

export const toAgentRetrievalEvidenceFromVerification = (
  result: CodebaseVerificationResult,
): AgentRetrievalEvidence => ({
  query: result.query,
  chunkCount: result.verifiedEvidenceInput.chunks.length,
  chunks: result.verifiedEvidenceInput.chunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    documentName: chunk.documentName,
    score: chunk.score,
    content: chunk.content,
  })),
  createdAt: new Date().toISOString(),
});
