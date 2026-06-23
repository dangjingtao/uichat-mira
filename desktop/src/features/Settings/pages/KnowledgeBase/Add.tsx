import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CircleHelp,
  Cpu,
  Eye,
  FileSearch,
  LoaderCircle,
  ScanSearch,
  PartyPopper,
  RotateCcw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import Badge from "@/shared/ui/Badge";
import { message } from "@/shared/ui/Message";
import Card from "@/shared/ui/Card";
import { FileListItem } from "@/shared/ui/FileListItem";
import { FileUploadDropzone } from "@/shared/ui/FileUploadDropzone";
import { NumberInput, TextArea, TextInput } from "@/shared/ui/Input";
import { Select } from "@/shared/ui/Select";
import { StepIndicator } from "@/shared/ui/StepIndicator";
import Switch from "@/shared/ui/Switch";
import Tooltip from "@/shared/ui/Tooltip";
import type { RoleModelConfig } from "@/shared/api/modelSettings";
import {
  getKnowledgeBaseDocumentStatus,
  previewKnowledgeBaseChunks,
  type ChunkPreviewResult,
  type ChunkingConfig,
  type KnowledgeBaseDocument,
  uploadKnowledgeBaseDocument,
} from "@/shared/api/knowledgeBase";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import SettingsNotice from "../../components/SettingsNotice";

type UploadStep = 1 | 2 | 3;

type UploadFileItem = {
  id: string;
  file: File;
  name: string;
  extension: string;
  size: number;
};

const initialSettings: ChunkingConfig = {
  splitterType: "recursive",
  chunkSize: 1024,
  chunkOverlap: 50,
  keepSeparator: true,
  separator: "\\n\\n",
  separators: ["\\n\\n", "\\n", " ", ""],
  presetLanguage: "markdown",
  encodingName: "cl100k_base",
  allowedSpecial: [],
  disallowedSpecial: "all",
  lengthMetric: "characters",
  replaceWhitespace: true,
  removeUrls: false,
  useQaSplit: false,
};

const initialFiles: UploadFileItem[] = [];
const maxUploadFileSize = 100 * 1024 * 1024;
const pollingIntervalMs = 1500;
const pollingTimeoutMs = 10 * 60 * 1000;

function FieldHelpLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="mb-1 flex h-5 items-center gap-1.5 text-xs font-medium text-text-secondary">
      <span>{label}</span>
      <Tooltip text={hint} placement="top">
        <span className="text-icon-secondary">
          <CircleHelp className="h-3.5 w-3.5" />
        </span>
      </Tooltip>
    </div>
  );
}

function SwitchField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="min-w-0">
      <FieldHelpLabel label={label} hint={hint} />
      <Card className="flex h-8 items-center justify-between gap-3 px-2.5 py-0 text-sm text-text-primary">
        <span className="min-w-0 truncate">{label}</span>
        <Switch
          checked={checked}
          onChange={onChange}
          ariaLabel={label}
          size="sm"
        />
      </Card>
    </div>
  );
}

function ModelAccessStatusPill({
  label,
  connected,
}: {
  label: string;
  connected: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Badge variant={connected ? "success" : "danger"} size="md">
      {label}：
      {connected
        ? t("settings.knowledgeBase.add.connected")
        : t("settings.knowledgeBase.add.notConnected")}
    </Badge>
  );
}

function resolveStep(value: string | null): UploadStep {
  if (value === "2") return 2;
  if (value === "3") return 3;
  return 1;
}

function parseListInput(value: string) {
  return value
    .split(/[\n,，]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ModelStatusCard({
  title,
  description,
  config,
  required = false,
  icon,
}: {
  title: string;
  description: string;
  config: RoleModelConfig | null;
  required?: boolean;
  icon: React.ReactNode;
}) {
  const { t } = useTranslation();
  const configured = Boolean(config?.providerCode && config?.remoteModelId);
  const modelSummary = configured
    ? `${config?.providerCode} · ${config?.name ?? config?.remoteModelId}`
    : null;

  return (
    <Card className="bg-gradient-to-br from-surface-primary to-surface-secondary p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-text-primary">
                {title}
              </div>
              {modelSummary ? (
                <Badge variant="neutral" size="sm">
                  {modelSummary}
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 text-sm leading-6 text-text-secondary">
              {description}
            </div>
          </div>
        </div>
        <Badge
          variant={configured ? "success" : "danger"}
          size="md"
        >
          {configured
            ? t("settings.knowledgeBase.add.configured")
            : required
              ? t("settings.knowledgeBase.add.requiredConfig")
              : t("settings.knowledgeBase.add.notConfigured")}
        </Badge>
      </div>

    </Card>
  );
}

export default function KnowledgeBaseAddWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStep = resolveStep(searchParams.get("step"));
  const knowledgeBaseId = searchParams.get("knowledgeBaseId") || undefined;

  const steps = useMemo(
    () => [
      { step: 1 as UploadStep, label: t("settings.knowledgeBase.add.step1") },
      { step: 2 as UploadStep, label: t("settings.knowledgeBase.add.step2") },
      { step: 3 as UploadStep, label: t("settings.knowledgeBase.add.step3") },
    ],
    [t],
  );

  const splitterHints = useMemo(
    () => ({
      splitterType: t("settings.knowledgeBase.add.hints.splitterType"),
      chunkSize: t("settings.knowledgeBase.add.hints.chunkSize"),
      chunkOverlap: t("settings.knowledgeBase.add.hints.chunkOverlap"),
      keepSeparator: t("settings.knowledgeBase.add.hints.keepSeparator"),
      separator: t("settings.knowledgeBase.add.hints.separator"),
      separators: t("settings.knowledgeBase.add.hints.separators"),
      presetLanguage: t("settings.knowledgeBase.add.hints.presetLanguage"),
      encodingName: t("settings.knowledgeBase.add.hints.encodingName"),
      allowedSpecial: t("settings.knowledgeBase.add.hints.allowedSpecial"),
      disallowedSpecial: t(
        "settings.knowledgeBase.add.hints.disallowedSpecial",
      ),
      lengthMetric: t("settings.knowledgeBase.add.hints.lengthMetric"),
      replaceWhitespace: t(
        "settings.knowledgeBase.add.hints.replaceWhitespace",
      ),
      removeUrls: t("settings.knowledgeBase.add.hints.removeUrls"),
      useQaSplit: t("settings.knowledgeBase.add.hints.useQaSplit"),
    }),
    [t],
  );
  const [settings, setSettings] = useState<ChunkingConfig>(initialSettings);
  const [files, setFiles] = useState<UploadFileItem[]>(initialFiles);
  const [previewChunks, setPreviewChunks] = useState<
    ChunkPreviewResult["sampleChunks"]
  >([]);
  const [previewStats, setPreviewStats] = useState<
    ChunkPreviewResult["stats"] | null
  >(null);
  const [previewFileId, setPreviewFileId] = useState<string>("");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingDone, setProcessingDone] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [createdDocuments, setCreatedDocuments] = useState<
    KnowledgeBaseDocument[]
  >([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const {
    configs: roleConfigs,
    configMap,
    modelAccessStatus,
    refresh,
  } = useRoleModelConfigs();

  const canProceedStep1 = files.length > 0;
  const llmConfig = configMap.llm;
  const embeddingConfig = configMap.embedding;
  const rerankConfig = configMap.rerank;
  const canProceedStep2 = Boolean(
    llmConfig?.providerCode &&
    llmConfig?.remoteModelId &&
    embeddingConfig?.providerCode &&
    embeddingConfig?.remoteModelId,
  );
  const canUploadDocument = modelAccessStatus?.embeddingConnected ?? false;

  const helperText = useMemo(
    () => t("settings.knowledgeBase.add.helperText"),
    [t],
  );
  const activeFile =
    files.find((item) => item.id === previewFileId) ?? files[0] ?? null;
  const effectivePreviewChunks = useMemo(
    () => (previewChunks.length > 0 ? previewChunks : []),
    [previewChunks],
  );

  useEffect(() => {
    if (currentStep !== 2) {
      return;
    }

    void refresh();
  }, [currentStep, refresh]);

  useEffect(() => {
    if (currentStep !== 3) {
      setProcessingProgress(0);
      setProcessingDone(false);
      setProcessingError(null);
      setCreatedDocuments([]);
      return;
    }

    setProcessingProgress(0);
    setProcessingDone(false);
    setProcessingError(null);
    setCreatedDocuments([]);

    let cancelled = false;

    void (async () => {
      try {
        const created: KnowledgeBaseDocument[] = [];

        for (const [index, file] of files.entries()) {
          if (cancelled) {
            return;
          }

          const acceptedDocument = knowledgeBaseId
            ? await uploadKnowledgeBaseDocument(knowledgeBaseId, {
                file: file.file,
                name: file.name,
                fileExt: file.extension.toLowerCase(),
                fileSize: file.size,
                sourceType: "upload",
                sourceLabel: t("settings.knowledgeBase.add.localUpload"),
                enabled: true,
                chunkingConfig: settings,
              })
            : await uploadKnowledgeBaseDocument({
                file: file.file,
                name: file.name,
                fileExt: file.extension.toLowerCase(),
                fileSize: file.size,
                sourceType: "upload",
                sourceLabel: t("settings.knowledgeBase.add.localUpload"),
                enabled: true,
                chunkingConfig: settings,
              });

          if (!cancelled) {
            setProcessingProgress(
              Math.max(10, Math.round(((index + 0.35) / files.length) * 100)),
            );
          }

          const startedAt = Date.now();
          let document = acceptedDocument;

          while (!cancelled && document.indexStatus === "processing") {
            if (Date.now() - startedAt > pollingTimeoutMs) {
              throw new Error(t("settings.knowledgeBase.add.indexTimeout"));
            }

            await new Promise((resolve) =>
              window.setTimeout(resolve, pollingIntervalMs),
            );
            document = knowledgeBaseId
              ? await getKnowledgeBaseDocumentStatus(
                  knowledgeBaseId,
                  acceptedDocument.id,
                )
              : await getKnowledgeBaseDocumentStatus(acceptedDocument.id);
          }

          if (document.indexStatus === "failed") {
            throw new Error(
              document.errorMessage ||
                t("settings.knowledgeBase.add.processFailed"),
            );
          }

          created.push(document);

          if (!cancelled) {
            setCreatedDocuments([...created]);
            setProcessingProgress(
              Math.round(((index + 1) / files.length) * 100),
            );
          }
        }

        if (!cancelled) {
          setProcessingDone(true);
          message.success(t("settings.knowledgeBase.add.uploadSuccess"));
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const errorMessage =
          error instanceof Error
            ? error.message
            : t("settings.knowledgeBase.add.processFailed");
        setProcessingError(errorMessage);
        message.error(errorMessage);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentStep, files, knowledgeBaseId, settings, t]);

  useEffect(() => {
    setPreviewChunks([]);
    setPreviewStats(null);
  }, [activeFile?.id, settings]);

  const appendFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }

    if (selectedFiles.length > 1) {
      message.warning(t("settings.knowledgeBase.add.oneFileOnly"));
      return;
    }

    const oversizedFile = Array.from(selectedFiles).find(
      (file) => file.size > maxUploadFileSize,
    );
    if (oversizedFile) {
      message.warning(t("settings.knowledgeBase.add.fileTooLarge"));
      return;
    }

    if (files.length >= 1) {
      message.warning(t("settings.knowledgeBase.add.removeFirst"));
      return;
    }

    const nextFiles = await Promise.all(
      Array.from(selectedFiles).map(async (file) => ({
        id: `${file.name}-${file.lastModified}`,
        file,
        name: file.name,
        extension: file.name.split(".").pop()?.toUpperCase() ?? "FILE",
        size: file.size,
      })),
    );

    setFiles((current) => {
      if (current.some((existing) => existing.id === nextFiles[0]?.id)) {
        return current;
      }
      return [...current, ...nextFiles];
    });

    if (nextFiles[0]) {
      setPreviewFileId(nextFiles[0].id);
      message.success(t("settings.knowledgeBase.add.fileAdded"));
    }
  };

  const removeFile = (id: string) => {
    setFiles((current) => {
      const nextFiles = current.filter((item) => item.id !== id);
      setPreviewFileId((currentPreviewId) =>
        currentPreviewId === id ? (nextFiles[0]?.id ?? "") : currentPreviewId,
      );
      return nextFiles;
    });
    setPreviewChunks([]);
    message.info(t("settings.knowledgeBase.add.fileRemoved"));
  };

  const goToStep = (step: UploadStep) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("step", `${step}`);
    if (knowledgeBaseId) {
      nextParams.set("knowledgeBaseId", knowledgeBaseId);
    } else {
      nextParams.delete("knowledgeBaseId");
    }
    setSearchParams(nextParams);
  };

  const runPreview = async (successMessage?: string) => {
    const activeFile =
      files.find((item) => item.id === previewFileId) ?? files[0];
    if (!activeFile) {
      message.warning(t("settings.knowledgeBase.add.selectFileToPreview"));
      return false;
    }

    try {
      setPreviewLoading(true);
      const result = await previewKnowledgeBaseChunks({
        file: activeFile.file,
        name: activeFile.name,
        fileExt: activeFile.extension.toLowerCase(),
        fileSize: activeFile.size,
        sourceType: "upload",
        sourceLabel: t("settings.knowledgeBase.add.localUpload"),
        enabled: true,
        chunkingConfig: settings,
      });
      setPreviewChunks(result.sampleChunks);
      setPreviewStats(result.stats);
      message.success(
        successMessage ??
          t("settings.knowledgeBase.add.previewSuccess", {
            count: result.totalChunks,
          }),
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("settings.knowledgeBase.add.previewFailed");
      message.error(errorMessage);
      return false;
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreview = async () => {
    await runPreview();
  };

  const handleResample = async () => {
    await runPreview(t("settings.knowledgeBase.add.resampleSuccess"));
  };

  const renderStepOne = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h1 className="text-base font-semibold text-text-primary">
          {t("settings.knowledgeBase.add.uploadTitle")}
        </h1>
        <p className="text-sm text-text-secondary">
          {t("settings.knowledgeBase.add.uploadDesc")}
        </p>
      </div>

      {modelAccessStatus && !modelAccessStatus.embeddingConnected ? (
        <SettingsNotice tone="danger">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="space-y-2">
            <div className="font-medium">
              {t("settings.knowledgeBase.add.noEmbeddingWarning")}
            </div>
            <div className="flex flex-wrap gap-2">
              <ModelAccessStatusPill
                label={t("settings.knowledgeBase.add.embeddingModel")}
                connected={modelAccessStatus.embeddingConnected}
              />
              <ModelAccessStatusPill
                label={t("settings.knowledgeBase.add.llmModel")}
                connected={modelAccessStatus.llmConnected}
              />
              <ModelAccessStatusPill
                label={t("settings.knowledgeBase.add.rerankModel")}
                connected={modelAccessStatus.rerankConnected}
              />
            </div>
          </div>
        </SettingsNotice>
      ) : null}

      <FileUploadDropzone
        onSelectFiles={appendFiles}
        helperText={
          canUploadDocument
            ? helperText
            : t("settings.knowledgeBase.add.helperTextNoEmbedding")
        }
        maxCount={1}
        accept=".md,.txt"
        disabled={!canUploadDocument}
      />

      <div className="space-y-2.5">
        {files.map((file) => (
          <FileListItem
            key={file.id}
            name={file.name}
            extension={file.extension}
            size={file.size}
            active={previewFileId === file.id}
            onClick={() => setPreviewFileId(file.id)}
            onRemove={() => removeFile(file.id)}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          disabled={!canProceedStep1 || !canUploadDocument}
          onClick={() => canProceedStep1 && canUploadDocument && goToStep(2)}
        >
          {t("settings.knowledgeBase.add.nextStep")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderStepTwo = () => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 2xl:grid 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.82fr)] 2xl:gap-4 2xl:overflow-hidden 2xl:pr-0">
        <div className="min-w-0 2xl:min-h-0 2xl:overflow-y-auto 2xl:pr-1">
          <div className="space-y-3.5 pb-4">
            <section className="space-y-2.5">
              <div className="text-base font-semibold text-text-primary">
                {t("settings.knowledgeBase.add.chunkSettings")}
              </div>
              <Card className="p-4">
                <div className="space-y-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Settings2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-text-primary">
                        {t("settings.knowledgeBase.add.general")}
                      </div>
                      <div className="text-sm text-text-secondary">
                        {t("settings.knowledgeBase.add.generalDesc")}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="min-w-0">
                      <Select
                        label={t("settings.knowledgeBase.add.splitterType")}
                        labelHelp={splitterHints.splitterType}
                        value={settings.splitterType}
                        onChange={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            splitterType:
                              value as ChunkingConfig["splitterType"],
                          }))
                        }
                        options={[
                          {
                            value: "recursive",
                            label: "RecursiveCharacterTextSplitter",
                          },
                          { value: "markdown", label: "MarkdownTextSplitter" },
                          {
                            value: "character",
                            label: "CharacterTextSplitter",
                          },
                          { value: "token", label: "TokenTextSplitter" },
                        ]}
                        compact
                      />
                    </div>
                    <div className="min-w-0">
                      <NumberInput
                        label={`${t("settings.knowledgeBase.add.chunkSize")} (${settings.lengthMetric === "utf8Bytes" ? "bytes" : "characters"})`}
                        labelHelp={splitterHints.chunkSize}
                        value={settings.chunkSize}
                        onChange={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            chunkSize: Number(value) || 0,
                          }))
                        }
                        compact
                      />
                    </div>
                    <div className="min-w-0">
                      <NumberInput
                        label={`${t("settings.knowledgeBase.add.chunkOverlap")} (${settings.lengthMetric === "utf8Bytes" ? "bytes" : "characters"})`}
                        labelHelp={splitterHints.chunkOverlap}
                        value={settings.chunkOverlap}
                        onChange={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            chunkOverlap: Number(value) || 0,
                          }))
                        }
                        compact
                      />
                    </div>
                    <div className="min-w-0">
                      <Select
                        label={t("settings.knowledgeBase.add.lengthMetric")}
                        labelHelp={splitterHints.lengthMetric}
                        value={settings.lengthMetric}
                        onChange={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            lengthMetric:
                              value as ChunkingConfig["lengthMetric"],
                          }))
                        }
                        options={[
                          {
                            value: "characters",
                            label: t("settings.knowledgeBase.add.characters"),
                          },
                          {
                            value: "utf8Bytes",
                            label: t("settings.knowledgeBase.add.utf8Bytes"),
                          },
                        ]}
                        compact
                      />
                    </div>
                    <SwitchField
                      label={t("settings.knowledgeBase.add.keepSeparator")}
                      hint={splitterHints.keepSeparator}
                      checked={settings.keepSeparator}
                      onChange={() =>
                        setSettings((prev) => ({
                          ...prev,
                          keepSeparator: !prev.keepSeparator,
                        }))
                      }
                    />
                    {settings.splitterType === "character" ? (
                      <div className="min-w-0">
                        <TextInput
                          label={t("settings.knowledgeBase.add.separator")}
                          labelHelp={splitterHints.separator}
                          value={settings.separator}
                          onChange={(value) =>
                            setSettings((prev) => ({
                              ...prev,
                              separator: value,
                            }))
                          }
                          compact
                        />
                      </div>
                    ) : null}
                    {settings.splitterType === "recursive" ? (
                      <>
                        <div className="min-w-0">
                          <Select
                            label={t(
                              "settings.knowledgeBase.add.presetLanguage",
                            )}
                            labelHelp={splitterHints.presetLanguage}
                            value={settings.presetLanguage ?? ""}
                            onChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                presetLanguage: value
                                  ? (value as ChunkingConfig["presetLanguage"])
                                  : null,
                              }))
                            }
                            options={[
                              {
                                value: "",
                                label: t("settings.knowledgeBase.add.noPreset"),
                              },
                              { value: "markdown", label: "markdown" },
                              { value: "html", label: "html" },
                              { value: "js", label: "js" },
                              { value: "python", label: "python" },
                              { value: "cpp", label: "cpp" },
                              { value: "go", label: "go" },
                              { value: "java", label: "java" },
                              { value: "php", label: "php" },
                              { value: "proto", label: "proto" },
                              { value: "rst", label: "rst" },
                              { value: "ruby", label: "ruby" },
                              { value: "rust", label: "rust" },
                              { value: "scala", label: "scala" },
                              { value: "swift", label: "swift" },
                              { value: "latex", label: "latex" },
                              { value: "sol", label: "sol" },
                            ]}
                            compact
                          />
                        </div>
                        <div className="min-w-0 md:col-span-2 xl:col-span-3">
                          <TextArea
                            label={t(
                              "settings.knowledgeBase.add.customSeparators",
                            )}
                            labelHelp={splitterHints.separators}
                            rows={4}
                            value={settings.separators.join("\n")}
                            onChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                separators: parseListInput(value),
                              }))
                            }
                            compact
                          />
                        </div>
                      </>
                    ) : null}
                    {settings.splitterType === "token" ? (
                      <>
                        <div className="min-w-0">
                          <TextInput
                            label={t("settings.knowledgeBase.add.encodingName")}
                            labelHelp={splitterHints.encodingName}
                            value={settings.encodingName}
                            onChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                encodingName: value,
                              }))
                            }
                            compact
                          />
                        </div>
                        <div className="min-w-0">
                          <TextInput
                            label={t(
                              "settings.knowledgeBase.add.allowedSpecial",
                            )}
                            labelHelp={splitterHints.allowedSpecial}
                            value={
                              Array.isArray(settings.allowedSpecial)
                                ? settings.allowedSpecial.join(", ")
                                : settings.allowedSpecial
                            }
                            onChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                allowedSpecial:
                                  value.trim() === "all"
                                    ? "all"
                                    : parseListInput(value),
                              }))
                            }
                            compact
                          />
                        </div>
                        <div className="min-w-0">
                          <TextInput
                            label={t(
                              "settings.knowledgeBase.add.disallowedSpecial",
                            )}
                            labelHelp={splitterHints.disallowedSpecial}
                            value={
                              Array.isArray(settings.disallowedSpecial)
                                ? settings.disallowedSpecial.join(", ")
                                : settings.disallowedSpecial
                            }
                            onChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                disallowedSpecial:
                                  value.trim() === "all"
                                    ? "all"
                                    : parseListInput(value),
                              }))
                            }
                            compact
                          />
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="space-y-2.5 border-t border-border pt-4">
                    <div className="text-sm font-medium text-text-primary">
                      {t("settings.knowledgeBase.add.preprocessingRules")}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <SwitchField
                        label={t(
                          "settings.knowledgeBase.add.replaceWhitespace",
                        )}
                        hint={splitterHints.replaceWhitespace}
                        checked={settings.replaceWhitespace}
                        onChange={() =>
                          setSettings((prev) => ({
                            ...prev,
                            replaceWhitespace: !prev.replaceWhitespace,
                          }))
                        }
                      />
                      <SwitchField
                        label={t("settings.knowledgeBase.add.removeUrls")}
                        hint={splitterHints.removeUrls}
                        checked={settings.removeUrls}
                        onChange={() =>
                          setSettings((prev) => ({
                            ...prev,
                            removeUrls: !prev.removeUrls,
                          }))
                        }
                      />
                      <SwitchField
                        label={t("settings.knowledgeBase.add.useQaSplit")}
                        hint={splitterHints.useQaSplit}
                        checked={settings.useQaSplit}
                        onChange={() =>
                          setSettings((prev) => ({
                            ...prev,
                            useQaSplit: !prev.useQaSplit,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-dashed border-border bg-surface-secondary/70 px-3.5 py-3 text-xs leading-5 text-text-secondary">
                    {t("settings.knowledgeBase.add.tip")}
                  </div>

                  <div className="flex items-center gap-2.5 border-t border-border pt-4">
                    <Button
                      variant="secondary"
                      onClick={() => void handlePreview()}
                      disabled={previewLoading}
                    >
                      <Eye className="h-4 w-4" />
                      {previewLoading
                        ? t("settings.knowledgeBase.add.previewing")
                        : t("settings.knowledgeBase.add.preview")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => void handleResample()}
                      disabled={previewLoading}
                    >
                      <Sparkles className="h-4 w-4" />
                      {t("settings.knowledgeBase.add.resample")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSettings(initialSettings);
                        setPreviewChunks([]);
                        setPreviewStats(null);
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t("settings.knowledgeBase.add.reset")}
                    </Button>
                  </div>
                </div>
              </Card>
            </section>

            <section className="space-y-2.5">
              <div className="text-base font-semibold text-text-primary">
                {t("settings.knowledgeBase.add.modelConfig")}
              </div>
              <div className="space-y-2.5">
                <ModelStatusCard
                  title={t("settings.knowledgeBase.add.llmTitle")}
                  description="用于回答生成。当前步骤要求已经完成 LLM 配置。"
                  config={llmConfig}
                  required
                  icon={<Bot className="h-5 w-5" />}
                />
                <ModelStatusCard
                  title={t("settings.knowledgeBase.add.embeddingTitle")}
                  description="用于向量化和语义检索。当前步骤要求已经完成 Embedding 配置。"
                  config={embeddingConfig}
                  required
                  icon={<Cpu className="h-5 w-5" />}
                />
                <ModelStatusCard
                  title={t("settings.knowledgeBase.add.rerankTitle")}
                  description="用于结果精排，可选配置。"
                  config={rerankConfig}
                  icon={<ScanSearch className="h-5 w-5" />}
                />
              </div>
            </section>
          </div>
        </div>

        <div className="min-w-0 2xl:min-h-0">
          <Card className="flex min-h-[260px] flex-col p-0 2xl:h-full 2xl:min-h-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text-primary">
                  {t("settings.knowledgeBase.add.previewTitle")}
                </div>
                <div className="mt-1 truncate text-sm text-text-secondary">
                  {files.find((item) => item.id === previewFileId)?.name ??
                    files[0]?.name ??
                    t("settings.knowledgeBase.add.noFileSelected")}
                </div>
              </div>
              <Badge variant="neutral" size="md" className="ml-3 shrink-0">
                {previewStats
                  ? t("settings.knowledgeBase.add.sampleCount", {
                      current: previewChunks.length,
                      total: previewStats.totalChunks,
                    })
                  : t("settings.knowledgeBase.add.previewCount", {
                      count: previewChunks.length,
                    })}
              </Badge>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
              {previewChunks.length === 0 ? (
                <Card
                  variant="dashed"
                  className="px-4 py-10 text-sm leading-6 text-text-secondary"
                >
                  {t("settings.knowledgeBase.add.previewPlaceholder")}
                </Card>
              ) : (
                <div className="space-y-3">
                  {previewStats ? (
                    <Card
                      variant="subtle"
                      className="grid gap-2 p-3.5 text-xs text-text-secondary md:grid-cols-2"
                    >
                      <div>
                        {t("settings.knowledgeBase.add.totalChunks")}：
                        {previewStats.totalChunks}
                      </div>
                      <div>
                        {t("settings.knowledgeBase.add.avgLength")}：
                        {previewStats.averageChunkLength}
                      </div>
                      <div>
                        {t("settings.knowledgeBase.add.minLength")}：
                        {previewStats.minChunkLength}
                      </div>
                      <div>
                        {t("settings.knowledgeBase.add.maxLength")}：
                        {previewStats.maxChunkLength}
                      </div>
                    </Card>
                  ) : null}
                  {previewChunks.map((chunk) => (
                    <Card
                      key={chunk.id}
                      variant="subtle"
                      className="min-w-0 p-3.5"
                    >
                      <div className="mb-2 text-sm font-medium text-primary">
                        Chunk-{chunk.index} · {chunk.charCount} characters
                      </div>
                      <div className="overflow-hidden break-words text-sm leading-6 text-text-primary">
                        {chunk.text}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border bg-surface-primary pt-4">
        <Button variant="ghost" onClick={() => goToStep(1)}>
          <ArrowLeft className="h-4 w-4" />
          {t("settings.knowledgeBase.add.prevStep")}
        </Button>

        <Button
          disabled={!canProceedStep2}
          onClick={() => {
            if (!canProceedStep2) {
              message.warning(t("settings.knowledgeBase.add.needConfig"));
              return;
            }
            goToStep(3);
          }}
        >
          {t("settings.knowledgeBase.add.nextStep")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderStepThree = () => {
    const totalChunks =
      createdDocuments.reduce(
        (sum, document) => sum + document.chunkCount,
        0,
      ) || effectivePreviewChunks.length;

    if (processingDone) {
      return (
        <div className="flex min-h-[400px] items-center justify-center">
          <Card className="w-full max-w-2xl px-6 py-8 text-center shadow-shadow-md">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
              <PartyPopper className="h-8 w-8" />
            </div>
            <div className="mt-5 text-2xl font-semibold text-text-primary">
              {t("settings.knowledgeBase.add.processComplete")}
            </div>
            <p className="mx-auto mt-2.5 max-w-xl text-sm leading-6 text-text-secondary">
              {t("settings.knowledgeBase.add.processCompleteDesc", {
                fileName:
                  createdDocuments[0]?.name ??
                  activeFile?.name ??
                  t("settings.knowledgeBase.add.knowledgeDoc"),
              })}
            </p>

            <Card variant="subtle" className="mt-5 px-4 py-3.5 text-left">
              <div className="grid gap-2.5 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-text-tertiary">
                    {t("settings.knowledgeBase.add.fileCount")}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">
                    {files.length}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-text-tertiary">
                    {t("settings.knowledgeBase.add.textChunks")}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">
                    {totalChunks}
                  </div>
                </div>
              </div>
            </Card>

            <div className="mt-6 flex justify-center">
              <Button size="lg" onClick={() => navigate("/settings/knowledge-base")}>
                {t("settings.knowledgeBase.add.backToManage")}
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    if (processingError) {
      return (
        <div className="flex min-h-[360px] items-center justify-center">
          <Card className="w-full max-w-2xl border-danger-border px-6 py-8 text-center shadow-shadow-md">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <FileSearch className="h-8 w-8" />
            </div>
            <div className="mt-5 text-2xl font-semibold text-text-primary">
              {t("settings.knowledgeBase.add.processFailedTitle")}
            </div>
            <p className="mx-auto mt-2.5 max-w-xl text-sm leading-6 text-text-secondary">
              {processingError}
            </p>

            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => goToStep(2)}>
                {t("settings.knowledgeBase.add.backToPrev")}
              </Button>
              <Button onClick={() => navigate("/settings/knowledge-base")}>
                {t("settings.knowledgeBase.add.backToManage")}
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[1.6fr_0.8fr]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold text-text-primary">
                {t("settings.knowledgeBase.add.documentUploaded")}
              </h1>
              <p className="text-sm text-text-secondary">
                {t("settings.knowledgeBase.add.uploadingDesc")}
              </p>
            </div>

            <Card className="p-4">
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 text-base font-semibold text-text-primary">
                  <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                  {t("settings.knowledgeBase.add.processing")}
                </div>

                <Card variant="subtle" className="p-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text-primary">
                        {files[createdDocuments.length]?.name ??
                          activeFile?.name ??
                          t("settings.knowledgeBase.add.knowledgeDoc")}
                      </div>
                      <div className="mt-1 text-xs text-text-secondary">
                        {t("settings.knowledgeBase.add.filesCompleted", {
                          completed: createdDocuments.length,
                          total: files.length,
                        })}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-text-secondary">
                      {processingProgress}%
                    </div>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-surface-primary">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${processingProgress}%` }}
                    />
                  </div>
                </Card>

                <div className="grid gap-y-2.5 border-t border-border pt-3.5 md:grid-cols-[148px_1fr]">
                  <div className="text-sm text-text-secondary">
                    {t("settings.knowledgeBase.add.chunkMode")}
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    {t("settings.knowledgeBase.add.general")}
                  </div>

                  <div className="text-sm text-text-secondary">
                    {t("settings.knowledgeBase.add.maxChunkSize")}
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    {settings.chunkSize}
                  </div>

                  <div className="text-sm text-text-secondary">
                    {t("settings.knowledgeBase.add.preprocessingLabel")}
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    {[
                      settings.replaceWhitespace
                        ? t("settings.knowledgeBase.add.ruleReplaceWhitespace")
                        : null,
                      settings.removeUrls
                        ? t("settings.knowledgeBase.add.ruleRemoveUrls")
                        : null,
                      settings.useQaSplit
                        ? t("settings.knowledgeBase.add.ruleQaSplit")
                        : null,
                    ]
                      .filter(Boolean)
                      .join(", ") ||
                      t("settings.knowledgeBase.add.noExtraRules")}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card className="flex h-fit flex-col justify-between p-5">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="mt-4 text-xl font-semibold text-text-primary">
                {t("settings.knowledgeBase.add.whatsNext")}
              </div>
              <p className="mt-2.5 text-sm leading-6 text-text-secondary">
                {t("settings.knowledgeBase.add.whatsNextDesc")}
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1180px] flex-col gap-4 overflow-hidden px-4 py-5">
      <div className="shrink-0 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => navigate("/settings/knowledge-base")}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("settings.knowledgeBase.add.backToKnowledgeBase")}
        </Button>
      </div>

      <div className="shrink-0">
        <StepIndicator currentStep={currentStep} steps={steps} />
      </div>

      <Card className="min-h-0 flex-1 overflow-hidden px-4 py-5 shadow-shadow-sm xl:px-5">
        <div
          className={
            currentStep === 2
              ? "h-full min-h-0 overflow-hidden"
              : "h-full min-h-0 overflow-y-auto"
          }
        >
          {currentStep === 1 ? renderStepOne() : null}
          {currentStep === 2 ? renderStepTwo() : null}
          {currentStep === 3 ? renderStepThree() : null}
        </div>
      </Card>
    </div>
  );
}
