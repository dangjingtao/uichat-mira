export function DashboardGreeting({
  username,
  newsCount,
  mailCount,
}: {
  username: string;
  newsCount: number;
  mailCount: number;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 6 ? "夜深了" : hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <section className="rounded-ui-panel border border-border bg-surface-soft px-5 py-3 text-sm text-text-secondary" aria-label="工作台摘要">
      {greeting}，{username}。今天有 {newsCount} 条新闻摘要，{mailCount} 封邮件值得留意。
    </section>
  );
}
