import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import {
  generateEvaluationPackage,
  type EvaluationMode,
} from "@/shared/api/evaluation";
import { Button } from "@/shared/ui/Button";
import { NumberInput, TextInput } from "@/shared/ui/Input";
import { message } from "@/shared/ui/Message";
import { Select } from "@/shared/ui/Select";
import { getProviderLabel } from "@/shared/providerCatalog";

interface EvaluationPackageGeneratorModalProps {
  onClose: () => void;
}

type FormState = {
  datasetName: string;
  sampleCount: number;
  documentCount: number;
  chunksPerDocument: number;
  mode: EvaluationMode;
  topK: number;
  topN: number;
  repeat: number;
  concurrency: number;
  timeoutSeconds: number;
};

const createDefaultForm = (): FormState => ({
  datasetName: `evaluation-pack-${new Date().toLocaleDateString("sv-SE")}`,
  sampleCount: 8,
  documentCount: 4,
  chunksPerDocument: 2,
  mode: "retrieve-generate",
  topK: 8,
  topN: 3,
  repeat: 1,
  concurrency: 1,
  timeoutSeconds: 300,
});

export default function EvaluationPackageGeneratorModal({
  onClose,
}: EvaluationPackageGeneratorModalProps) {
  const { t } = useTranslation();
  const { configMap } = useRoleModelConfigs();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(createDefaultForm);

  const evaluationConfig = configMap.evaluation;
  const hasEvaluationModel = Boolean(
    evaluationConfig?.providerCode && evaluationConfig?.remoteModelId,
  );
  const evaluationProviderLabel = evaluationConfig?.providerCode
    ? getProviderLabel(evaluationConfig.providerCode)
    : t("settings.evaluation.packageGenerator.notConfigured");

  const handleDownload = async () => {
    if (!hasEvaluationModel) {
      message.warning(
        t(
          "settings.evaluation.packageGenerator.messages.configureEvaluationModel",
        ),
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await generateEvaluationPackage(form);
      const url = window.URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success(
        t("settings.evaluation.packageGenerator.messages.generated"),
      );
      onClose();
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.evaluation.packageGenerator.messages.failed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface-secondary px-3.5 py-3 text-xs leading-5 text-text-secondary">
        {`${evaluationProviderLabel} · ${
          evaluationConfig?.name ||
          t("settings.evaluation.packageGenerator.configureModelFirst")
        } : ${t("settings.evaluation.packageGenerator.summary")}`}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TextInput
          label={t("settings.evaluation.packageGenerator.datasetName")}
          labelHelp={t("settings.evaluation.packageGenerator.help.datasetName")}
          value={form.datasetName}
          onChange={(datasetName) =>
            setForm((previous) => ({ ...previous, datasetName }))
          }
          disabled={submitting}
        />

        <NumberInput
          label={t("settings.evaluation.packageGenerator.sampleCount")}
          labelHelp={t("settings.evaluation.packageGenerator.help.sampleCount")}
          value={form.sampleCount}
          onChange={(sampleCount) =>
            setForm((previous) => ({
              ...previous,
              sampleCount: Number.isFinite(sampleCount)
                ? sampleCount
                : previous.sampleCount,
            }))
          }
          disabled={submitting}
        />
        <NumberInput
          label={t("settings.evaluation.packageGenerator.documentCount")}
          labelHelp={t(
            "settings.evaluation.packageGenerator.help.documentCount",
          )}
          value={form.documentCount}
          onChange={(documentCount) =>
            setForm((previous) => ({
              ...previous,
              documentCount: Number.isFinite(documentCount)
                ? documentCount
                : previous.documentCount,
            }))
          }
          disabled={submitting}
        />
        <NumberInput
          label={t("settings.evaluation.packageGenerator.chunksPerDocument")}
          labelHelp={t(
            "settings.evaluation.packageGenerator.help.chunksPerDocument",
          )}
          value={form.chunksPerDocument}
          onChange={(chunksPerDocument) =>
            setForm((previous) => ({
              ...previous,
              chunksPerDocument: Number.isFinite(chunksPerDocument)
                ? chunksPerDocument
                : previous.chunksPerDocument,
            }))
          }
          disabled={submitting}
        />

        <Select
          label={t("settings.evaluation.packageGenerator.mode")}
          labelHelp={t("settings.evaluation.packageGenerator.help.mode")}
          value={form.mode}
          onChange={(mode) =>
            setForm((previous) => ({
              ...previous,
              mode: mode as EvaluationMode,
            }))
          }
          options={[
            {
              value: "retrieve-generate",
              label: t(
                "settings.evaluation.packageGenerator.modeRetrieveGenerate",
              ),
            },
            {
              value: "retrieve",
              label: t("settings.evaluation.packageGenerator.modeRetrieve"),
            },
          ]}
          disabled={submitting}
        />

        <NumberInput
          label="TopK"
          labelHelp={t("settings.evaluation.packageGenerator.help.topK")}
          value={form.topK}
          onChange={(topK) =>
            setForm((previous) => ({
              ...previous,
              topK: Number.isFinite(topK) ? topK : previous.topK,
            }))
          }
          disabled={submitting}
        />
        <NumberInput
          label="TopN"
          labelHelp={t("settings.evaluation.packageGenerator.help.topN")}
          value={form.topN}
          onChange={(topN) =>
            setForm((previous) => ({
              ...previous,
              topN: Number.isFinite(topN) ? topN : previous.topN,
            }))
          }
          disabled={submitting}
        />
        <NumberInput
          label="Repeat"
          labelHelp={t("settings.evaluation.packageGenerator.help.repeat")}
          value={form.repeat}
          onChange={(repeat) =>
            setForm((previous) => ({
              ...previous,
              repeat: Number.isFinite(repeat) ? repeat : previous.repeat,
            }))
          }
          disabled={submitting}
        />
        <NumberInput
          label={t("settings.evaluation.packageGenerator.concurrency")}
          labelHelp={t("settings.evaluation.packageGenerator.help.concurrency")}
          value={form.concurrency}
          onChange={(concurrency) =>
            setForm((previous) => ({
              ...previous,
              concurrency: Number.isFinite(concurrency)
                ? concurrency
                : previous.concurrency,
            }))
          }
          disabled={submitting}
        />
        <NumberInput
          label={t("settings.evaluation.packageGenerator.timeoutSeconds")}
          labelHelp={t(
            "settings.evaluation.packageGenerator.help.timeoutSeconds",
          )}
          value={form.timeoutSeconds}
          onChange={(timeoutSeconds) =>
            setForm((previous) => ({
              ...previous,
              timeoutSeconds: Number.isFinite(timeoutSeconds)
                ? timeoutSeconds
                : previous.timeoutSeconds,
            }))
          }
          disabled={submitting}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          onClick={() => void handleDownload()}
          disabled={submitting || !hasEvaluationModel}
        >
          {submitting
            ? t("settings.evaluation.packageGenerator.generating")
            : t("settings.evaluation.packageGenerator.generateAndDownload")}
        </Button>
      </div>
    </div>
  );
}
