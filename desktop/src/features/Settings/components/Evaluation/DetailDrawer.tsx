import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button, IconButton } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import type { EvaluationRunRecord } from "@/features/Settings/pages/Evaluation/types";
import StatusBadge from "./StatusBadge";
import MetricGrid from "./MetricGrid";

const formatTime = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function DetailDrawer({
  open,
  run,
  onClose,
}: {
  open: boolean;
  run: EvaluationRunRecord | null;
  onClose: () => void;
}) {
  if (!open || !run) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="关闭详情抽屉"
        className="absolute inset-0 bg-black/25"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[760px] flex-col border-l border-border bg-surface-primary shadow-shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-text-primary">{run.name}</div>
              <StatusBadge status={run.status} />
            </div>
            <div className="text-xs text-text-secondary">
              {run.dataset.datasetName} · {run.dataset.summary.sampleCount} 条样本 ·
              完成于 {formatTime(run.completedAt)}
            </div>
          </div>
          <IconButton ariaLabel="关闭抽屉" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </header>

        <div className="stable-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <MetricGrid metrics={run.metrics} compact />

          <div className="grid gap-3 md:grid-cols-2">
            <Card
              label="运行配置"
              value={`topK ${run.dataset.config.topK} / topN ${run.dataset.config.topN}`}
              description={`模式 ${run.dataset.config.mode === "retrieve" ? "仅检索" : "检索+生成"} · 重复 ${run.dataset.config.repeat} 次`}
              className="px-3.5 py-3"
            />
            <Card
              label="数据集"
              value={run.dataset.datasetName}
              description={`文档 ${run.dataset.summary.documentCount} 份 · 样本 ${run.dataset.summary.sampleCount} 条`}
              className="px-3.5 py-3"
            />
          </div>

          <section className="space-y-2">
            <div className="text-sm font-semibold text-text-primary">校验结果</div>
            <div className="space-y-2">
              {run.dataset.validations.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-surface-secondary px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-text-primary">{item.label}</div>
                    <StatusBadge
                      status={
                        item.status === "pass"
                          ? "completed"
                          : item.status === "warning"
                            ? "running"
                            : "failed"
                      }
                    />
                  </div>
                  <div className="mt-1 text-xs leading-5 text-text-secondary">{item.detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="text-sm font-semibold text-text-primary">样本明细</div>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full">
                <thead className="bg-surface-secondary">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                      样本
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                      状态
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                      Hit
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                      Latency
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {run.sampleResults.map((item, index) => (
                    <tr key={item.id} className={index > 0 ? "border-t border-border" : ""}>
                      <td className="px-3 py-2 text-sm text-text-primary">
                        <div className="line-clamp-2 max-w-[360px]">{item.question}</div>
                      </td>
                      <td className="px-3 py-2 text-sm text-text-primary">
                        {item.status === "success" ? "成功" : "失败"}
                      </td>
                      <td className="px-3 py-2 text-sm text-text-primary">{item.hit ? "命中" : "未命中"}</td>
                      <td className="px-3 py-2 text-sm text-text-primary">{(item.latencyMs / 1000).toFixed(1)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <div className="text-sm font-semibold text-text-primary">运行日志</div>
            <div className="rounded-xl border border-border bg-[#0d1320] px-3.5 py-3 font-mono text-xs leading-6 text-slate-200">
              {run.logs.map((log) => (
                <div key={log.id}>
                  <span className="text-slate-400">[{log.timestamp}]</span> {log.text}
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            关闭
          </Button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

export default DetailDrawer;
