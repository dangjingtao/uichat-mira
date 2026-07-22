import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Presentation,
  Sparkles,
  Upload,
} from "lucide-react";
import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";
import { Button } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  createExcelVerificationCopy,
  createOfficeSample,
  createWordReviewCopy,
  createWordVerificationCopy,
  inspectOfficeFile,
  type OfficeSuiteCreatedDownload,
  type OfficeSuiteFileKind,
  type OfficeSuiteInspection,
} from "@/shared/api/officeSuite";
import MicroAppPageLayout from "../components/MicroAppPageLayout";
import SkillRuntimePanel from "./components/SkillRuntimePanel";

const ACCEPTED_EXTENSIONS = ".docx,.xlsx,.pptx";

const kindMeta: Record<
  OfficeSuiteFileKind,
  { label: string; icon: typeof FileText; runtime: string }
> = {
  word: { label: "Word", icon: FileText, runtime: "docx + OOXML" },
  excel: { label: "Excel", icon: FileSpreadsheet, runtime: "xlsx + exceljs" },
  powerpoint: { label: "PowerPoint", icon: Presentation, runtime: "pptxgenjs + OOXML" },
};

type OperationRecord = {
  label: string;
  status: "success" | "error";
  durationMs: number;
  fileName?: string;
  byteSize?: number;
  error?: string;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const prettyJson = (value: unknown) => JSON.stringify(value, null, 2);

const downloadArtifact = (artifact: OfficeSuiteCreatedDownload) => {
  const url = window.URL.createObjectURL(artifact.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function OfficeSuitePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<OfficeSuiteInspection | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [creatingKind, setCreatingKind] = useState<OfficeSuiteFileKind | null>(null);
  const [modifyingWord, setModifyingWord] = useState(false);
  const [reviewingWord, setReviewingWord] = useState(false);
  const [modifyingExcel, setModifyingExcel] = useState(false);
  const [wordReviewTarget, setWordReviewTarget] = useState("");
  const [wordReviewComment, setWordReviewComment] = useState("");
  const [wordReviewReplacement, setWordReviewReplacement] = useState("");
  const [lastCreated, setLastCreated] = useState<{
    kind: OfficeSuiteFileKind;
    fileName: string;
    byteSize: number;
  } | null>(null);
  const [lastModified, setLastModified] = useState<{
    fileName: string;
    byteSize: number;
  } | null>(null);
  const [recentOperation, setRecentOperation] = useState<OperationRecord | null>(null);

  const selectedExtension = useMemo(() => {
    if (!selectedFile) return "";
    const index = selectedFile.name.lastIndexOf(".");
    return index >= 0 ? selectedFile.name.slice(index).toLowerCase() : "";
  }, [selectedFile]);

  const modifying = modifyingWord || reviewingWord || modifyingExcel;
  const busy = inspecting || modifying || creatingKind !== null;

  const chooseFile = (file?: File | null) => {
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".docx", ".xlsx", ".pptx"].includes(extension)) {
      message.warning("文枢当前只接受 .docx、.xlsx 和 .pptx 文件");
      return;
    }
    setSelectedFile(file);
    setInspection(null);
    setLastModified(null);
    setWordReviewTarget("");
    setWordReviewComment("");
    setWordReviewReplacement("");
  };

  const runInspection = async () => {
    if (!selectedFile) {
      message.warning("请先选择一个 Office 文件");
      return;
    }

    const startedAt = performance.now();
    setInspecting(true);
    try {
      const result = await inspectOfficeFile(selectedFile);
      setInspection(result);
      setRecentOperation({
        label: `Inspect ${kindMeta[result.kind].label}`,
        status: "success",
        durationMs: Math.round(performance.now() - startedAt),
        fileName: selectedFile.name,
        byteSize: selectedFile.size,
      });
      message.success("文件结构读取完成");
    } catch (error) {
      const detail = errorMessage(error, "文件读取失败");
      setRecentOperation({
        label: "Inspect",
        status: "error",
        durationMs: Math.round(performance.now() - startedAt),
        fileName: selectedFile.name,
        error: detail,
      });
      message.error(detail);
    } finally {
      setInspecting(false);
    }
  };

  const runCreate = async (kind: OfficeSuiteFileKind) => {
    const startedAt = performance.now();
    setCreatingKind(kind);
    try {
      const artifact = await createOfficeSample(kind);
      downloadArtifact(artifact);
      setLastCreated({
        kind,
        fileName: artifact.fileName,
        byteSize: artifact.blob.size,
      });
      setRecentOperation({
        label: `Create ${kindMeta[kind].label}`,
        status: "success",
        durationMs: Math.round(performance.now() - startedAt),
        fileName: artifact.fileName,
        byteSize: artifact.blob.size,
      });
      message.success(`${kindMeta[kind].label} 测试产物已生成`);
    } catch (error) {
      const detail = errorMessage(error, "Office 文件生成失败");
      setRecentOperation({
        label: `Create ${kindMeta[kind].label}`,
        status: "error",
        durationMs: Math.round(performance.now() - startedAt),
        error: detail,
      });
      message.error(detail);
    } finally {
      setCreatingKind(null);
    }
  };

  const runWordModify = async () => {
    if (!selectedFile || selectedExtension !== ".docx") {
      message.warning("请先选择一个 .docx 文件");
      return;
    }

    const startedAt = performance.now();
    setModifyingWord(true);
    try {
      const artifact = await createWordVerificationCopy(selectedFile);
      downloadArtifact(artifact);
      setLastModified({
        fileName: artifact.fileName,
        byteSize: artifact.blob.size,
      });
      setRecentOperation({
        label: "Modify Word",
        status: "success",
        durationMs: Math.round(performance.now() - startedAt),
        fileName: artifact.fileName,
        byteSize: artifact.blob.size,
      });
      message.success("Word 修改副本已生成，原文件未覆盖");
    } catch (error) {
      const detail = errorMessage(error, "Word 修改失败");
      setRecentOperation({
        label: "Modify Word",
        status: "error",
        durationMs: Math.round(performance.now() - startedAt),
        fileName: selectedFile.name,
        error: detail,
      });
      message.error(detail);
    } finally {
      setModifyingWord(false);
    }
  };

  const runWordReview = async () => {
    if (!selectedFile || selectedExtension !== ".docx") {
      message.warning("请先选择一个 .docx 文件");
      return;
    }

    const targetText = wordReviewTarget.trim();
    const commentText = wordReviewComment.trim();
    const hasReplacement = wordReviewReplacement.trim().length > 0;
    if (!targetText) {
      message.warning("请填写要定位的目标文本");
      return;
    }
    if (!commentText && !hasReplacement) {
      message.warning("请至少填写批注或建议替换文本");
      return;
    }

    const startedAt = performance.now();
    setReviewingWord(true);
    try {
      const artifact = await createWordReviewCopy(selectedFile, {
        author: "Mira",
        comment: commentText
          ? { targetText, text: commentText }
          : undefined,
        insertion: hasReplacement
          ? { afterText: targetText, text: wordReviewReplacement }
          : undefined,
        deletion: hasReplacement ? { targetText } : undefined,
      });
      downloadArtifact(artifact);
      setLastModified({
        fileName: artifact.fileName,
        byteSize: artifact.blob.size,
      });
      setRecentOperation({
        label: "Review Word",
        status: "success",
        durationMs: Math.round(performance.now() - startedAt),
        fileName: artifact.fileName,
        byteSize: artifact.blob.size,
      });
      message.success("Word 审阅副本已生成，批注和修订保留在新文件中");
    } catch (error) {
      const detail = errorMessage(error, "Word 审阅失败");
      setRecentOperation({
        label: "Review Word",
        status: "error",
        durationMs: Math.round(performance.now() - startedAt),
        fileName: selectedFile.name,
        error: detail,
      });
      message.error(detail);
    } finally {
      setReviewingWord(false);
    }
  };

  const runExcelModify = async () => {
    if (!selectedFile || selectedExtension !== ".xlsx") {
      message.warning("请先选择一个 .xlsx 文件");
      return;
    }

    const startedAt = performance.now();
    setModifyingExcel(true);
    try {
      const artifact = await createExcelVerificationCopy(selectedFile);
      downloadArtifact(artifact);
      setLastModified({
        fileName: artifact.fileName,
        byteSize: artifact.blob.size,
      });
      setRecentOperation({
        label: "Modify Excel",
        status: "success",
        durationMs: Math.round(performance.now() - startedAt),
        fileName: artifact.fileName,
        byteSize: artifact.blob.size,
      });
      message.success("Excel 修改副本已生成，原文件未覆盖");
    } catch (error) {
      const detail = errorMessage(error, "Excel 修改失败");
      setRecentOperation({
        label: "Modify Excel",
        status: "error",
        durationMs: Math.round(performance.now() - startedAt),
        fileName: selectedFile.name,
        error: detail,
      });
      message.error(detail);
    } finally {
      setModifyingExcel(false);
    }
  };

  return (
    <MicroAppPageLayout
      miniTitle="MicroAPP"
      title="文枢"
      description="Word、PDF、Excel 与 PowerPoint 的本地处理工作台。当前用于验证 Office / Skill Runtime，不在这里重复实现一套 Chat。"
      contentClassName="space-y-5 pt-5"
    >
      <Card className="border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-ui-control bg-surface-primary text-primary shadow-shadow-sm">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <div className="font-serif text-lg font-semibold text-text-primary">Office Runtime</div>
                <div className="text-sm text-text-secondary">一个微应用，内部保持四类文档 Skill / Runtime 边界。</div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">本地优先</Badge>
            <Badge variant="muted">不注册原子 Harness 能力</Badge>
            <Badge variant="warning">调试阶段</Badge>
          </div>
        </div>
      </Card>

      <SkillRuntimePanel />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">创建测试产物</h2>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  直接调用三类 Office Runtime 的主生成库，验证 Create → 下载链路。生成后的文件可以再上传到下方做 Inspect 回读。
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {(Object.entries(kindMeta) as [OfficeSuiteFileKind, (typeof kindMeta)[OfficeSuiteFileKind]][]).map(
                  ([kind, meta]) => {
                    const Icon = meta.icon;
                    const isCreating = creatingKind === kind;
                    return (
                      <Button
                        key={kind}
                        variant="outline"
                        size="md"
                        disabled={busy}
                        onClick={() => void runCreate(kind)}
                      >
                        <Icon className="h-4 w-4" />
                        {isCreating ? "正在生成…" : `生成 ${meta.label}`}
                      </Button>
                    );
                  },
                )}
              </div>

              {lastCreated ? (
                <div className="flex flex-wrap items-center gap-2 rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3 text-sm">
                  <Download className="h-4 w-4 text-primary" />
                  <Badge variant="success">生成成功</Badge>
                  <span className="font-medium text-text-primary">{lastCreated.fileName}</span>
                  <span className="text-text-tertiary">{formatBytes(lastCreated.byteSize)}</span>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">文件输入与修改验证</h2>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  选择已有文件做 Inspect；DOCX 和 XLSX 可以生成非破坏性的修改副本。DOCX 还可以验证原生批注与 Track Changes 修订。
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={(event) => chooseFile(event.target.files?.[0])}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-ui-panel border border-dashed border-border bg-surface-secondary/20 px-5 py-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-ui-control bg-primary/10 text-primary">
                  <Upload className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-medium text-text-primary">
                    {selectedFile ? selectedFile.name : "选择 Office 文件"}
                  </div>
                  <div className="mt-1 text-xs text-text-tertiary">
                    {selectedFile
                      ? `${selectedExtension} · ${formatBytes(selectedFile.size)}`
                      : "支持 .docx / .xlsx / .pptx"}
                  </div>
                </div>
              </button>

              <div className="flex flex-wrap justify-end gap-3">
                {selectedExtension === ".docx" ? (
                  <Button
                    variant="outline"
                    size="md"
                    disabled={!selectedFile || busy}
                    onClick={() => void runWordModify()}
                  >
                    <FileText className="h-4 w-4" />
                    {modifyingWord ? "正在修改…" : "生成 Word 修改副本"}
                  </Button>
                ) : null}
                {selectedExtension === ".xlsx" ? (
                  <Button
                    variant="outline"
                    size="md"
                    disabled={!selectedFile || busy}
                    onClick={() => void runExcelModify()}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {modifyingExcel ? "正在修改…" : "生成 Excel 修改副本"}
                  </Button>
                ) : null}
                <Button
                  variant="primary"
                  size="md"
                  disabled={!selectedFile || busy}
                  onClick={() => void runInspection()}
                >
                  {inspecting ? "正在读取…" : "读取文件结构"}
                </Button>
              </div>

              {selectedExtension === ".docx" ? (
                <div className="space-y-3 rounded-ui-panel border border-border bg-surface-secondary/20 p-4">
                  <div>
                    <div className="text-sm font-semibold text-text-primary">Word 审阅验证</div>
                    <p className="mt-1 text-xs leading-5 text-text-tertiary">
                      使用精确文本锚点添加 Word 原生批注；填写建议替换文本时，会生成 Track Changes 删除 + 插入修订。
                    </p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-text-secondary">目标文本</span>
                      <input
                        value={wordReviewTarget}
                        onChange={(event) => setWordReviewTarget(event.target.value)}
                        placeholder="原文中可精确定位的一段文字"
                        className="h-10 w-full rounded-ui-control border border-border bg-surface-primary px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-primary/60"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-text-secondary">批注（可选）</span>
                      <input
                        value={wordReviewComment}
                        onChange={(event) => setWordReviewComment(event.target.value)}
                        placeholder="给这段文字添加批注"
                        className="h-10 w-full rounded-ui-control border border-border bg-surface-primary px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-primary/60"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-text-secondary">建议替换为（可选）</span>
                      <input
                        value={wordReviewReplacement}
                        onChange={(event) => setWordReviewReplacement(event.target.value)}
                        placeholder="生成删除 + 插入修订"
                        className="h-10 w-full rounded-ui-control border border-border bg-surface-primary px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-primary/60"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="md"
                      disabled={
                        !selectedFile ||
                        busy ||
                        !wordReviewTarget.trim() ||
                        (!wordReviewComment.trim() && !wordReviewReplacement.trim())
                      }
                      onClick={() => void runWordReview()}
                    >
                      <FileText className="h-4 w-4" />
                      {reviewingWord ? "正在生成审阅副本…" : "生成 Word 审阅副本"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {lastModified ? (
                <div className="flex flex-wrap items-center gap-2 rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3 text-sm">
                  <Download className="h-4 w-4 text-primary" />
                  <Badge variant="success">修改副本已生成</Badge>
                  <span className="font-medium text-text-primary">{lastModified.fileName}</span>
                  <span className="text-text-tertiary">{formatBytes(lastModified.byteSize)}</span>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">检查结果</h2>
                <p className="mt-1 text-sm text-text-secondary">这里展示 Runtime 返回的结构摘要，不做完整 Office 编辑器。</p>
              </div>

              {!inspection ? (
                <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-10 text-center text-sm text-text-tertiary">
                  选择文件并执行读取后，这里会显示结构、文本摘要和解析结果。
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">解析成功</Badge>
                    <Badge variant="neutral">{kindMeta[inspection.kind].label}</Badge>
                    <span className="text-sm text-text-secondary">{inspection.summary}</span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ResultBlock title="结构">
                      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-text-secondary">
                        {prettyJson(inspection.structure)}
                      </pre>
                    </ResultBlock>
                    <ResultBlock title="内容预览">
                      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-text-secondary">
                        {inspection.previewText || "没有可预览文本"}
                      </pre>
                    </ResultBlock>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="p-4">
            <div className="mb-3 text-sm font-semibold text-text-primary">Runtime 状态</div>
            <div className="space-y-2">
              {(Object.entries(kindMeta) as [OfficeSuiteFileKind, (typeof kindMeta)[OfficeSuiteFileKind]][]).map(
                ([kind, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <div
                      key={kind}
                      className="flex items-center gap-3 rounded-ui-control border border-border bg-surface-primary px-3 py-3"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-ui-control bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-text-primary">{meta.label}</div>
                        <div className="mt-0.5 truncate text-xs text-text-tertiary">{meta.runtime}</div>
                      </div>
                      <Badge variant="success">
                        {kind === "powerpoint"
                          ? "Inspect + Rich Create"
                          : kind === "word"
                            ? "Inspect + Create + Modify + Review"
                            : "Inspect + Create + Modify"}
                      </Badge>
                    </div>
                  );
                },
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold text-text-primary">最近操作</div>
            {!recentOperation ? (
              <div className="mt-3 text-xs leading-5 text-text-tertiary">尚未执行操作。</div>
            ) : (
              <div className="mt-3 space-y-2 text-xs leading-5 text-text-secondary">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={recentOperation.status === "success" ? "success" : "danger"}>
                    {recentOperation.status === "success" ? "成功" : "失败"}
                  </Badge>
                  <span className="font-medium text-text-primary">{recentOperation.label}</span>
                </div>
                <div>耗时：{recentOperation.durationMs} ms</div>
                {recentOperation.fileName ? <div className="break-all">文件：{recentOperation.fileName}</div> : null}
                {recentOperation.byteSize !== undefined ? (
                  <div>大小：{formatBytes(recentOperation.byteSize)}</div>
                ) : null}
                {recentOperation.error ? (
                  <div className="break-words text-danger">错误：{recentOperation.error}</div>
                ) : null}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold text-text-primary">当前边界</div>
            <div className="mt-3 space-y-2 text-xs leading-5 text-text-secondary">
              <p>文枢现在同时提供完整 Skill Runtime 工作台和原有 Office Runtime 调试验证面。</p>
              <p>Word 已进入基础 Modify 与 Review 批注/修订验证；PDF / Excel / PowerPoint 的完整 Skill 能力由上方任务级工作台与对应 office_* 能力承载。</p>
              <p>Word Review 当前只对可安全定位的简单文本 run 做精确编辑；复杂 run 会明确失败，不做有损重写。</p>
              <p>不嵌 Chat；Skill 只暴露任务级 office_* 能力，不把 set_cell / add_slide 之类原子操作暴露给 Agent。</p>
            </div>
          </Card>
        </aside>
      </div>
    </MicroAppPageLayout>
  );
}

function ResultBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-ui-panel border border-border bg-surface-secondary/20 p-4">
      <div className="mb-3 text-xs font-medium text-text-tertiary">{title}</div>
      {children}
    </div>
  );
}
