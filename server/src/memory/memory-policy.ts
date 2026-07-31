import type {
  MemoryPatchProposal,
  MemoryRecord,
  MemorySource,
  ValidatedMemoryPatch,
} from "./types.js";

const MAX_PATCHES_PER_TURN = 6;
const MIN_CONFIDENCE = 0.85;
const MIN_CONTENT_LENGTH = 4;
const MAX_CONTENT_LENGTH = 500;
const RESERVED_MARKERS = ["<!-- mira:memory", "<!-- /mira:memory -->"];

const normalizeContent = (value: string) =>
  value.trim().toLocaleLowerCase().replaceAll(/\s+/g, " ");

const mergeSources = (sources: MemorySource[], source: MemorySource) => {
  const next = [...sources];
  const exists = next.some(
    (item) =>
      item.threadId === source.threadId &&
      item.userMessageId === source.userMessageId &&
      item.assistantMessageId === source.assistantMessageId,
  );
  if (!exists) next.push(source);
  return next;
};

const isValidContent = (value: string) => {
  const normalized = value.trim();
  return (
    normalized.length >= MIN_CONTENT_LENGTH &&
    normalized.length <= MAX_CONTENT_LENGTH &&
    !RESERVED_MARKERS.some((marker) => normalized.includes(marker))
  );
};

export const validateMemoryPatchProposals = (input: {
  proposals: MemoryPatchProposal[];
  existing: MemoryRecord[];
  source: MemorySource;
  now?: string;
}): ValidatedMemoryPatch[] => {
  const now = input.now ?? new Date().toISOString();
  const existingById = new Map(input.existing.map((record) => [record.id, record]));
  const existingContents = new Set(
    input.existing.map((record) => normalizeContent(record.content)),
  );
  const acceptedContents = new Set<string>();
  const touchedIds = new Set<string>();
  const validated: ValidatedMemoryPatch[] = [];

  for (const proposal of input.proposals.slice(0, MAX_PATCHES_PER_TURN)) {
    if (
      !Number.isFinite(proposal.confidence) ||
      proposal.confidence < MIN_CONFIDENCE ||
      !proposal.reason.trim()
    ) {
      continue;
    }

    if (proposal.operation === "delete") {
      const target = existingById.get(proposal.targetId);
      if (!target || touchedIds.has(target.id)) continue;
      touchedIds.add(target.id);
      validated.push({
        operation: "delete",
        targetId: target.id,
        reason: proposal.reason.trim(),
      });
      continue;
    }

    if (!isValidContent(proposal.content)) continue;
    const content = proposal.content.trim();
    const normalizedContent = normalizeContent(content);

    if (proposal.operation === "create") {
      if (
        existingContents.has(normalizedContent) ||
        acceptedContents.has(normalizedContent)
      ) {
        continue;
      }
      acceptedContents.add(normalizedContent);
      validated.push({
        operation: "create",
        record: {
          id: `mem_${crypto.randomUUID()}`,
          kind: proposal.kind,
          content,
          sources: [input.source],
          createdAt: now,
          updatedAt: now,
        },
        reason: proposal.reason.trim(),
      });
      continue;
    }

    const target = existingById.get(proposal.targetId);
    if (!target || touchedIds.has(target.id)) continue;
    if (normalizeContent(target.content) === normalizedContent) continue;
    if (acceptedContents.has(normalizedContent)) continue;

    touchedIds.add(target.id);
    acceptedContents.add(normalizedContent);
    validated.push({
      operation: "replace",
      targetId: target.id,
      record: {
        id: target.id,
        kind: proposal.kind,
        content,
        sources: mergeSources(target.sources, input.source),
        createdAt: target.createdAt,
        updatedAt: now,
      },
      reason: proposal.reason.trim(),
    });
  }

  return validated;
};
