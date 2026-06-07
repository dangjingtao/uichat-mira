import { useMemo } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useRuntimeHealth } from "../../system/hooks/useRuntimeHealth";

const statusTextMap = {
  unknown: "检测中",
  running: "运行中",
  stopped: "未启动",
} as const;

const dbStatusTextMap = {
  unknown: "检测中",
  running: "正常",
  stopped: "未联通",
} as const;

const statusColorMap = {
  unknown: "bg-amber-500",
  running: "bg-green-600",
  stopped: "bg-red-600",
} as const;

function HomePage() {
  const { session, logout } = useAuth();
  const { desktopApi, backendState, databaseState } = useRuntimeHealth();

  const backendStatusLabel = useMemo(
    () => statusTextMap[backendState.status],
    [backendState.status],
  );

  const databaseStatusLabel = useMemo(
    () => dbStatusTextMap[databaseState.status],
    [databaseState.status],
  );

  const backendStatusColorClass = useMemo(
    () => statusColorMap[backendState.status],
    [backendState.status],
  );

  const databaseStatusColorClass = useMemo(
    () => statusColorMap[databaseState.status],
    [databaseState.status],
  );

  if (!session) {
    return null;
  }

  return (
    <main className="mx-auto mt-10 max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-slate-600">
          当前用户：
          <span className="font-semibold text-slate-900">
            {session.user.username}
          </span>
          <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {session.user.role}
          </span>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
        >
          退出登录
        </button>
      </div>
      <h1 className="m-0 text-3xl font-semibold tracking-tight text-slate-900">
        UI Chat RAG Tester
      </h1>
      <p className="mt-3 text-slate-700">
        桌面端初始化完成。下一步可接入 Electron Shell 与知识库流程。
      </p>
      <p className="mt-2 text-slate-700">
        运行环境：
        {desktopApi ? ` Electron (${desktopApi.platform})` : " Browser Preview"}
      </p>
      <section
        className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
        aria-label="后端状态"
      >
        <div
          className={`h-3 w-3 flex-none rounded-full shadow-[0_0_0_6px_rgba(15,23,42,0.04)] ${backendStatusColorClass}`}
        />
        <div>
          <div className="font-semibold text-slate-900">
            后端状态：{backendStatusLabel}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {backendState.detail}
          </div>
        </div>
      </section>
      <section
        className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
        aria-label="数据库状态"
      >
        <div
          className={`h-3 w-3 flex-none rounded-full shadow-[0_0_0_6px_rgba(15,23,42,0.04)] ${databaseStatusColorClass}`}
        />
        <div>
          <div className="font-semibold text-slate-900">
            数据库状态：{databaseStatusLabel}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {databaseState.detail}
          </div>
        </div>
      </section>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-slate-700">
        <li>模型：DeepSeek 远程 / 本地模型</li>
        <li>向量库：本地 sqlite-vec / 远程 pgvector</li>
        <li>服务：本地 Node.js API</li>
      </ul>
    </main>
  );
}

export default HomePage;
