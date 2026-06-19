// src/assistant/ThreadListSidebar.tsx
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import logoIcon from "@/assets/branding/uichat-logo-icon.png";
import { useRuntimeHealth } from "@/features/system/hooks/useRuntimeHealth";
import { LogOutIcon, SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

const statusColorMap = {
  unknown: "bg-amber-500",
  running: "bg-green-600",
  stopped: "bg-red-600",
} as const;

function Sidebar({
  children,
  footerCenter,
}: {
  children: React.ReactNode;
  footerCenter?: React.ReactNode;
}) {
  const { t } = useTranslation();
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
      className={`flex h-[100dvh] min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r border-border/70 bg-surface-tertiary ${open ? "" : "hidden md:flex"}`}
    >
      <div
        className={`flex items-center text-base font-semibold bg-surface-tertiary px-4 py-4`}
      >
        <img src={logoIcon} alt="Logo" className="mr-2.5 inline-block h-8" />
        <span className="text-text-primary font-semibold">RAG Tester</span>
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-tertiary py-2.5 pl-1 pr-2`}
      >
        {children}
      </div>

      <div className={"bg-surface-tertiary px-3 py-3"}>
        <div className={`flex items-center justify-between px-1 py-0.5`}>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${backendStatusColorClass}`}
            />
            <div className="text-sm font-medium text-text-primary">
              {session?.user.username || t("app.sidebar.unknownUser")}
            </div>
          </div>
          <div className="flex items-center gap-1 pr-1">
            {footerCenter}
            <button
              onClick={() => toSettings("/settings/general")}
              className="rounded-[10px] px-2 py-1.5 text-text-secondary transition-all duration-150 hover:bg-primary/7 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>

            <button
              onClick={() => logout()}
              className="rounded-[10px] px-2 py-1.5 text-text-secondary transition-all duration-150 hover:bg-primary/7 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
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
