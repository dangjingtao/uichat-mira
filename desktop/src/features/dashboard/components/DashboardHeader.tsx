import { LayoutDashboard } from "lucide-react";

export function DashboardHeader() {
  return (
    <header className="mb-6 flex items-start gap-3">
      <div className="mt-1 rounded-ui-control bg-primary/10 p-2 text-primary">
        <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-text-primary">Mira 工作台</h1>
        <p className="mt-1 text-sm text-text-secondary">你的智能助手，随时为你掌握全局</p>
      </div>
    </header>
  );
}
