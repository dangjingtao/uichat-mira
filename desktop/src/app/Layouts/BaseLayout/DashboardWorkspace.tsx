import DashboardPage from "@/features/dashboard/DashboardPage";
import { SettingsNavigation, WorkspaceShell } from "./layoutShared";

export function DashboardWorkspace({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <div className="flex min-h-0 flex-1"><WorkspaceShell showBackToChatLink={false} sidebarContent={<SettingsNavigation />} mainContent={<DashboardPage />} shellClassName="rounded-l-[28px] border border-border/70 bg-surface-secondary shadow-[0_1px_2px_rgba(15,23,42,0.03)]" /></div>;
}
