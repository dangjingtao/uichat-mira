import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CloudUpload,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Trash2,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { message } from "@/shared/ui/Message";

type UploadStep = 1 | 2 | 3;

type UploadFileItem = {
  id: string;
  name: string;
  extension: string;
  sizeLabel: string;
};

const initialFiles: UploadFileItem[] = [
  {
    id: "seed-1",
    name: "AI赋能招商方案0603.md",
    extension: "MD",
    sizeLabel: "22.96 KB",
  },
  {
    id: "seed-2",
    name: "党涛涛-简历.pdf",
    extension: "PDF",
    sizeLabel: "403.84 KB",
  },
];

const stepLabels = [
  { step: 1 as UploadStep, label: "选择数据源" },
  { step: 2 as UploadStep, label: "文本分段与清洗" },
  { step: 3 as UploadStep, label: "处理并完成" },
];

function resolveStep(value: string | null): UploadStep {
  if (value === "2") return 2;
  if (value === "3") return 3;
  return 1;
}

function getFileIcon(extension: string) {
  if (extension === "PDF") {
    return <FileText className="h-5 w-5 text-rose-500" />;
  }

  if (extension === "XLSX" || extension === "XLS") {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
  }

  return <FileCode2 className="h-5 w-5 text-sky-500" />;
}

function StepHeader({ currentStep }: { currentStep: UploadStep }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-border bg-surface-primary px-6 py-4 shadow-shadow-sm">
      {stepLabels.map((item, index) => {
        const active = item.step === currentStep;
        const completed = item.step < currentStep;

        return (
          <div key={item.step} className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex min-w-[56px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  active
                    ? "bg-primary text-white"
                    : completed
                      ? "bg-primary/10 text-primary"
                      : "border border-border bg-surface-secondary text-text-tertiary"
                }`}
              >
                {active ? `STEP ${item.step}` : item.step}
              </span>
              <span
                className={`text-sm font-medium ${
                  active || completed ? "text-text-primary" : "text-text-tertiary"
                }`}
              >
                {item.label}
              </span>
            </div>

            {index < stepLabels.length - 1 ? (
              <div className="h-px w-12 bg-border" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function KnowledgeBaseAddWizard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStep = resolveStep(searchParams.get("step"));
  const [files, setFiles] = useState<UploadFileItem[]>(initialFiles);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const canProceed = files.length > 0;

  const helperText = useMemo(
    () =>
      "已支持 MARKDOWN、XLSX、TXT、HTML、PROPERTIES、DOCX、CSV、PDF、HTM、XLS、MDX、MD，每批最多 5 个文件，每个文件不超过 15 MB。",
    [],
  );

  const appendFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }

    const nextFiles = Array.from(selectedFiles)
      .slice(0, 5)
      .map((file) => {
        const extension = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
        const sizeInKb = Math.max(file.size / 1024, 1);

        return {
          id: `${file.name}-${file.lastModified}`,
          name: file.name,
          extension,
          sizeLabel: `${sizeInKb.toFixed(2)} KB`,
        };
      });

    setFiles((current) => {
      const merged = [...current];

      for (const item of nextFiles) {
        if (merged.some((existing) => existing.id === item.id)) {
          continue;
        }

        if (merged.length >= 5) {
          break;
        }

        merged.push(item);
      }

      return merged;
    });

    message.success("已添加文件到上传列表");
  };

  const removeFile = (id: string) => {
    setFiles((current) => current.filter((item) => item.id !== id));
    message.info("已移除文件");
  };

  const goToStep = (step: UploadStep) => {
    setSearchParams({ step: `${step}` });
  };

  const renderStepOne = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">上传文本文件</h1>
        <p className="text-sm text-text-secondary">
          先选择需要导入知识库的文件。当前页面使用假数据和前端交互来模拟上传流程。
        </p>
      </div>

      <Card className="p-0">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-4 rounded-xl border border-dashed border-border bg-surface-secondary px-5 py-6 text-left transition-all duration-150 hover:bg-surface-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-surface-primary shadow-shadow-sm">
            <CloudUpload className="h-5 w-5 text-icon-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-medium text-text-primary">
              拖拽文件或文件夹到此，或者
              <span className="ml-1 text-primary">选择文件</span>
            </div>
            <div className="mt-1 text-sm leading-6 text-text-secondary">{helperText}</div>
          </div>
        </button>
      </Card>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".md,.markdown,.txt,.html,.htm,.properties,.docx,.csv,.pdf,.xls,.xlsx,.mdx"
        onChange={(event) => {
          appendFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="space-y-3">
        {files.map((file) => (
          <Card key={file.id} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-secondary">
                  {getFileIcon(file.extension)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-medium text-text-primary">
                    {file.name}
                  </div>
                  <div className="text-sm text-text-secondary">
                    {file.extension} · {file.sizeLabel}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-text-secondary transition-all duration-150 hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          disabled={!canProceed}
          onClick={() => {
            if (!canProceed) {
              return;
            }

            goToStep(2);
          }}
        >
          下一步
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderPlaceholderStep = (step: 2 | 3) => (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">
          {step === 2 ? "文本分段与清洗" : "处理并完成"}
        </h1>
        <p className="text-sm text-text-secondary">
          当前先把 Step 1 路由和交互搭好。这个步骤我已经留好入口，后续可以继续按你的设计图补全。
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-3">
          <div className="text-base font-medium text-text-primary">占位说明</div>
          <p className="text-sm leading-6 text-text-secondary">
            这里会接后续的分段策略、清洗规则、处理结果与完成页内容。现在先保留在分步流中，方便继续扩展。
          </p>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => goToStep((step - 1) as UploadStep)}>
          <ArrowLeft className="h-4 w-4" />
          上一步
        </Button>

        {step === 2 ? (
          <Button onClick={() => goToStep(3)}>
            下一步
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => navigate("/settings/knowledge-base")}>完成</Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate("/settings/knowledge-base")}>
          <ArrowLeft className="h-4 w-4" />
          返回知识库
        </Button>
      </div>

      <StepHeader currentStep={currentStep} />

      <div className="min-h-[520px] rounded-2xl border border-border bg-surface-primary px-6 py-8 shadow-shadow-sm">
        {currentStep === 1 ? renderStepOne() : null}
        {currentStep === 2 ? renderPlaceholderStep(2) : null}
        {currentStep === 3 ? renderPlaceholderStep(3) : null}
      </div>
    </div>
  );
}
