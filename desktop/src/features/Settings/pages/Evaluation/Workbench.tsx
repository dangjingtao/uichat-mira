import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Eye,
  FolderArchive,
  Play,
  Save,
  TableProperties,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import Card from "@/shared/ui/Card";
import { Button, IconButton } from "@/shared/ui/Button";
import { FileUploadDropzone } from "@/shared/ui/FileUploadDropzone";
import { message } from "@/shared/ui/Message";
import { parseEvaluationZipMock, buildEvaluationRunRecord } from "./mock";
import { saveEvaluationRun } from "./storage";
import type {
  EvaluationJobStatus,
  EvaluationRunRecord,
  ParsedDataset,
} from "./types";
import MetricGrid from "../../components/Evaluation/MetricGrid";
import StatusBadge from "../../components/Evaluation/StatusBadge";

type ConsoleTab = "log" | "result";

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function ValidationPill({
  status,
}: {
  status: "pass" | "warning" | "error";
}) {
  const statusMap = {
    pass: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    error: "bg-danger/10 text-danger",
  } as const;

  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusMap[status]}`}>
      {status === "pass" ? "通过" : status === "warning" ? "注意" : "错误"}
    </span>
  );
}

function WorkbenchStateBar({
  status,
  dataset,
  runRecord,
}: {
  status: EvaluationJobStatus;
  dataset: ParsedDataset | null;
  runRecord: EvaluationRunRecord | null;
}) {
  const summary = dataset?.summary;
  const sampleCount = summary?.sampleCount ?? 0;
  const completedCount =
    status === "completed" || status === "failed"
      ? runRecord?.sampleResults.length ?? 0
      : status === "running"
        ? Math.max(1, Math.floor(sampleCount * 0.5))
        : 0;

  return (
    <div className="grid gap-2.5 rounded-xl border border-border bg-surface-primary px-3.5 py-3 shadow-shadow-sm md:grid-cols-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">任务状态</div>
        <div className="mt-1 flex items-center gap-2">
          <StatusBadge status={status} />
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">数据集</div>
        <div className="mt-1 text-sm font-medium text-text-primary">
          {dataset?.datasetName ?? "等待上传"}
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">进度</div>
        <div className="mt-1 text-sm font-medium text-text-primary">
          {completedCount} / {sampleCount || "--"}
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">模式</div>
        <div className="mt-1 text-sm font-medium text-text-primary">
          {dataset
            ? dataset.config.mode === "retrieve"
              ? "仅检索"
              : "检索+生成"
            : "--"}
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">参数</div>
        <div className="mt-1 text-sm font-medium text-text-primary">
          {dataset ? `K${dataset.config.topK} / N${dataset.config.topN}` : "--"}
        </div>
      </div>
    </div>
  );
}

function DatasetPreviewDrawer({
  open,
  dataset,
  onClose,
}: {
  open: boolean;
  dataset: ParsedDataset | null;
  onClose: () => void;
}) {
  if (!open || !dataset) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="关闭数据集预览"
        className="absolute inset-0 bg-black/25"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-border bg-surface-primary shadow-shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-text-primary">数据集随机预览</div>
            <div className="mt-1 text-xs text-text-secondary">
              {dataset.datasetName} · {dataset.summary.sampleCount} 条样本 ·{" "}
              {dataset.summary.documentCount} 份文档
            </div>
          </div>
          <IconButton ariaLabel="关闭预览抽屉" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </header>

        <div className="stable-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <section className="space-y-2">
            <div className="text-sm font-semibold text-text-primary">样本预览</div>
            <div className="space-y-2">
              {dataset.previewSamples.map((sample) => (
                <div
                  key={sample.id}
                  className="rounded-xl border border-border bg-surface-secondary px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-surface-primary px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                      {sample.id}
                    </span>
                    <div className="text-xs text-text-secondary">{sample.tags.join(" · ")}</div>
                  </div>
                  <div className="mt-2 text-sm font-medium text-text-primary">
                    {sample.question}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-text-secondary">
                    gold sources：{sample.goldSources.join("、")}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-text-secondary">
                    reference：{sample.expectedAnswer}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="text-sm font-semibold text-text-primary">文档预览</div>
            <div className="space-y-2">
              {dataset.documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-text-primary">
                      {document.name}
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">{document.sizeLabel}</div>
                  </div>
                  <span className="ml-3 rounded-full bg-surface-primary px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                    {document.type}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export default function EvaluationWorkbench() {
  const navigate = useNavigate();
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [status, setStatus] = useState<EvaluationJobStatus>("idle");
  const [parsing, setParsing] = useState(false);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("log");
  const [runRecord, setRunRecord] = useState<EvaluationRunRecord | null>(null);
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const canRun = Boolean(
    dataset &&
      dataset.validations.every((item) => item.status !== "error") &&
      !parsing &&
      status !== "running",
  );

  const progressWidth = useMemo(() => {
    if (!dataset) {
      return 0;
    }

    if (status === "completed" || status === "failed") {
      return 100;
    }

    if (status === "running") {
      return 52;
    }

    return status === "ready" ? 8 : 0;
  }, [dataset, status]);

  const handleSelectFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const [file] = Array.from(files);
    if (!file || !file.name.toLowerCase().endsWith(".zip")) {
      message.warning("请上传 dataset.zip 评测包");
      return;
    }

    try {
      setParsing(true);
      setStatus("idle");
      setRunRecord(null);
      setSavedRunId(null);
      setConsoleTab("log");
      const parsed = await parseEvaluationZipMock(file);
      setDataset(parsed);
      setStatus("ready");
      message.success("评测包已解析，可直接开始评测");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "评测包解析失败");
    } finally {
      setParsing(false);
    }
  };

  const handleStartEvaluation = async () => {
    if (!dataset) {
      message.warning("请先上传评测包");
      return;
    }

    if (dataset.validations.some((item) => item.status === "error")) {
      message.error("当前评测包存在校验错误，请修正后重新上传");
      return;
    }

    setStatus("running");
    setSavedRunId(null);
    setConsoleTab("log");
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    const nextRun = buildEvaluationRunRecord(dataset);
    setRunRecord(nextRun);
    setStatus(nextRun.status);
    setConsoleTab("result");
    message.success("评测已完成，右侧可查看结果");
  };

  const handleSaveToCenter = () => {
    if (!runRecord) {
      message.warning("当前还没有可保存的评测结果");
      return;
    }

    saveEvaluationRun(runRecord);
    setSavedRunId(runRecord.id);
    message.success("结果已保存到评测中心");
  };

  return (
    <SettingsPageLayout
        miniTitle="Evaluation Workbench"
        title="评测工作台"
        description="上传配置式评测包后，系统会解析 zip 中的数据集与运行参数。左侧只做校验和预览，参数需通过重新生成 zip 调整。"
        containerClassName="max-w-none"
        contentClassName="flex flex-col gap-4 pt-6 2xl:h-full"
      >

      <div className="grid gap-4 2xl:min-h-0 2xl:flex-1 2xl:grid-cols-[minmax(340px,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-3 2xl:min-h-0 2xl:overflow-y-auto 2xl:pr-1">
          <Card className="space-y-3 p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-text-primary">评测包与参数</div>
                <div className="mt-1 text-xs leading-5 text-text-secondary">
                  上传后自动解析 zip 中的模式、topK、topN 和 N。页面仅展示，不提供修改。
                </div>
              </div>
              {dataset ? <StatusBadge status={status === "idle" ? "ready" : status} /> : null}
            </div>

            <FileUploadDropzone
              onSelectFiles={(files) => {
                void handleSelectFiles(files);
              }}
              accept=".zip"
              maxCount={1}
              helperText={
                parsing
                  ? "正在解析评测包，请稍候..."
                  : "支持 dataset.zip，重新上传即可替换当前参数。"
              }
              className="px-3 py-3"
              disabled={parsing}
            />

            {dataset ? (
              <>
                <div className="rounded-xl border border-border bg-surface-secondary px-3 py-2.5 text-xs leading-5 text-text-secondary">
                  <div className="font-medium text-text-primary">{dataset.fileName}</div>
                  <div>
                    {formatFileSize(dataset.fileSize)} · 上传于 {formatDate(dataset.uploadedAt)}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-surface-secondary px-3 py-2.5">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
                      数据集
                    </div>
                    <div className="mt-1 text-sm font-medium text-text-primary">
                      {dataset.datasetName}
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {dataset.summary.documentCount} 份文档 · {dataset.summary.sampleCount} 条样本
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-secondary px-3 py-2.5">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
                      运行参数
                    </div>
                    <div className="mt-1 text-sm font-medium text-text-primary">
                      {dataset.config.mode === "retrieve" ? "仅检索" : "检索+生成"}
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">
                      topK {dataset.config.topK} · topN {dataset.config.topN} · N {dataset.config.repeat}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="h-4 w-4" />
                    查看随机预览
                  </Button>
                  <div className="text-xs text-text-secondary">
                    预览通过抽屉打开，避免主界面被样本列表挤占。
                  </div>
                </div>
              </>
            ) : null}
          </Card>

          <Card className="space-y-3 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-text-primary">开始前校验</div>
              {dataset ? (
                <span className="text-xs text-text-secondary">
                  类似表单校验，修正方式是更新 zip 后重新上传
                </span>
              ) : null}
            </div>
            {dataset ? (
              <div className="space-y-2">
                {dataset.validations.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-surface-secondary px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-text-primary">{item.label}</div>
                      <ValidationPill status={item.status} />
                    </div>
                    <div className="mt-1 text-xs leading-5 text-text-secondary">{item.detail}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface-secondary px-3 py-5 text-sm text-text-secondary">
                校验区会在解析后展示结构、样本字段和参考数据的检查结果。
              </div>
            )}
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                void handleStartEvaluation();
              }}
              disabled={!canRun}
              className="min-w-[132px] flex-1 sm:flex-none"
            >
              <Play className="h-4 w-4" />
              开始评测
            </Button>
            <Button
              variant="secondary"
              disabled={!runRecord}
              onClick={handleSaveToCenter}
              className="min-w-[112px]"
            >
              <Save className="h-4 w-4" />
              保存结果
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!savedRunId}
              onClick={() => navigate("/settings/evaluation/center")}
            >
              <ChevronRight className="h-4 w-4" />
              去评测中心
            </Button>
          </div>
        </div>

        <div className="flex min-h-[560px] flex-col gap-3 2xl:min-h-0">
          <WorkbenchStateBar status={status} dataset={dataset} runRecord={runRecord} />

          <Card className="flex flex-1 flex-col overflow-hidden p-0 2xl:min-h-0">
            <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
              <div className="flex items-center gap-1 rounded-xl bg-surface-secondary p-1">
                <button
                  type="button"
                  onClick={() => setConsoleTab("log")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    consoleTab === "log"
                      ? "bg-surface-primary text-text-primary shadow-shadow-sm"
                      : "text-text-secondary"
                  }`}
                >
                  运行日志
                </button>
                <button
                  type="button"
                  onClick={() => setConsoleTab("result")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    consoleTab === "result"
                      ? "bg-surface-primary text-text-primary shadow-shadow-sm"
                      : "text-text-secondary"
                  }`}
                >
                  结果
                </button>
              </div>

              <div className="text-xs text-text-secondary">
                {savedRunId ? "本次结果已保存到评测中心" : "结果页支持一键保存到评测中心"}
              </div>
            </div>

            <div className="flex-1 overflow-hidden 2xl:min-h-0">
              {consoleTab === "log" ? (
                <div className="flex h-full min-h-[420px] flex-col bg-[#0d1320] 2xl:min-h-0">
                  <div className="border-b border-slate-800 px-3.5 py-2.5 text-xs text-slate-400">
                    terminal://rag-eval-runner
                  </div>
                  <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto px-3.5 py-3 font-mono text-xs leading-6 text-slate-200">
                    {dataset ? (
                      <>
                        <div>
                          <span className="text-slate-500">$</span> load {dataset.fileName}
                        </div>
                        <div className="text-emerald-300">
                          manifest parsed: mode={dataset.config.mode} topK={dataset.config.topK} topN={dataset.config.topN} repeat={dataset.config.repeat}
                        </div>
                        <div>
                          samples={dataset.summary.sampleCount} documents={dataset.summary.documentCount}
                        </div>
                        <div className="mt-2 text-slate-400">validation summary</div>
                        {dataset.validations.map((item) => (
                          <div key={item.id}>
                            <span className="text-slate-500">-</span> {item.label} ::{" "}
                            <span
                              className={
                                item.status === "pass"
                                  ? "text-emerald-300"
                                  : item.status === "warning"
                                    ? "text-amber-300"
                                    : "text-rose-300"
                              }
                            >
                              {item.status}
                            </span>
                          </div>
                        ))}
                        <div className="mt-2">
                          <span className="text-slate-500">$</span> ready
                        </div>

                        {status === "running" ? (
                          <>
                            <div className="mt-3 text-slate-400">running evaluation...</div>
                            <div>stage=retrieve sample=001 latency=3.1s</div>
                            <div>stage=judge sample=001 faithfulness=0.86</div>
                            <div>stage=retrieve sample=002 latency=2.9s</div>
                            <div className="text-amber-300">
                              stage=judge sample=002 waiting llm response...
                            </div>
                          </>
                        ) : null}

                        {runRecord ? (
                          <>
                            <div className="mt-3 text-slate-400">final summary</div>
                            {runRecord.logs.map((log) => (
                              <div key={log.id}>
                                <span className="text-slate-500">[{log.timestamp}]</span> {log.text}
                              </div>
                            ))}
                          </>
                        ) : null}
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        上传评测包后，这里会显示解析过程与运行日志。
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-800 px-3.5 py-3">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="stable-scrollbar h-full min-h-[420px] overflow-y-auto px-3.5 py-3 2xl:min-h-0">
                  {runRecord ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-text-primary">
                            {runRecord.name}
                          </div>
                          <div className="mt-1 text-xs text-text-secondary">
                            完成于 {formatDate(runRecord.completedAt)} · {runRecord.sampleResults.length} 条结果已汇总
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={runRecord.status} />
                          {savedRunId ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              已保存
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <MetricGrid metrics={runRecord.metrics} />

                      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                        <Card className="space-y-2 p-3.5">
                          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                            <FolderArchive className="h-4 w-4 text-primary" />
                            运行配置
                          </div>
                          <div className="grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
                            <div>模式：{dataset?.config.mode === "retrieve" ? "仅检索" : "检索+生成"}</div>
                            <div>topK：{dataset?.config.topK}</div>
                            <div>topN：{dataset?.config.topN}</div>
                            <div>N：{dataset?.config.repeat}</div>
                          </div>
                        </Card>

                        <Card className="space-y-2 p-3.5">
                          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                            <TableProperties className="h-4 w-4 text-primary" />
                            明细摘要
                          </div>
                          <div className="space-y-2">
                            {runRecord.sampleResults.slice(0, 4).map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-text-primary">{item.question}</div>
                                  <div className="mt-1 text-xs text-text-secondary">
                                    {item.status === "success" ? "成功" : item.errorMessage}
                                  </div>
                                </div>
                                <div className="ml-3 text-xs font-medium text-text-secondary">
                                  {(item.latencyMs / 1000).toFixed(1)}s
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="max-w-md rounded-2xl border border-dashed border-border bg-surface-secondary px-5 py-8 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <AlertCircle className="h-6 w-6" />
                        </div>
                        <div className="mt-3 text-base font-semibold text-text-primary">
                          结果区暂时为空
                        </div>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                          开始评测后，右侧会自动切换到结果 tab，并展示本次任务的汇总指标。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <DatasetPreviewDrawer
        open={previewOpen}
        dataset={dataset}
        onClose={() => setPreviewOpen(false)}
      />
    </SettingsPageLayout>
  );
}
