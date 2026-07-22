import path from "node:path";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import type {
  SkillManifest,
  SkillMatchCandidate,
  SkillMatchResult,
  SkillMatchSource,
} from "./types.js";

const FILE_KIND_BY_EXTENSION: Record<string, string> = {
  ".docx": "docx",
  ".doc": "docx",
  ".xlsx": "xlsx",
  ".xls": "xlsx",
  ".csv": "xlsx",
  ".pdf": "pdf",
  ".pptx": "pptx",
  ".ppt": "pptx",
};

const FILE_KIND_BY_MIME: Array<[RegExp, string]> = [
  [/wordprocessingml|msword/i, "docx"],
  [/spreadsheetml|ms-excel|text\/csv/i, "xlsx"],
  [/application\/pdf/i, "pdf"],
  [/presentationml|ms-powerpoint/i, "pptx"],
];

const SEMANTIC_HINTS: Record<string, Array<{ pattern: RegExp; weight: number; label: string }>> = {
  docx: [
    { pattern: /\bdocx?\b|\bword\b/i, weight: 0.9, label: "Word/DOCX" },
    { pattern: /合同审阅|word\s*批注|修订模式|track\s*changes/i, weight: 0.92, label: "DOCX review" },
    { pattern: /批注|修订|文档审阅/i, weight: 0.42, label: "document review" },
  ],
  xlsx: [
    { pattern: /\bxlsx?\b|\bexcel\b/i, weight: 0.9, label: "Excel/XLSX" },
    { pattern: /\bdcf\b|三表模型|可比公司|\bcomps\b|财务模型/i, weight: 0.96, label: "financial model" },
    { pattern: /电子表格|工作簿|spreadsheet/i, weight: 0.72, label: "spreadsheet" },
  ],
  pdf: [
    { pattern: /\bpdf\b/i, weight: 0.92, label: "PDF" },
    { pattern: /合并.*pdf|拆分.*pdf|pdf.*合并|pdf.*拆分|pdf表单/i, weight: 0.96, label: "PDF processing" },
  ],
  pptx: [
    { pattern: /\bpptx?\b|powerpoint/i, weight: 0.92, label: "PowerPoint/PPTX" },
    { pattern: /幻灯片|演示文稿|路演.*(?:ppt|演示)|deck\b/i, weight: 0.82, label: "presentation" },
  ],
};

const normalizeId = (value: string) => value.trim().toLowerCase();

const makeCandidate = (input: {
  skillId: string;
  score: number;
  reason: string;
  source: SkillMatchSource;
}): SkillMatchCandidate => ({ ...input });

const getLatestUserMessage = (messages: NormalizedChatMessage[]) =>
  [...messages].reverse().find((message) => message.role === "user");

const detectAttachmentSkillIds = (messages: NormalizedChatMessage[]) => {
  const message = getLatestUserMessage(messages);
  const result: string[] = [];
  for (const part of message?.parts ?? []) {
    if (part.type !== "file" && part.type !== "image") continue;
    const filename = part.filename?.trim();
    if (filename) {
      const byExtension = FILE_KIND_BY_EXTENSION[path.extname(filename).toLowerCase()];
      if (byExtension && !result.includes(byExtension)) result.push(byExtension);
    }
    const mimeType = part.type === "file" ? part.mimeType : part.mediaType;
    if (mimeType) {
      const byMime = FILE_KIND_BY_MIME.find(([pattern]) => pattern.test(mimeType))?.[1];
      if (byMime && !result.includes(byMime)) result.push(byMime);
    }
  }
  return result;
};

const matchExplicit = (query: string, manifests: SkillManifest[]) => {
  const explicit =
    /(?:^|\s)\$([a-z0-9_-]+)/i.exec(query)?.[1] ??
    /(?:^|\s)\/skill:([a-z0-9_-]+)/i.exec(query)?.[1];
  if (!explicit) return null;
  const normalized = normalizeId(explicit);
  const manifest = manifests.find(
    (candidate) => normalizeId(candidate.id) === normalized || normalizeId(candidate.name) === normalized,
  );
  return manifest
    ? makeCandidate({
        skillId: manifest.id,
        score: 1,
        source: "explicit",
        reason: `Explicit skill trigger: ${explicit}`,
      })
    : null;
};

const semanticCandidates = (query: string, manifests: SkillManifest[]) => {
  const candidates: SkillMatchCandidate[] = [];
  for (const manifest of manifests) {
    let score = 0;
    const reasons: string[] = [];
    const normalizedQuery = query.toLowerCase();
    if (normalizedQuery.includes(manifest.id.toLowerCase())) {
      score = Math.max(score, 0.82);
      reasons.push(`matched id ${manifest.id}`);
    }
    if (normalizedQuery.includes(manifest.name.toLowerCase())) {
      score = Math.max(score, 0.86);
      reasons.push(`matched name ${manifest.name}`);
    }
    for (const hint of SEMANTIC_HINTS[manifest.id] ?? []) {
      if (!hint.pattern.test(query)) continue;
      score = Math.max(score, hint.weight);
      reasons.push(hint.label);
    }
    if (score >= 0.4) {
      candidates.push(
        makeCandidate({
          skillId: manifest.id,
          score,
          source: score >= 0.8 ? "exact" : "semantic",
          reason: reasons.join(", ") || `semantic hint for ${manifest.id}`,
        }),
      );
    }
  }
  return candidates;
};

export class SkillMatcher {
  match(input: {
    query: string;
    messages: NormalizedChatMessage[];
    manifests: SkillManifest[];
  }): SkillMatchResult {
    const explicit = matchExplicit(input.query, input.manifests);
    if (explicit) return { primary: explicit, secondary: [] };

    const candidates: SkillMatchCandidate[] = [];
    const availableIds = new Set(input.manifests.map((manifest) => manifest.id));
    for (const [index, skillId] of detectAttachmentSkillIds(input.messages).entries()) {
      if (!availableIds.has(skillId)) continue;
      candidates.push(
        makeCandidate({
          skillId,
          score: 0.99 - index * 0.01,
          source: "resource",
          reason: `Matched latest attachment type: ${skillId}`,
        }),
      );
    }
    candidates.push(...semanticCandidates(input.query, input.manifests));

    const bestBySkill = new Map<string, SkillMatchCandidate>();
    for (const candidate of candidates) {
      const current = bestBySkill.get(candidate.skillId);
      if (!current || candidate.score > current.score) bestBySkill.set(candidate.skillId, candidate);
    }

    const sorted = [...bestBySkill.values()].sort((a, b) => b.score - a.score);
    return {
      primary: sorted[0] ?? null,
      secondary: sorted.slice(1),
    };
  }
}
