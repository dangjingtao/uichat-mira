"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, message } from "@/shared/ui";
import { generateThreadContextSummary, updateThread } from "@/shared/api/thread";

export interface ThreadContextSummaryModalContentProps {
  threadId: string;
  initialSummary: string | null;
  initialUpdatedAt: string | null;
  onSaved: (input: {
    contextSummary: string | null;
    contextSummaryUpdatedAt: string | null;
  }) => void;
  onClose: () => void;
}

export default function ThreadContextSummaryModalContent({
  threadId,
  initialSummary,
  initialUpdatedAt,
  onSaved,
  onClose,
}: ThreadContextSummaryModalContentProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialSummary ?? "");
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [isGenerating, setGenerating] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [isClearing, setClearing] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateThreadContextSummary(threadId);
      setDraft(result.contextSummary ?? "");
      setUpdatedAt(result.contextSummaryUpdatedAt);
      onSaved(result);
      message.success(t("chat.thread.contextSummary.generated"));
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("chat.thread.contextSummary.generateFailed"),
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const normalized = draft.trim();
      const result = await updateThread(threadId, {
        contextSummary: normalized || null,
      });
      const next = {
        contextSummary: result.contextSummary,
        contextSummaryUpdatedAt: result.contextSummaryUpdatedAt,
      };
      setDraft(next.contextSummary ?? "");
      setUpdatedAt(next.contextSummaryUpdatedAt);
      onSaved(next);
      message.success(t("chat.thread.contextSummary.saved"));
      onClose();
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("chat.thread.contextSummary.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const result = await updateThread(threadId, {
        contextSummary: null,
      });
      const next = {
        contextSummary: result.contextSummary,
        contextSummaryUpdatedAt: result.contextSummaryUpdatedAt,
      };
      setDraft("");
      setUpdatedAt(next.contextSummaryUpdatedAt);
      onSaved(next);
      message.success(t("chat.thread.contextSummary.cleared"));
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("chat.thread.contextSummary.clearFailed"),
      );
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-text-primary">
          {t("chat.thread.contextSummary.modalTitle")}
        </div>
        <p className="text-sm text-text-secondary">
          {t("chat.thread.contextSummary.description")}
        </p>
        <div className="text-xs text-text-tertiary">
          {updatedAt
            ? t("chat.thread.contextSummary.updatedAt", { value: updatedAt })
            : t("chat.thread.contextSummary.notGenerated")}
        </div>
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="min-h-[220px] w-full resize-y rounded-[16px] border border-border bg-surface-secondary px-4 py-3 text-sm leading-6 text-text-primary outline-none focus:border-primary/40"
        placeholder={t("chat.thread.contextSummary.placeholder")}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-text-tertiary">
          {t("chat.thread.contextSummary.requestOnlyHint")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleClear()}
            disabled={isClearing || isSaving || isGenerating}
          >
            {t("chat.thread.contextSummary.clear")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleGenerate()}
            disabled={isGenerating || isSaving}
          >
            {isGenerating
              ? t("chat.thread.contextSummary.generating")
              : t("chat.thread.contextSummary.generate")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSave()}
            disabled={isSaving || isGenerating}
          >
            {isSaving
              ? t("chat.thread.contextSummary.saving")
              : t("chat.thread.contextSummary.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
