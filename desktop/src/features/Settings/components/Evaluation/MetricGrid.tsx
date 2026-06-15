import Card from "@/shared/ui/Card";
import type { EvaluationMetricSummary } from "@/features/Settings/pages/Evaluation/types";

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export function MetricGrid({
  metrics,
  compact = false,
}: {
  metrics: EvaluationMetricSummary;
  compact?: boolean;
}) {
  const cards = [
    {
      label: "Hit@K",
      value: formatPercent(metrics.hitAtK),
      description: "检索命中率",
    },
    {
      label: "Recall@K",
      value: formatPercent(metrics.recallAtK),
      description: "平均召回覆盖",
    },
    {
      label: "MRR",
      value: metrics.mrr.toFixed(2),
      description: "排序质量",
    },
    {
      label: "Faithfulness",
      value: formatPercent(metrics.faithfulness),
      description: "答案贴合来源",
    },
    {
      label: "Source Hit",
      value: formatPercent(metrics.sourceHitRate),
      description: "来源命中率",
    },
    {
      label: "Avg Latency",
      value: `${(metrics.averageLatencyMs / 1000).toFixed(1)}s`,
      description: `${metrics.failedCount} 条失败`,
    },
  ];

  return (
    <div className={`grid gap-2.5 ${compact ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-3"}`}>
      {cards.map((card) => (
        <Card
          key={card.label}
          label={card.label}
          value={card.value}
          description={card.description}
          className="min-h-[92px] px-3.5 py-3"
        />
      ))}
    </div>
  );
}

export default MetricGrid;
