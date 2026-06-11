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
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { message } from "@/shared/ui/Message";
import Card from "@/shared/ui/Card";
import { FileListItem } from "@/shared/ui/FileListItem";
import { FileUploadDropzone } from "@/shared/ui/FileUploadDropzone";
import { StepIndicator } from "@/shared/ui/StepIndicator";
import Tooltip from "@/shared/ui/Tooltip";
import {
  getRoleModelConfigs,
  type RoleModelConfig,
} from "@/shared/api/modelSettings";
import {
  getGlobalModelAccessStatus,
  resolveGlobalModelAccessStatus,
  type GlobalModelAccessStatus,
} from "@/shared/business/modelAccess";
import {
  createKnowledgeBaseDocument,
  type KnowledgeBaseDocumentDetail,
} from "@/shared/api/knowledgeBase";
import {
  splitTextIntoChunks,
  type ChunkSettings,
  type PreviewChunk,
} from "./textSplitter";

type UploadStep = 1 | 2 | 3;

type UploadFileItem = {
  id: string;
  file: File;
  name: string;
  extension: string;
  size: number;
};

type RetrievalMode = "vector" | "fulltext";

const initialSettings: ChunkSettings = {
  separator: "\\n\\n",
  maxLength: 1024,
  overlap: 50,
  replaceWhitespace: true,
  removeUrls: false,
  useQaSplit: false,
};

const initialFiles: UploadFileItem[] = [];

const steps = [
  { step: 1 as UploadStep, label: "选择数据源" },
  { step: 2 as UploadStep, label: "文本分段与清洗" },
  { step: 3 as UploadStep, label: "处理并完成" },
];

const splitterHints = {
  separator: "通常填写 \\n\\n 表示按段落切分；如果文档结构更规整，也可以换成自定义分隔符。",
  maxLength: "单个分块允许的最大字符数。值越大，上下文更完整；值越小，召回会更细。",
  overlap: "相邻分块之间保留的重复字符数，用来减少信息被切断的风险。常见范围 30 ~ 100。",
  replaceWhitespace: "清理多余空格、制表符和连续空行，适合大多数 md/txt 文档。",
  removeUrls: "适合知识正文场景；如果链接本身有意义，建议关闭这一项。",
  useQaSplit: "优先识别 Q:/A:、问:/答: 这类结构，再进行长度切分，适合 FAQ 文档。",
} as const;

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
          <div className="text-sm font-semibold text-text-primary">{title}</div>
          <div className="mt-1 text-sm leading-6 text-text-secondary">{description}</div>
        </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            configured ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          }`}
        >
          {configured ? "已配置" : required ? "必须配置" : "未配置"}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-surface-primary px-3.5 py-3 text-sm shadow-shadow-sm">
        <div className="truncate font-medium text-text-primary">{config?.name ?? "尚未选择模型"}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-text-secondary">
            {config?.providerCode ? `Provider · ${config.providerCode}` : "未选择提供商"}
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
  const [settings, setSettings] = useState<ChunkSettings>(initialSettings);
  const [previewChunks, setPreviewChunks] = useState<PreviewChunk[]>([]);
  const [previewFileId, setPreviewFileId] = useState<string>("");
  const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>("fulltext");
  const [roleConfigs, setRoleConfigs] = useState<RoleModelConfig[]>([]);
  const [modelAccessStatus, setModelAccessStatus] = useState<GlobalModelAccessStatus | null>(
    null,
  );
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingDone, setProcessingDone] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [createdDocuments, setCreatedDocuments] = useState<KnowledgeBaseDocumentDetail[]>([]);

  const canProceedStep1 = files.length > 0;
  const llmConfig = roleConfigs.find((item) => item.type === "llm") ?? null;
  const embeddingConfig = roleConfigs.find((item) => item.type === "embedding") ?? null;
  const rerankConfig = roleConfigs.find((item) => item.type === "rerank") ?? null;
  const canProceedStep2 = Boolean(
    llmConfig?.providerCode && llmConfig?.remoteModelId && embeddingConfig?.providerCode && embeddingConfig?.remoteModelId,
  );
  const canUploadDocument = modelAccessStatus?.embeddingConnected ?? false;

  const helperText = useMemo(
    () => "已支持 MARKDOWN、TXT，一次只能上传 1 个文件，每个文件不超过 15 MB。",
    [],
  );
  const activeFile = files.find((item) => item.id === previewFileId) ?? files[0] ?? null;
  const effectivePreviewChunks = useMemo(
    () => (previewChunks.length > 0 ? previewChunks : []),
    [previewChunks],
  );

  useEffect(() => {
    void (async () => {
      try {
        const status = await getGlobalModelAccessStatus();
        setModelAccessStatus(status);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "加载模型接入状态失败";
        message.error(errorMessage);
      }
    })();
  }, []);

  useEffect(() => {
    if (currentStep !== 2) {
      return;
    }

    void (async () => {
      try {
        setLoadingConfigs(true);
        const configs = await getRoleModelConfigs();
        setRoleConfigs(configs);
        setModelAccessStatus(resolveGlobalModelAccessStatus(configs));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "加载模型配置失败";
        message.error(errorMessage);
      } finally {
        setLoadingConfigs(false);
      }
    })();
  }, [currentStep]);

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
        const created: KnowledgeBaseDocumentDetail[] = [];

        for (const [index, file] of files.entries()) {
          if (cancelled) {
            return;
          }

          const document = await createKnowledgeBaseDocument({
            name: file.name,
            fileExt: file.extension.toLowerCase(),
            contentText: await file.file.text(),
            mimeType: file.file.type || "text/plain",
            fileSize: file.size,
            sourceType: "upload",
            sourceLabel: "本地上传",
            enabled: true,
            chunkingConfig: settings,
          });
          created.push(document);

          if (!cancelled) {
            setCreatedDocuments([...created]);
            setProcessingProgress(Math.round(((index + 1) / files.length) * 100));
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
        const errorMessage = error instanceof Error ? error.message : "知识文档处理失败";
        setProcessingError(errorMessage);
        message.error(errorMessage);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentStep, files, settings]);

  useEffect(() => {
    if (previewChunks.length === 0 || !activeFile) {
      return;
    }

    void (async () => {
      const rawText = await activeFile.file.text();
      setPreviewChunks(splitTextIntoChunks(rawText, settings));
    })();
  }, [activeFile, previewChunks.length, settings]);

  const appendFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }

    if (selectedFiles.length > 1) {
      message.warning("一次只能上传 1 个文件");
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
        currentPreviewId === id ? nextFiles[0]?.id ?? "" : currentPreviewId,
      );
      return nextFiles;
    });
    setPreviewChunks([]);
    message.info("已移除文件");
  };

  const goToStep = (step: UploadStep) => {
    setSearchParams({ step: `${step}` });
  };

  const handlePreview = async () => {
    const activeFile = files.find((item) => item.id === previewFileId) ?? files[0];
    if (!activeFile) {
      message.warning("请先选择一个文件进行预览");
      return;
    }

    const rawText = await activeFile.file.text();
    const chunks = splitTextIntoChunks(rawText, settings);
    setPreviewChunks(chunks);
    message.success(`已生成 ${chunks.length} 个文本分块预览`);
  };

  const renderStepOne = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h1 className="text-base font-semibold text-text-primary">上传文本文件</h1>
        <p className="text-sm text-text-secondary">
          先选择需要导入知识库的文件。
        </p>
      </div>

      {modelAccessStatus && !modelAccessStatus.embeddingConnected ? (
        <div className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="space-y-2">
            <div className="font-medium">当前未接入默认向量模型，暂时无法上传知识库文件。</div>
            <div className="flex flex-wrap gap-2">
              <ModelAccessStatusPill label="向量模型" connected={modelAccessStatus.embeddingConnected} />
              <ModelAccessStatusPill label="LLM 模型" connected={modelAccessStatus.llmConnected} />
              <ModelAccessStatusPill label="Rerank 模型" connected={modelAccessStatus.rerankConnected} />
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
      <div className="grid min-h-0 flex-1 gap-5 overflow-hidden xl:grid-cols-[1.6fr_0.9fr]">
        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="space-y-4 pb-4">
          <section className="space-y-2.5">
            <div className="text-base font-semibold text-text-primary">分段设置</div>
            <Card className="p-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Settings2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-text-primary">通用</div>
                    <div className="text-sm text-text-secondary">
                      通用文本分块模式，检索和召回的块是相同的。
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-text-primary">
                      分段标识符
                      <Tooltip text={splitterHints.separator} placement="top">
                        <span className="text-icon-secondary">
                          <CircleHelp className="h-3.5 w-3.5" />
                        </span>
                      </Tooltip>
                    </div>
                    <input
                      value={settings.separator}
                      onChange={(event) => setSettings((prev) => ({ ...prev, separator: event.target.value }))}
                      className="h-10 w-full rounded-xl border border-border bg-surface-primary px-3 text-sm text-text-primary shadow-shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="mt-1.5 text-xs leading-5 text-text-tertiary">
                      默认按段落切分，适合大多数 Markdown / TXT 文本。
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-text-primary">
                      分段最大长度
                      <Tooltip text={splitterHints.maxLength} placement="top">
                        <span className="text-icon-secondary">
                          <CircleHelp className="h-3.5 w-3.5" />
                        </span>
                      </Tooltip>
                    </div>
                    <div className="flex h-10 items-center rounded-xl border border-border bg-surface-primary pr-3 shadow-shadow-sm">
                      <input
                        type="number"
                        value={settings.maxLength}
                        min={100}
                        onChange={(event) => setSettings((prev) => ({ ...prev, maxLength: Number(event.target.value) || 0 }))}
                        className="h-full w-full rounded-xl bg-transparent px-3 text-sm text-text-primary focus:outline-none"
                      />
                      <span className="text-sm text-text-secondary">characters</span>
                    </div>
                    <div className="mt-1.5 text-xs leading-5 text-text-tertiary">
                      推荐先从 `800 ~ 1200` 开始调。
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-text-primary">
                      分段重叠长度
                      <Tooltip text={splitterHints.overlap} placement="top">
                        <span className="text-icon-secondary">
                          <CircleHelp className="h-3.5 w-3.5" />
                        </span>
                      </Tooltip>
                    </div>
                    <div className="flex h-10 items-center rounded-xl border border-border bg-surface-primary pr-3 shadow-shadow-sm">
                      <input
                        type="number"
                        value={settings.overlap}
                        min={0}
                        onChange={(event) => setSettings((prev) => ({ ...prev, overlap: Number(event.target.value) || 0 }))}
                        className="h-full w-full rounded-xl bg-transparent px-3 text-sm text-text-primary focus:outline-none"
                      />
                      <span className="text-sm text-text-secondary">characters</span>
                    </div>
                    <div className="mt-1.5 text-xs leading-5 text-text-tertiary">
                      如果文档句子较长，建议保留一定 overlap。
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 border-t border-border pt-4">
                  <div className="text-sm font-medium text-text-primary">文本预处理规则</div>
                  <label className="flex items-center gap-3 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={settings.replaceWhitespace}
                      onChange={(event) => setSettings((prev) => ({ ...prev, replaceWhitespace: event.target.checked }))}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                    替换掉连续的空格、换行符和制表符
                    <Tooltip text={splitterHints.replaceWhitespace} placement="top">
                      <span className="text-icon-secondary">
                        <CircleHelp className="h-3.5 w-3.5" />
                      </span>
                    </Tooltip>
                  </label>
                  <label className="flex items-center gap-3 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={settings.removeUrls}
                      onChange={(event) => setSettings((prev) => ({ ...prev, removeUrls: event.target.checked }))}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                    删除所有 URL 和电子邮件地址
                    <Tooltip text={splitterHints.removeUrls} placement="top">
                      <span className="text-icon-secondary">
                        <CircleHelp className="h-3.5 w-3.5" />
                      </span>
                    </Tooltip>
                  </label>
                  <label className="flex items-center gap-3 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={settings.useQaSplit}
                      onChange={(event) => setSettings((prev) => ({ ...prev, useQaSplit: event.target.checked }))}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                    使用 Q&A 分段，语言 Chinese Simplified
                    <Tooltip text={splitterHints.useQaSplit} placement="top">
                      <span className="text-icon-secondary">
                        <CircleHelp className="h-3.5 w-3.5" />
                      </span>
                    </Tooltip>
                  </label>
                </div>

                <div className="rounded-xl border border-dashed border-border bg-surface-secondary/70 px-3.5 py-3 text-xs leading-5 text-text-secondary">
                  小建议：普通知识文档优先使用 `\\n\\n + 1024 + 50`；FAQ 文档可以尝试开启 Q&A 分段，再观察右侧预览效果。
                </div>

                <div className="flex items-center gap-2.5 border-t border-border pt-4">
                  <Button variant="secondary" onClick={() => void handlePreview()}>
                    <Eye className="h-4 w-4" />
                    预览块
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSettings(initialSettings);
                      setPreviewChunks([]);
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
            <div className="text-base font-semibold text-text-primary">索引方式</div>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    高质量
                    <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary">
                      推荐
                    </span>
                  </div>
                  <div className="mt-1 text-sm leading-6 text-text-secondary">
                    调用嵌入模型处理文档以实现更精确的检索，可以帮助 LLM 生成高质量的答案。
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section className="space-y-2.5">
            <div className="text-base font-semibold text-text-primary">模型配置</div>
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

            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div className="text-sm text-text-secondary">
                {loadingConfigs
                  ? "正在加载模型配置..."
                  : canProceedStep2
                    ? "当前已满足 LLM + Embedding 配置要求。"
                    : "必须先配置默认 LLM 和 Embedding，才能继续下一步。"}
              </div>
              <Button variant="secondary" onClick={() => navigate("/settings/model-setting")}>
                前往模型设置
              </Button>
            </div>
          </section>

          <section className="space-y-2.5">
            <div className="text-base font-semibold text-text-primary">检索设置</div>
            <div className="grid gap-2.5 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setRetrievalMode("vector")}
                className={`rounded-xl border p-4 text-left transition-all duration-150 ${
                  retrievalMode === "vector"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface-primary hover:bg-surface-secondary"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <Search className="h-4 w-4" />
                  向量检索
                </div>
                <div className="text-sm leading-6 text-text-secondary">
                  通过生成查询嵌入并查询与其向量表示最相似的文本分段。
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRetrievalMode("fulltext")}
                className={`rounded-xl border p-4 text-left transition-all duration-150 ${
                  retrievalMode === "fulltext"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface-primary hover:bg-surface-secondary"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <FileSearch className="h-4 w-4" />
                  全文检索
                </div>
                <div className="text-sm leading-6 text-text-secondary">
                  索引文档中的所有词汇，从而允许用户查询任意词汇，并返回包含这些词汇的文本片段。
                </div>
              </button>
            </div>
          </section>
          </div>
        </div>

        <div className="min-h-0">
          <Card className="flex h-full min-h-0 flex-col p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <div>
                <div className="text-sm font-semibold text-text-primary">预览</div>
                <div className="mt-1 text-sm text-text-secondary">
                  {files.find((item) => item.id === previewFileId)?.name ?? files[0]?.name ?? "未选择文件"}
                </div>
              </div>
              <span className="rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs text-text-secondary">
                {previewChunks.length} 项预览块
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
              {previewChunks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-secondary px-4 py-10 text-sm leading-6 text-text-secondary">
                  点击左侧“预览块”后，这里会展示知识文本分块结果。
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-surface-secondary/70 px-3.5 py-3 text-xs leading-5 text-text-secondary">
                    当前预览会优先按段落、句子和 Q&A 结构切分；如果单段仍然过长，才会按最大长度兜底切块。
                  </div>
                  {previewChunks.map((chunk) => (
                    <div key={chunk.id} className="rounded-xl border border-border bg-surface-secondary p-3.5">
                      <div className="mb-2 text-sm font-medium text-primary">
                        Chunk-{chunk.index} · {chunk.text.length} characters
                      </div>
                      <div className="text-sm leading-6 text-text-primary">{chunk.text}</div>
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
      createdDocuments.reduce((sum, document) => sum + document.chunkCount, 0) ||
      effectivePreviewChunks.length;

    if (processingDone) {
      return (
      <div className="flex min-h-[400px] items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface-primary px-6 py-8 text-center shadow-shadow-md">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
              <PartyPopper className="h-8 w-8" />
            </div>
            <div className="mt-5 text-2xl font-semibold text-text-primary">知识文档处理完成</div>
            <p className="mx-auto mt-2.5 max-w-xl text-sm leading-6 text-text-secondary">
              {createdDocuments[0]?.name ?? activeFile?.name ?? "当前文件"} 已完成上传和切分入库，知识片段现在可以在知识库列表中查看，并用于后续检索与问答。
            </p>

            <div className="mt-5 rounded-2xl border border-border bg-surface-secondary px-4 py-3.5 text-left">
              <div className="grid gap-2.5 md:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-text-tertiary">文件数</div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">{files.length}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-text-tertiary">文本分块</div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">{totalChunks}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-text-tertiary">检索模式</div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">
                    {retrievalMode === "fulltext" ? "全文检索" : "向量检索"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <Button size="lg" onClick={() => navigate("/settings/knowledge-base")}>
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
            <div className="mt-5 text-2xl font-semibold text-text-primary">知识文档处理失败</div>
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
              <h1 className="text-xl font-semibold text-text-primary">文档已上传</h1>
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
                        {files[createdDocuments.length]?.name ?? activeFile?.name ?? "知识文档"}
                      </div>
                      <div className="mt-1 text-xs text-text-secondary">
                        已完成 {createdDocuments.length}/{files.length} 个文件
                      </div>
                    </div>
                    <div className="text-sm font-medium text-text-secondary">{processingProgress}%</div>
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
                  <div className="text-sm font-medium text-text-primary">通用</div>

                  <div className="text-sm text-text-secondary">最大分段长度</div>
                  <div className="text-sm font-medium text-text-primary">{settings.maxLength}</div>

                  <div className="text-sm text-text-secondary">文本预处理规则</div>
                  <div className="text-sm font-medium text-text-primary">
                    {[
                      settings.replaceWhitespace ? "替换掉连续的空格、换行符和制表符" : null,
                      settings.removeUrls ? "删除 URL 和电子邮件地址" : null,
                      settings.useQaSplit ? "启用 Q&A 分段" : null,
                    ]
                      .filter(Boolean)
                      .join("，") || "未启用额外规则"}
                  </div>

                  <div className="text-sm text-text-secondary">索引方式</div>
                  <div className="text-sm font-medium text-text-primary">高质量</div>

                  <div className="text-sm text-text-secondary">检索设置</div>
                  <div className="text-sm font-medium text-text-primary">
                    {retrievalMode === "fulltext" ? "全文检索" : "向量检索"}
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
              <div className="mt-4 text-xl font-semibold text-text-primary">接下来做什么</div>
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
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-5 overflow-hidden px-4 py-5">
      <div className="shrink-0 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate("/settings/knowledge-base") }>
          <ArrowLeft className="h-4 w-4" />
          返回知识库
        </Button>
      </div>

      <div className="shrink-0">
        <StepIndicator currentStep={currentStep} steps={steps} />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface-primary px-5 py-6 shadow-shadow-sm">
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
