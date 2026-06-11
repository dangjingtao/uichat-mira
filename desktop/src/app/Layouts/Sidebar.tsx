// src/assistant/ThreadListSidebar.tsx
import { useState, useMemo } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRuntimeHealth } from "@/features/system/hooks/useRuntimeHealth";
import { LogOutIcon, SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

const statusTextMap = {
  unknown: "检测中",
  running: "运行中",
  stopped: "未启动",
} as const;

const statusColorMap = {
  unknown: "bg-amber-500",
  running: "bg-green-600",
  stopped: "bg-red-600",
} as const;

function Sidebar({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const { backendState } = useRuntimeHealth();

  const [open, setOpen] = useState(true);

  const backendStatusColorClass = useMemo(
    () => statusColorMap[backendState.status],
    [backendState.status],
  );

  const navigate = useNavigate();

  const toSettings = (path: string) => {
    navigate(path);
  };

  return (
    <aside
      className={`h-full w-64 shrink-0 border-r border-border bg-surface-secondary flex flex-col ${
        open ? "" : "hidden md:flex"
      }`}
    >
      {/* 顶部 Logo / 标题区 */}
      <div className="px-4 py-4 font-semibold text-base border-b border-border flex items-center">
        <img
          src="https://uichat.tomz.io/assets/logoIcon.BiG6rto6.png"
          alt="Logo"
          className="inline-block mr-2.5 h-6"
        />{" "}
        <span className="text-text-primary">RAG Tester</span>
      </div>

      <div className="stable-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
        {children}
      </div>

      <div className="border-t border-border bg-surface-primary px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 flex-row">
              <div className="text-sm  text-text-primary">
                {session?.user.username || "未知用户"}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${backendStatusColorClass}`}
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => toSettings("/settings/general")}
              className="rounded-lg px-2 py-1.5 text-text-secondary transition-all hover:bg-surface-tertiary hover:text-text-primary"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>

            <button
              onClick={() => logout()}
              className="rounded-lg px-2 py-1.5 text-text-secondary transition-all hover:bg-surface-tertiary hover:text-text-primary"
            >
              <LogOutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
