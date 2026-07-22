import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileArchive,
  FileSpreadsheet,
  FileText,
  Play,
  Presentation,
  RefreshCw,
  Upload,
} from "lucide-react";
import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";
import { Button } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  getWenshuRuntimeStatus,
  runWenshuSkillTask,
  type WenshuRuntimeStatus,
  type WenshuSkillDomain,
} from "@/shared/api/officeSuiteSkills";

const domainMeta: Record<
  WenshuSkillDomain,
  { label: string; icon: typeof FileText; accept: string; operations: string }
> = {
  pdf: {
    label: "PDF",
    icon: FileText,
    accept: ".pdf,.md,.markdown",
    operations:
      "create / md2pdf / extract_text / extract_tables / extract_images / form_info / form_fill / merge / split / rotate / crop / meta_get / meta_set",
  },
  xlsx: {
    label: "Excel",
    icon: FileSpreadsheet,
    accept: ".xlsx",
    operations: "create / modify / inspect / recalc / verify",
  },
  pptx: {
    label: "PowerPoint",
    icon: Presentation,
    accept: ".pptx",
    operations: "create / validate / inspect",
  },
};

const examples: Record<WenshuSkillDomain, Record<string, unknown>> = {
  pdf: {
    operation: "create",
    outputName: "wenshu-report.pdf",
    spec: {
      title: "文枢 PDF Runtime",
      author: "Mira",
      pageNumbers: true,
      blocks: [
        { type: "heading1", text: "能力验证" },
        { type: "paragraph", text: "这是一份由文枢 PDF Domain Runtime 生成的验证文档。" },
        {
          type: "table",
          rows: [
            ["能力", "状态"],
            ["Create", "Ready"],
            ["Process", "Ready"],
          ],
        },
      ],
    },
  },
  xlsx: {
    operation: "create",
    outputName: "wenshu-model.xlsx",
    spec: {
      metadata: { creator: "Mira", title: "文枢 Excel Runtime" },
      sheets: [
        {
          name: "Model",
          rows: [
            ["项目", "2025A", "2026E"],
            ["Revenue", 100, { formula: "B2*1.10", style: { numberFormat: "0.0" } }],
          ],
          freezePanes: "A2",
          columns: { A: 24, B: 14, C: 14 },
          charts: [
            {
              type: "column",
              title: "Revenue",
              anchor: "E2",
              data: {
                minCol: 2,
                maxCol: 3,
                minRow: 1,
                maxRow: 2,
                titlesFromData: true,
              },
              categories: { minCol: 1, maxCol: 1, minRow: 2, maxRow: 2 },
            },
          ],
        },
      ],
    },
  },
  pptx: {
    operation: "create",
    outputName: "wenshu-deck.pptx",
    spec: {
      size: [960, 540],
      theme: {
        colors: { primary: "#C15F3C", ink: "#24211F", surface: "#F6F1EA" },
        textStyles: {
          title: {
            fontFamily: "Microsoft YaHei",
            fontSize: 32,
            bold: true,
            color: "$ink",
          },
          body: { fontFamily: "Microsoft YaHei", fontSize: 18, color: "$ink" },
        },
      },
      pages: [
        {
          background: "$surface",
          elements: [
            {
              id: "title",
              elementType: "text",
              bounds: [64, 64, 820, 70],
              content: { style: "$title", text: "文枢 Presentation Runtime" },
            },
            {
              id: "body",
              elementType: "text",
              bounds: [64, 170, 650, 120],
              content: {
                style: "$body",
                text: "结构化 AST → 校验 → PPTX，可编辑文本、形状、表格和图表。",
              },
            },
          ],
        },
      ],
    },
  },
};

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

export default function SkillRuntimePanel() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [domain, setDomain] = useState<WenshuSkillDomain>("pdf");
  const [taskText, setTaskText] = useState(() => pretty(examples.pdf));
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<WenshuRuntimeStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  const runtime = useMemo(
    () => status?.runtimes.find((item) => item.id === domain) ?? null,
    [domain, status],
  );

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      setStatus(await getWenshuRuntimeStatus());
    } catch (error) {
      message.error(error instanceof Error ? error.message : "无法读取 Python Runtime 状态");
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const switchDomain = (next: WenshuSkillDomain) => {
    setDomain(next);
    setTaskText(pretty(examples[next]));
    setFiles([]);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const run = async () => {
    let task: Record<string, unknown>;
    try {
      const parsed = JSON.parse(taskText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Task 必须是 JSON object");
      }
      task = parsed as Record<string, unknown>;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Task JSON 无效");
      return;
    }

    setRunning(true);
    setResult(null);
    try {
      const response = await runWenshuSkillTask(domain, task, files);
      if (response.type === "download") {
        downloadBlob(response.blob, response.fileName);
        setResult({
          type: "artifact",
          fileName: response.fileName,
          mimeType: response.mimeType,
          byteSize: response.blob.size,
        });
        message.success(`${response.fileName} 已生成`);
      } else {
        setResult(response.data);
        message.success("Domain Runtime 执行完成");
      }
      void loadStatus();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Domain Runtime 执行失败";
      setResult({ error: detail });
      message.error(detail);
    } finally {
      setRunning(false);
    }
  };

  const Icon = domainMeta[domain].icon;

  return (
    <Card className="p-5">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-ui-control bg-primary/10 text-primary">
              <FileArchive className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-text-primary">文枢增强 Runtime 工作台</h2>
              <p className="mt-1 text-sm text-text-secondary">
                PDF / Excel / PPT 使用系统开发小套件 Python；这里验证确定性 Domain Runtime，不代表正式 Agent Skill Runtime。
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadStatus()}
            disabled={statusLoading}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${statusLoading ? "animate-spin" : ""}`} />
            刷新 Runtime
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(domainMeta) as WenshuSkillDomain[]).map((item) => {
            const itemStatus = status?.runtimes.find((entry) => entry.id === item);
            const DomainIcon = domainMeta[item].icon;
            return (
              <button
                key={item}
                type="button"
                onClick={() => switchDomain(item)}
                className={`flex items-center gap-2 rounded-ui-control border px-3 py-2 text-sm transition-colors ${
                  domain === item
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border-primary bg-surface-primary text-text-secondary hover:text-text-primary"
                }`}
              >
                <DomainIcon className="h-4 w-4" />
                {domainMeta[item].label}
                <span
                  className={`h-2 w-2 rounded-full ${itemStatus?.available ? "bg-success" : "bg-warning"}`}
                />
              </button>
            );
          })}
        </div>

        <div className="rounded-ui-control border border-border-primary bg-surface-secondary/40 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <span className="font-medium text-text-primary">{domainMeta[domain].label} Domain Runtime</span>
            {runtime?.available ? (
              <Badge variant="muted">Ready</Badge>
            ) : (
              <Badge variant="warning">Needs dependency</Badge>
            )}
          </div>
          <div className="mt-2 text-xs leading-5 text-text-secondary">
            <div>Python: {runtime?.python || "检测中…"}</div>
            <div>Operations: {domainMeta[domain].operations}</div>
            {runtime?.missing?.length ? <div>Missing: {runtime.missing.join(", ")}</div> : null}
            {runtime?.error ? <div className="break-all">Runtime: {runtime.error}</div> : null}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-2 text-sm font-medium text-text-primary">Task JSON</div>
            <textarea
              value={taskText}
              onChange={(event) => setTaskText(event.target.value)}
              spellCheck={false}
              className="min-h-[360px] w-full resize-y rounded-ui-control border border-border-primary bg-surface-primary px-3 py-2 font-mono text-xs leading-5 text-text-primary outline-none focus:border-primary/50"
            />
          </div>

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium text-text-primary">输入文件</div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={domainMeta[domain].accept}
                className="hidden"
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex min-h-28 w-full flex-col items-center justify-center rounded-ui-control border border-dashed border-border-primary bg-surface-secondary/30 px-3 py-4 text-center hover:border-primary/40"
              >
                <Upload className="mb-2 h-5 w-5 text-text-secondary" />
                <span className="text-sm text-text-primary">选择文件</span>
                <span className="mt-1 text-xs text-text-secondary">
                  {domain === "pdf" ? "Merge 可一次选择多个 PDF" : domainMeta[domain].accept}
                </span>
              </button>
              {files.length > 0 ? (
                <div className="mt-2 max-h-28 space-y-1 overflow-auto text-xs text-text-secondary">
                  {files.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="truncate">
                      {file.name}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <Button className="w-full" onClick={() => void run()} disabled={running}>
              <Play className="mr-1 h-4 w-4" />
              {running ? "执行中…" : "执行 Runtime Task"}
            </Button>

            <div>
              <div className="mb-2 text-sm font-medium text-text-primary">最近结果</div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-ui-control border border-border-primary bg-surface-secondary/40 p-3 text-xs leading-5 text-text-secondary">
                {result ? pretty(result) : "尚未执行"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
