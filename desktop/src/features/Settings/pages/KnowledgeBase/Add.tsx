import { useEffect, useMemo, useState } from "react";
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
import { message } from "@/shared/ui/Message";
import Card from "@/shared/ui/Card";
import { FileListItem } from "@/shared/ui/FileListItem";
import { FileUploadDropzone } from "@/shared/ui/FileUploadDropzone";
import {
  NumberInput,
  TextArea,
  TextInput,
} from "@/shared/ui/Input";
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

const steps = [
  { step: 1 as UploadStep, label: "选择数据源" },
  { step: 2 as UploadStep, label: "文本分段与清洗" },
  { step: 3 as UploadStep, label: "处理并完成" },
];

const splitterHints = {
  splitterType:
    "选择 LangChain 文本切块器。不同 splitter 会影响 chunk 的结构、边界和语义保持方式。",
  chunkSize:
    "单个分块允许的最大长度。值越大，上下文更完整；值越小，召回会更细。",
  chunkOverlap: "相邻分块之间保留的重叠长度，用来减少信息被切断的风险。",
  keepSeparator: "保留分隔符通常更利于保留 Markdown、代码或段落边界。",
  separator: "Character splitter 使用的分隔符，例如 \\n\\n。",
  separators: "Recursive splitter 的分隔符优先级列表，逗号或换行分隔。",
  presetLanguage: "Recursive splitter 可以直接套用语言预置分隔规则。",
  encodingName: "Token splitter 使用的编码器名称。",
  allowedSpecial: "允许通过的特殊 token，多个值用逗号分隔。",
  disallowedSpecial: "禁止的特殊 token，默认 all。",
  lengthMetric: "控制 chunkSize / overlap 的长度单位。",
  replaceWhitespace: "清理多余空格、制表符和连续空行，适合大多数 md/txt 文档。",
  removeUrls: "适合知识正文场景；如果链接本身有意义，建议关闭这一项。",
  useQaSplit:
    "优先识别 Q:/A:、问:/答: 这类结构，再进行长度切分，适合 FAQ 文档。",
} as const;

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
      <div className="flex h-8 items-center justify-between gap-3 rounded-lg border border-border bg-surface-primary px-2.5 text-sm text-text-primary shadow-shadow-sm">
        <span className="min-w-0 truncate">{label}</span>
        <Switch
          checked={checked}
          onChange={onChange}
          ariaLabel={label}
          size="sm"
        />
      </div>
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
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        connected ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      {label}：{connected ? "已接入" : "未接入"}
    </span>
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
  const configured = Boolean(config?.providerCode && config?.remoteModelId);

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-surface-primary to-surface-secondary p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary">
              {title}
            </div>
            <div className="mt-1 text-sm leading-6 text-text-secondary">
              {description}
            </div>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            configured
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          }`}
        >
          {configured ? "已配置" : required ? "必须配置" : "未配置"}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-surface-primary px-3.5 py-3 text-sm shadow-shadow-sm">
        <div className="truncate font-medium text-text-primary">
          {config?.name ?? "尚未选择模型"}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-text-secondary">
            {config?.providerCode
              ? `Provider · ${config.providerCode}`
              : "未选择提供商"}
          </span>
          {config?.remoteModelId ? (
            <span className="rounded-full bg-primary/5 px-2.5 py-1 text-primary">
              默认模型
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeBaseAddWizard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStep = resolveStep(searchParams.get("step"));
  const [files, setFiles] = useState<UploadFileItem[]>(initialFiles);
  const [settings, setSettings] = useState<ChunkingConfig>(initialSettings);
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
    () =>
      "已支持 MARKDOWN、TXT，一次只能上传 1 个文件，每个文件不超过 100 MB。",
    [],
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

          const acceptedDocument = await uploadKnowledgeBaseDocument({
            file: file.file,
            name: file.name,
            fileExt: file.extension.toLowerCase(),
            fileSize: file.size,
            sourceType: "upload",
            sourceLabel: "本地上传",
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
              throw new Error(
                "知识文档索引超时，请稍后在知识库列表中查看处理状态",
              );
            }

            await new Promise((resolve) =>
              window.setTimeout(resolve, pollingIntervalMs),
            );
            document = await getKnowledgeBaseDocumentStatus(
              acceptedDocument.id,
            );
          }

          if (document.indexStatus === "failed") {
            throw new Error(document.errorMessage || "知识文档处理失败");
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
          message.success("知识文档已完成入库");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const errorMessage =
          error instanceof Error ? error.message : "知识文档处理失败";
        setProcessingError(errorMessage);
        message.error(errorMessage);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentStep, files, settings]);

  useEffect(() => {
    setPreviewChunks([]);
    setPreviewStats(null);
  }, [activeFile?.id, settings]);

  const appendFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }

    if (selectedFiles.length > 1) {
      message.warning("一次只能上传 1 个文件");
      return;
    }

    const oversizedFile = Array.from(selectedFiles).find(
      (file) => file.size > maxUploadFileSize,
    );
    if (oversizedFile) {
      message.warning("单个文件大小不能超过 100 MB");
      return;
    }

    if (files.length >= 1) {
      message.warning("一次只能上传 1 个文件，请先移除当前文件");
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
      message.success("文件已添加到上传列表");
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
    message.info("已移除文件");
  };

  const goToStep = (step: UploadStep) => {
    setSearchParams({ step: `${step}` });
  };

  const runPreview = async (successMessage = "已生成文本分块预览") => {
    const activeFile =
      files.find((item) => item.id === previewFileId) ?? files[0];
    if (!activeFile) {
      message.warning("请先选择一个文件进行预览");
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
        sourceLabel: "本地上传",
        enabled: true,
        chunkingConfig: settings,
      });
      setPreviewChunks(result.sampleChunks);
      setPreviewStats(result.stats);
      message.success(
        successMessage === "已生成文本分块预览"
          ? `已生成 ${result.totalChunks} 个文本分块预览`
          : successMessage,
      );
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "预览失败";
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
    await runPreview("已换一批样本");
  };

  const renderStepOne = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h1 className="text-base font-semibold text-text-primary">
          上传文本文件
        </h1>
        <p className="text-sm text-text-secondary">
          先选择需要导入知识库的文件。
        </p>
      </div>

      {modelAccessStatus && !modelAccessStatus.embeddingConnected ? (
        <div className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="space-y-2">
            <div className="font-medium">
              当前未接入默认向量模型，暂时无法上传知识库文件。
            </div>
            <div className="flex flex-wrap gap-2">
              <ModelAccessStatusPill
                label="向量模型"
                connected={modelAccessStatus.embeddingConnected}
              />
              <ModelAccessStatusPill
                label="LLM 模型"
                connected={modelAccessStatus.llmConnected}
              />
              <ModelAccessStatusPill
                label="Rerank 模型"
                connected={modelAccessStatus.rerankConnected}
              />
            </div>
          </div>
        </div>
      ) : null}

      <FileUploadDropzone
        onSelectFiles={appendFiles}
        helperText={
          canUploadDocument
            ? helperText
            : "请先在模型设置中接入默认 Embedding 模型，随后再上传知识库文件。"
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
          下一步
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
                分段设置
              </div>
              <Card className="p-4">
                <div className="space-y-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Settings2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-text-primary">
                        通用
                      </div>
                      <div className="text-sm text-text-secondary">
                        通用文本分块模式，检索和召回的块是相同的。
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="min-w-0">
                      <Select
                        label="切块方式"
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
                        label={`最大长度 (${settings.lengthMetric === "utf8Bytes" ? "bytes" : "characters"})`}
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
                        label={`重叠长度 (${settings.lengthMetric === "utf8Bytes" ? "bytes" : "characters"})`}
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
                        label="长度单位"
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
                          { value: "characters", label: "字符数" },
                          { value: "utf8Bytes", label: "UTF-8 字节数" },
                        ]}
                        compact
                      />
                    </div>
                    <SwitchField
                      label="分隔符保留"
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
                          label="分隔符"
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
                            label="语言预置"
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
                              { value: "", label: "不使用预置" },
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
                            label="自定义 separators"
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
                            label="encodingName"
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
                            label="allowedSpecial"
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
                            label="disallowedSpecial"
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
                      文本预处理规则
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <SwitchField
                        label="替换连续空白"
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
                        label="删除 URL 和邮箱"
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
                        label="使用 Q&A 分段"
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
                    小建议：Markdown 文档优先尝试 `MarkdownTextSplitter`；通用
                    TXT 可以从 `RecursiveCharacterTextSplitter + markdown
                    preset` 或自定义 separators 开始调。
                  </div>

                  <div className="flex items-center gap-2.5 border-t border-border pt-4">
                    <Button
                      variant="secondary"
                      onClick={() => void handlePreview()}
                      disabled={previewLoading}
                    >
                      <Eye className="h-4 w-4" />
                      {previewLoading ? "预览中..." : "预览块"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => void handleResample()}
                      disabled={previewLoading}
                    >
                      <Sparkles className="h-4 w-4" />
                      换一批样本
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
                      重置
                    </Button>
                  </div>
                </div>
              </Card>
            </section>

            <section className="space-y-2.5">
              <div className="text-base font-semibold text-text-primary">
                模型配置
              </div>
              <div className="space-y-2.5">
                <ModelStatusCard
                  title="LLM 模型"
                  description="用于回答生成。当前步骤要求已经配置默认 LLM。"
                  config={llmConfig}
                  required
                  icon={<Bot className="h-5 w-5" />}
                />
                <ModelStatusCard
                  title="Embedding 模型"
                  description="用于向量化和语义检索。当前步骤要求已经配置默认 Embedding。"
                  config={embeddingConfig}
                  required
                  icon={<Cpu className="h-5 w-5" />}
                />
                <ModelStatusCard
                  title="ReRank 模型"
                  description="用于结果重排。当前为可选配置，不影响继续下一步。"
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
                  预览
                </div>
                <div className="mt-1 truncate text-sm text-text-secondary">
                  {files.find((item) => item.id === previewFileId)?.name ??
                    files[0]?.name ??
                    "未选择文件"}
                </div>
              </div>
              <span className="ml-3 shrink-0 rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs text-text-secondary">
                {previewStats
                  ? `${previewChunks.length}/${previewStats.totalChunks} 项样本`
                  : `${previewChunks.length} 项预览块`}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
              {previewChunks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-secondary px-4 py-10 text-sm leading-6 text-text-secondary">
                  点击左侧“预览块”后，这里会展示知识文本分块结果。
                </div>
              ) : (
                <div className="space-y-3">
                  {previewStats ? (
                    <div className="grid gap-2 rounded-xl border border-border bg-surface-secondary p-3.5 text-xs text-text-secondary md:grid-cols-2">
                      <div>总块数：{previewStats.totalChunks}</div>
                      <div>平均长度：{previewStats.averageChunkLength}</div>
                      <div>最短块：{previewStats.minChunkLength}</div>
                      <div>最长块：{previewStats.maxChunkLength}</div>
                    </div>
                  ) : null}
                  {previewChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="min-w-0 rounded-xl border border-border bg-surface-secondary p-3.5"
                    >
                      <div className="mb-2 text-sm font-medium text-primary">
                        Chunk-{chunk.index} · {chunk.charCount} characters
                      </div>
                      <div className="overflow-hidden break-words text-sm leading-6 text-text-primary">
                        {chunk.text}
                      </div>
                    </div>
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
          上一步
        </Button>

        <Button
          disabled={!canProceedStep2}
          onClick={() => {
            if (!canProceedStep2) {
              message.warning("请先完成默认 LLM 和 Embedding 模型配置");
              return;
            }
            goToStep(3);
          }}
        >
          下一步
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
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface-primary px-6 py-8 text-center shadow-shadow-md">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
              <PartyPopper className="h-8 w-8" />
            </div>
            <div className="mt-5 text-2xl font-semibold text-text-primary">
              知识文档处理完成
            </div>
            <p className="mx-auto mt-2.5 max-w-xl text-sm leading-6 text-text-secondary">
              {createdDocuments[0]?.name ?? activeFile?.name ?? "当前文件"}{" "}
              已完成上传和切分入库，知识片段现在可以在知识库列表中查看，并用于后续检索与问答。
            </p>

            <div className="mt-5 rounded-2xl border border-border bg-surface-secondary px-4 py-3.5 text-left">
              <div className="grid gap-2.5 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-text-tertiary">
                    文件数
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">
                    {files.length}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-text-tertiary">
                    文本分块
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">
                    {totalChunks}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/settings/knowledge-base")}
              >
                返回知识库管理
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (processingError) {
      return (
        <div className="flex min-h-[360px] items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-danger/20 bg-surface-primary px-6 py-8 text-center shadow-shadow-md">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <FileSearch className="h-8 w-8" />
            </div>
            <div className="mt-5 text-2xl font-semibold text-text-primary">
              知识文档处理失败
            </div>
            <p className="mx-auto mt-2.5 max-w-xl text-sm leading-6 text-text-secondary">
              {processingError}
            </p>

            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => goToStep(2)}>
                返回上一步
              </Button>
              <Button onClick={() => navigate("/settings/knowledge-base")}>
                返回知识库管理
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[1.6fr_0.8fr]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold text-text-primary">
                文档已上传
              </h1>
              <p className="text-sm text-text-secondary">
                文档正在上传到知识库并完成切分入库。处理完成后，当前界面会自动切换为成功提示。
              </p>
            </div>

            <Card className="p-4">
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 text-base font-semibold text-text-primary">
                  <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                  文档处理中...
                </div>

                <div className="rounded-2xl border border-border bg-surface-secondary p-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text-primary">
                        {files[createdDocuments.length]?.name ??
                          activeFile?.name ??
                          "知识文档"}
                      </div>
                      <div className="mt-1 text-xs text-text-secondary">
                        已完成 {createdDocuments.length}/{files.length} 个文件
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
                </div>

                <div className="grid gap-y-2.5 border-t border-border pt-3.5 md:grid-cols-[148px_1fr]">
                  <div className="text-sm text-text-secondary">分段模式</div>
                  <div className="text-sm font-medium text-text-primary">
                    通用
                  </div>

                  <div className="text-sm text-text-secondary">
                    最大分段长度
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    {settings.chunkSize}
                  </div>

                  <div className="text-sm text-text-secondary">
                    文本预处理规则
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    {[
                      settings.replaceWhitespace
                        ? "替换掉连续的空格、换行符和制表符"
                        : null,
                      settings.removeUrls ? "删除 URL 和电子邮件地址" : null,
                      settings.useQaSplit ? "启用 Q&A 分段" : null,
                    ]
                      .filter(Boolean)
                      .join("，") || "未启用额外规则"}
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
                接下来做什么
              </div>
              <p className="mt-2.5 text-sm leading-6 text-text-secondary">
                处理结束后，你可以返回知识库管理页查看文档状态，也可以继续进入聊天流程验证检索命中片段。
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
          返回知识库
        </Button>
      </div>

      <div className="shrink-0">
        <StepIndicator currentStep={currentStep} steps={steps} />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface-primary px-4 py-5 shadow-shadow-sm xl:px-5">
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
      </div>
    </div>
  );
}
