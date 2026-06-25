import type { TFunction } from "i18next";
import type { RoleDraft, RoleLlmProfile, RoleStatus } from "./types";

export interface RoleFormErrors {
  name?: string;
  summary?: string;
}

export interface RoleFormDraft {
  name: string;
  summary: string;
  prompt: RoleDraft;
}

export interface RolePreviewChatReplyInput {
  roleSummary: string;
  persona: string;
  scenario: string;
  style: string;
  constraints: string;
  testInput: string;
}

const LLM_PROFILE_KEYS = [
  "temperature",
  "topP",
  "topK",
  "maxTokens",
  "frequencyPenalty",
  "presencePenalty",
] as const;

export function normalizeLlmProfile(
  profile: RoleLlmProfile | undefined,
): RoleLlmProfile {
  const nextProfile = profile ?? {};
  const normalized: RoleLlmProfile = {};

  for (const key of LLM_PROFILE_KEYS) {
    const value = nextProfile[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      normalized[key] = value;
    }
  }

  return normalized;
}

export function patchLlmProfileNumber(
  profile: RoleLlmProfile,
  key: keyof RoleLlmProfile,
  rawValue: string,
): RoleLlmProfile {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    const { [key]: _removed, ...rest } = profile;
    return rest;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return profile;
  }

  return {
    ...profile,
    [key]: parsed,
  };
}

export function summarizeLlmProfile(
  t: TFunction,
  profile: RoleLlmProfile,
): string {
  const normalized = normalizeLlmProfile(profile);
  const summaryParts = [
    typeof normalized.temperature === "number"
      ? `${t("llmProfile.fields.temperature.label")} ${normalized.temperature}`
      : null,
    typeof normalized.topP === "number"
      ? `${t("llmProfile.fields.topP.label")} ${normalized.topP}`
      : null,
    typeof normalized.topK === "number"
      ? `${t("llmProfile.fields.topK.label")} ${normalized.topK}`
      : null,
    typeof normalized.maxTokens === "number"
      ? `${t("llmProfile.fields.maxTokens.label")} ${normalized.maxTokens}`
      : null,
    typeof normalized.frequencyPenalty === "number"
      ? `${t("llmProfile.fields.frequencyPenalty.label")} ${normalized.frequencyPenalty}`
      : null,
    typeof normalized.presencePenalty === "number"
      ? `${t("llmProfile.fields.presencePenalty.label")} ${normalized.presencePenalty}`
      : null,
  ].filter((value): value is string => Boolean(value));

  if (summaryParts.length === 0) {
    return t("llmProfile.empty");
  }

  return summaryParts.slice(0, 3).join(" · ");
}

export function buildRolePreviewChatReply(
  t: TFunction,
  input: RolePreviewChatReplyInput,
) {
  const trimmedSummary = summarizeField(input.roleSummary, "");
  const trimmedPersona = summarizeField(input.persona, "");
  const trimmedScenario = summarizeField(input.scenario, "");
  const trimmedStyle = summarizeField(input.style, "");
  const trimmedConstraints = summarizeField(input.constraints, "");
  const trimmedInput = input.testInput.trim();

  const lines = [t("preview.chatView.replyIntro")];

  if (trimmedSummary) {
    lines.push(t("preview.chatView.replySummary", { summary: trimmedSummary }));
  }

  if (trimmedScenario) {
    lines.push(
      t("preview.chatView.replyScenario", { scenario: trimmedScenario }),
    );
  }

  if (trimmedInput) {
    lines.push(t("preview.chatView.replyTask", { input: trimmedInput }));
  }

  if (trimmedPersona) {
    lines.push(t("preview.chatView.replyPersona", { persona: trimmedPersona }));
  }

  if (trimmedStyle) {
    lines.push(t("preview.chatView.replyStyle", { style: trimmedStyle }));
  }

  if (trimmedConstraints) {
    lines.push(
      t("preview.chatView.replyConstraint", {
        constraints: trimmedConstraints,
      }),
    );
  }

  lines.push(t("preview.chatView.replyClosing"));

  return lines.join("\n\n");
}

export function statusTone(status: RoleStatus) {
  if (status === "draft") return "muted" as const;
  return "primary" as const;
}

export function isDraftStatus(status: RoleStatus) {
  return status === "draft";
}

export function getStatusLabel(t: TFunction, status: RoleStatus) {
  if (!isDraftStatus(status)) {
    return t("status.published");
  }
  return t("status.draft");
}

export function summarizeField(value: string, emptyText: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return emptyText;
  }

  return compact.length > 96 ? `${compact.slice(0, 96).trim()}...` : compact;
}

export function estimateTokenCount(value: string) {
  const compact = value.trim();
  if (!compact) {
    return 0;
  }

  const cjkMatches = compact.match(/[\u4e00-\u9fff]/g) ?? [];
  const latinMatches =
    compact.replace(/[\u4e00-\u9fff]/g, " ").match(/[A-Za-z0-9_]+/g) ?? [];

  return Math.max(
    1,
    Math.round(cjkMatches.length * 1.1 + latinMatches.join(" ").length / 4),
  );
}

export function validateRoleForm(
  t: TFunction,
  draft: RoleFormDraft,
): RoleFormErrors {
  const errors: RoleFormErrors = {};

  const trimmedName = draft.name.trim();
  if (!trimmedName) {
    errors.name = t("form.errors.nameRequired");
  } else if (trimmedName.length > 50) {
    errors.name = t("form.errors.nameTooLong", { max: 50 });
  }

  if (draft.summary.trim().length > 120) {
    errors.summary = t("form.errors.summaryTooLong", { max: 120 });
  }

  return errors;
}

export function isCoreContentEmpty(draft: RoleFormDraft): boolean {
  return (
    !draft.prompt.description.trim() &&
    !draft.prompt.persona.trim() &&
    !draft.prompt.scenario.trim()
  );
}
