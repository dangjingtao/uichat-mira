import { useMemo, useRef, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Presentation,
  Upload,
  WandSparkles,
} from "lucide-react";
import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";
import { Button } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  inspectOfficeFile,
  type OfficeSuiteFileKind,
  type OfficeSuiteInspection,
} from "@/shared/api/officeSuite";
import MicroAppPageLayout from "../components/MicroAppPageLayout";

const ACCEPTED_EXTENSIONS = ".docx,.xlsx,.xls,.pptx";

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

export default function OfficeSuitePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<OfficeSuiteInspection | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const selectedExtension = useMemo(() => {
    if (!selectedFile) return "";
    const index = selectedFile.name.lastIndexOf(".");
    return index >= 0 ? selectedFile.name.slice(index).toLowerCase() : "";
  }, [selectedFile]);

  const chooseFile = (file?: File | null) => {
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".docx", ".xlsx", ".xls", ".pptx"].includes(extension)) {
      message.warning("文枢当前只接受 Word、Excel 和 PowerPoint 文件");
      return;
    }
    setSelectedFile(file);
    setInspection(null);
  };

  const runInspection = async () => {
    if (!selectedFile) {
      message.warning("请先选择一个 Office 文件");
      return;
    }
    setInspecting(true);
    try {
      const result = await inspectOfficeFile(selectedFile);
      setInspection(result);
      message.success("文件结构读取完成");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "文件读取失败");
    } finally {
      setInspecting(false);
    }
  };

  return (
    <MicroAppPageLayout
      miniTitle="MicroAPP"
      title="文枢"
      description="Word、Excel 与 PowerPoint 的本地处理工作台。当前用于验证 Office Runtime，不在这里重复实现一套 Chat。"
      contentClassName="space-y-5 pt-5"
    >
      <Card className="border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-ui-control bg-surface-primary text-primary shadow-shadow-sm">
                <WandSparkles className="h-5 w-5" />
              </span>
              <div>
                <div className="font-serif text-lg font-semibold text-text-primary">Office Runtime</div>
                <div className="text-sm text-text-secondary">一个微应用，内部保持三类文件处理边界。</div>
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">文件输入</h2>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  第一阶段先把“文件进来 → 识别结构 → 返回可检查结果”跑稳。
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
                      : "支持 .docx / .xlsx / .xls / .pptx"}
                  </div>
                </div>
              </button>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  disabled={!selectedFile || inspecting}
                  onClick={() => void runInspection()}
                >
                  {inspecting ? "正在读取…" : "读取文件结构"}
                </Button>
              </div>
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
                      <Badge variant="success">已接入</Badge>
                    </div>
                  );
                },
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold text-text-primary">当前边界</div>
            <div className="mt-3 space-y-2 text-xs leading-5 text-text-secondary">
              <p>文枢现在是 Office Runtime 的调试和验证窗口。</p>
              <p>不嵌 Chat，不提前实现 Skill Runtime，也不把 set_cell / add_slide 之类原子操作暴露给 Agent。</p>
              <p>后续 Skill 成形后，再消费这里稳定下来的文件处理能力。</p>
            </div>
          </Card>
        </aside>
      </div>
    </MicroAppPageLayout>
  );
}

function ResultBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-ui-panel border border-border bg-surface-secondary/20 p-4">
      <div className="mb-3 text-xs font-medium text-text-tertiary">{title}</div>
      {children}
    </div>
  );
}
