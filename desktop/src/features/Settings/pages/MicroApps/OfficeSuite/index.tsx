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
  const [lastArtifact, setLastArtifact] = useState<{
    label: string;
    fileName: string;
    byteSize: number;
  } | null>(null);

  const selectedExtension = useMemo(() => {
    if (!selectedFile) return "";
    const index = selectedFile.name.lastIndexOf(".");
    return index >= 0 ? selectedFile.name.slice(index).toLowerCase() : "";
  }, [selectedFile]);

  const busy =
    inspecting ||
    modifyingWord ||
    reviewingWord ||
    modifyingExcel ||
    creatingKind !== null;

  const chooseFile = (file?: File | null) => {
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".docx", ".xlsx", ".pptx"].includes(extension)) {
      message.warning("基础 Office Runtime 只接受 .docx、.xlsx 和 .pptx；PDF 请使用上方 Skill Runtime");
      return;
    }
    setSelectedFile(file);
    setInspection(null);
    setLastArtifact(null);
    setWordReviewTarget("");
    setWordReviewComment("");
    setWordReviewReplacement("");
  };

  const runInspection = async () => {
    if (!selectedFile) {
      message.warning("请先选择一个 Office 文件");
      return;
    }
    setInspecting(true);
    try {
      setInspection(await inspectOfficeFile(selectedFile));
      message.success("文件结构读取完成");
    } catch (error) {
      message.error(errorMessage(error, "文件读取失败"));
    } finally {
      setInspecting(false);
    }
  };

  const runCreate = async (kind: OfficeSuiteFileKind) => {
    setCreatingKind(kind);
    try {
      const artifact = await createOfficeSample(kind);
      downloadArtifact(artifact);
      setLastArtifact({
        label: `${kindMeta[kind].label} 测试产物`,
        fileName: artifact.fileName,
        byteSize: artifact.blob.size,
      });
      message.success(`${kindMeta[kind].label} 测试产物已生成`);
    } catch (error) {
      message.error(errorMessage(error, "Office 文件生成失败"));
    } finally {
      setCreatingKind(null);
    }
  };

  const runWordModify = async () => {
    if (!selectedFile || selectedExtension !== ".docx") return;
    setModifyingWord(true);
    try {
      const artifact = await createWordVerificationCopy(selectedFile);
      downloadArtifact(artifact);
      setLastArtifact({ label: "Word 修改副本", fileName: artifact.fileName, byteSize: artifact.blob.size });
      message.success("Word 修改副本已生成，原文件未覆盖");
    } catch (error) {
      message.error(errorMessage(error, "Word 修改失败"));
    } finally {
      setModifyingWord(false);
    }
  };

  const runWordReview = async () => {
    if (!selectedFile || selectedExtension !== ".docx") return;
    const targetText = wordReviewTarget.trim();
    const commentText = wordReviewComment.trim();
    const replacementText = wordReviewReplacement.trim();
    if (!targetText) {
      message.warning("请填写要定位的目标文本");
      return;
    }
    if (!commentText && !replacementText) {
      message.warning("请至少填写批注或建议替换文本");
      return;
    }
    setReviewingWord(true);
    try {
      const artifact = await createWordReviewCopy(selectedFile, {
        author: "Mira",
        comment: commentText ? { targetText, text: commentText } : undefined,
        insertion: replacementText ? { afterText: targetText, text: replacementText } : undefined,
        deletion: replacementText ? { targetText } : undefined,
      });
      downloadArtifact(artifact);
      setLastArtifact({ label: "Word 审阅副本", fileName: artifact.fileName, byteSize: artifact.blob.size });
      message.success("Word 审阅副本已生成");
    } catch (error) {
      message.error(errorMessage(error, "Word 审阅失败"));
    } finally {
      setReviewingWord(false);
    }
  };

  const runExcelModify = async () => {
    if (!selectedFile || selectedExtension !== ".xlsx") return;
    setModifyingExcel(true);
    try {
      const artifact = await createExcelVerificationCopy(selectedFile);
      downloadArtifact(artifact);
      setLastArtifact({ label: "Excel 修改副本", fileName: artifact.fileName, byteSize: artifact.blob.size });
      message.success("Excel 修改副本已生成，原文件未覆盖");
    } catch (error) {
      message.error(errorMessage(error, "Excel 修改失败"));
    } finally {
      setModifyingExcel(false);
    }
  };

  return (
    <MicroAppPageLayout
      miniTitle="MicroAPP"
      title="文枢"
      description="DOCX、PDF、Excel 与 PowerPoint 的本地文档能力工作台。Skill 负责业务语义，文枢 Runtime 负责确定性生成、处理与验证。"
      contentClassName="space-y-5 pt-5"
    >
      <Card className="border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-ui-control bg-surface-primary text-primary shadow-shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <div className="font-serif text-lg font-semibold text-text-primary">WenShu Runtime</div>
              <div className="text-sm text-text-secondary">一个微应用，四类 Skill；Python 统一复用系统开发小套件。</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">本地优先</Badge>
            <Badge variant="muted">Task-level Tools</Badge>
            <Badge variant="muted">不暴露 Office 原子操作</Badge>
          </div>
        </div>
      </Card>

      <SkillRuntimePanel />

      <Card className="p-5">
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">基础 Office Runtime 兼容验证</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              保留原来的 DOCX / XLSX / PPTX 基础链路，用于回归旧 Runtime。正式 PDF、Excel 与 PPT Skill 能力以上方全能力工作台和 Agent Skill 为准。
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(Object.entries(kindMeta) as [OfficeSuiteFileKind, (typeof kindMeta)[OfficeSuiteFileKind]][]).map(
              ([kind, meta]) => {
                const Icon = meta.icon;
                return (
                  <Button
                    key={kind}
                    variant="outline"
                    size="md"
                    disabled={busy}
                    onClick={() => void runCreate(kind)}
                  >
                    <Icon className="h-4 w-4" />
                    {creatingKind === kind ? "正在生成…" : `生成 ${meta.label} 测试产物`}
                  </Button>
                );
              },
            )}
          </div>
          {lastArtifact ? (
            <div className="flex flex-wrap items-center gap-2 rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3 text-sm">
              <Download className="h-4 w-4 text-primary" />
              <Badge variant="success">{lastArtifact.label}</Badge>
              <span className="font-medium text-text-primary">{lastArtifact.fileName}</span>
              <span className="text-text-tertiary">{formatBytes(lastArtifact.byteSize)}</span>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-text-primary">已有 Office 文件</h2>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Inspect DOCX/XLSX/PPTX；Word 可验证副本修改和 Review，Excel 可验证基础修改副本。
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
              className="flex min-h-32 w-full flex-col items-center justify-center gap-3 rounded-ui-panel border border-dashed border-border bg-surface-secondary/20 px-5 py-6 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <Upload className="h-5 w-5 text-primary" />
              <div className="text-sm font-medium text-text-primary">
                {selectedFile ? selectedFile.name : "选择 .docx / .xlsx / .pptx"}
              </div>
              {selectedFile ? (
                <div className="text-xs text-text-tertiary">{selectedExtension} · {formatBytes(selectedFile.size)}</div>
              ) : null}
            </button>
            <div className="flex flex-wrap justify-end gap-2">
              {selectedExtension === ".docx" ? (
                <Button variant="outline" size="md" disabled={busy} onClick={() => void runWordModify()}>
                  {modifyingWord ? "修改中…" : "Word 修改副本"}
                </Button>
              ) : null}
              {selectedExtension === ".xlsx" ? (
                <Button variant="outline" size="md" disabled={busy} onClick={() => void runExcelModify()}>
                  {modifyingExcel ? "修改中…" : "Excel 修改副本"}
                </Button>
              ) : null}
              <Button variant="primary" size="md" disabled={!selectedFile || busy} onClick={() => void runInspection()}>
                {inspecting ? "读取中…" : "读取文件结构"}
              </Button>
            </div>

            {selectedExtension === ".docx" ? (
              <div className="space-y-3 rounded-ui-panel border border-border bg-surface-secondary/20 p-4">
                <div className="text-sm font-semibold text-text-primary">Word Review</div>
                <input
                  value={wordReviewTarget}
                  onChange={(event) => setWordReviewTarget(event.target.value)}
                  placeholder="精确目标文本"
                  className="h-10 w-full rounded-ui-control border border-border bg-surface-primary px-3 text-sm text-text-primary outline-none focus:border-primary/60"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={wordReviewComment}
                    onChange={(event) => setWordReviewComment(event.target.value)}
                    placeholder="原生批注（可选）"
                    className="h-10 w-full rounded-ui-control border border-border bg-surface-primary px-3 text-sm text-text-primary outline-none focus:border-primary/60"
                  />
                  <input
                    value={wordReviewReplacement}
                    onChange={(event) => setWordReviewReplacement(event.target.value)}
                    placeholder="Track Changes 建议替换（可选）"
                    className="h-10 w-full rounded-ui-control border border-border bg-surface-primary px-3 text-sm text-text-primary outline-none focus:border-primary/60"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="md"
                    disabled={busy || !wordReviewTarget.trim() || (!wordReviewComment.trim() && !wordReviewReplacement.trim())}
                    onClick={() => void runWordReview()}
                  >
                    {reviewingWord ? "生成中…" : "生成审阅副本"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-5">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-text-primary">基础 Inspect 结果</h2>
              <p className="mt-1 text-sm text-text-secondary">旧 Office Runtime 的结构摘要与内容预览。</p>
            </div>
            {!inspection ? (
              <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-12 text-center text-sm text-text-tertiary">
                选择文件并读取后显示结果。
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">解析成功</Badge>
                  <Badge variant="neutral">{kindMeta[inspection.kind].label}</Badge>
                  <span className="text-sm text-text-secondary">{inspection.summary}</span>
                </div>
                <ResultBlock title="结构">
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-text-secondary">
                    {prettyJson(inspection.structure)}
                  </pre>
                </ResultBlock>
                <ResultBlock title="内容预览">
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-text-secondary">
                    {inspection.previewText || "没有可预览文本"}
                  </pre>
                </ResultBlock>
              </div>
            )}
          </div>
        </Card>
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
