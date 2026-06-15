import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import Card from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import MinimalTable from "@/shared/ui/Table";
import { removeEvaluationRun, writeEvaluationRuns, readEvaluationRuns } from "./storage";
import type { EvaluationRunRecord } from "./types";
import StatusBadge from "../../components/Evaluation/StatusBadge";
import DetailDrawer from "../../components/Evaluation/DetailDrawer";
import { message } from "@/shared/ui/Message";
import type { ColumnDef } from "@tanstack/react-table";

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatDate = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function EvaluationCenter() {
  const [runs, setRuns] = useState<EvaluationRunRecord[]>(() => readEvaluationRuns());
  const [query, setQuery] = useState("");
  const [selectedRun, setSelectedRun] = useState<EvaluationRunRecord | null>(null);

  const filteredRuns = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return runs;
    }

    return runs.filter((run) =>
      [run.name, run.dataset.datasetName].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [query, runs]);

  const columns = useMemo<ColumnDef<EvaluationRunRecord>[]>(
    () => [
      {
        header: "任务名",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <div className="font-medium text-text-primary">{row.original.name}</div>
            <div className="mt-1 text-xs text-text-secondary">
              {row.original.dataset.datasetName}
            </div>
          </div>
        ),
      },
      {
        header: "状态",
        accessorKey: "status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        header: "样本数",
        accessorKey: "sampleCount",
        cell: ({ row }) => row.original.dataset.summary.sampleCount,
      },
      {
        header: "核心指标",
        accessorKey: "metrics",
        cell: ({ row }) => (
          <div className="min-w-[150px] text-sm text-text-primary">
            Hit@K {formatPercent(row.original.metrics.hitAtK)}
            <div className="mt-1 text-xs text-text-secondary">
              Faithfulness {formatPercent(row.original.metrics.faithfulness)}
            </div>
          </div>
        ),
      },
      {
        header: "完成时间",
        accessorKey: "completedAt",
        cell: ({ row }) => formatDate(row.original.completedAt),
      },
      {
        header: "操作",
        id: "actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRun(row.original)}
            >
              查看
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger/5 hover:text-danger"
              onClick={() => {
                removeEvaluationRun(row.original.id);
                const next = readEvaluationRuns();
                setRuns(next);
                if (selectedRun?.id === row.original.id) {
                  setSelectedRun(null);
                }
                message.success("已移除该评测记录");
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </Button>
          </div>
        ),
      },
    ],
    [selectedRun?.id],
  );

  return (
    <SettingsPageLayout
        miniTitle="Evaluation Center"
        title="评测中心"
        description="这里集中保存已经完成的评测结果。列表保持精简，只展示核心信息；点击查看后，通过右侧抽屉查看配置、指标、日志与样本明细。"
        containerClassName="max-w-none"
        slot={
          runs.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                writeEvaluationRuns([]);
                setRuns([]);
                setSelectedRun(null);
                message.success("已清空评测中心记录");
              }}
            >
              清空列表
            </Button>
          ) : undefined
        }
        contentClassName="flex h-full min-h-0 flex-col gap-4 pt-6"
      >

      <Card className="flex min-h-0 flex-1 flex-col gap-3 p-3.5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-border bg-surface-secondary px-3 py-2">
              <div className="text-xs uppercase tracking-[0.12em] text-text-tertiary">记录数</div>
              <div className="mt-1 text-base font-semibold text-text-primary">{runs.length}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface-secondary px-3 py-2">
              <div className="text-xs uppercase tracking-[0.12em] text-text-tertiary">最近完成</div>
              <div className="mt-1 text-base font-semibold text-text-primary">
                {runs[0] ? formatDate(runs[0].completedAt) : "--"}
              </div>
            </div>
          </div>

          <div className="relative w-full max-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-icon-secondary" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索任务名或数据集"
              className="h-9 w-full rounded-xl border border-border bg-surface-primary pl-9 pr-3 text-sm text-text-primary shadow-shadow-sm transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {filteredRuns.length > 0 ? (
            <div className="stable-scrollbar h-full overflow-auto">
              <MinimalTable data={filteredRuns} columns={columns} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-surface-secondary text-sm text-text-secondary">
              {runs.length === 0
                ? "当前还没有保存的评测结果。回到评测工作台运行一次任务后即可保存到这里。"
                : "没有匹配当前搜索条件的评测记录。"}
            </div>
          )}
        </div>
      </Card>

      <DetailDrawer
        open={Boolean(selectedRun)}
        run={selectedRun}
        onClose={() => setSelectedRun(null)}
      />
    </SettingsPageLayout>
  );
}
