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
      className={`h-full w-64 shrink-0 border-r bg-zinc-50 dark:bg-zinc-900 flex flex-col ${
        open ? "" : "hidden md:flex"
      }`}
    >
      {/* 顶部 Logo / 标题区 */}
      <div className="px-3 py-3 font-semibold text-lg border-b flex items-center">
        <img
          src="https://uichat.tomz.io/assets/logoIcon.BiG6rto6.png"
          alt="Logo"
          className="inline-block mr-2 h-6"
        />{" "}
        <div>RAG Tester</div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pt-2">
        {children}
      </div>

      <div className="flex items-center justify-between rounded-xs border border-slate-200 bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-1 text-sm text-slate-600">
          <span>
            <span className="font-semibold text-slate-900">
              {session?.user.username || "未知用户"}
            </span>
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {session?.user.role}
          </span>
          <span className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${backendStatusColorClass}`}
            />
          </span>
        </div>
        <div className="flex items-center gap-x-1">
          <button
            onClick={() => toSettings("/settings/general")}
            className="rounded-lg  px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>

          <button
            onClick={() => logout()}
            className="rounded-lg  px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            <LogOutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
