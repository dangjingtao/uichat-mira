import { useEffect, useState } from "react";

function App() {
  const desktopApi = globalThis.window?.desktopApi;
  const [backendState, setBackendState] = useState<{
    status: "unknown" | "running" | "stopped";
    detail: string;
  }>({
    status: desktopApi ? "unknown" : "stopped",
    detail: desktopApi ? "等待后端健康检查" : "浏览器预览未连接本地后端",
  });
  const [databaseState, setDatabaseState] = useState<{
    status: "unknown" | "running" | "stopped";
    detail: string;
  }>({
    status: desktopApi ? "unknown" : "stopped",
    detail: desktopApi
      ? "等待数据库联通检查"
      : "浏览器预览未连接本地数据库检查",
  });

  useEffect(() => {
    if (!desktopApi?.checkBackendHealth) {
      return;
    }

    let cancelled = false;

    const pollBackend = async () => {
      const result = await desktopApi.checkBackendHealth();

      if (cancelled) {
        return;
      }

      setBackendState({
        status: result.ok ? "running" : "stopped",
        detail: result.ok
          ? `后端已启动 · ${desktopApi.backendUrl}`
          : (result.error ?? `健康检查失败 · HTTP ${result.statusCode || 0}`),
      });

      if (!desktopApi.checkDatabaseHealth) {
        setDatabaseState({
          status: "stopped",
          detail: "当前桌面桥接未提供数据库健康检查能力",
        });
        return;
      }

      const dbResult = await desktopApi.checkDatabaseHealth();

      if (cancelled) {
        return;
      }

      setDatabaseState({
        status: dbResult.ok ? "running" : "stopped",
        detail: dbResult.ok
          ? `数据库联通正常 · ${dbResult.detail}`
          : dbResult.detail,
      });
    };

    void pollBackend();

    const timer = globalThis.setInterval(() => {
      void pollBackend();
    }, 3000);

    return () => {
      cancelled = true;
      globalThis.clearInterval(timer);
    };
  }, [desktopApi]);

  let statusLabel = "检测中";

  if (backendState.status === "running") {
    statusLabel = "运行中";
  } else if (backendState.status === "stopped") {
    statusLabel = "未启动";
  }

  let statusColorClass = "bg-amber-500";

  if (backendState.status === "running") {
    statusColorClass = "bg-green-600";
  } else if (backendState.status === "stopped") {
    statusColorClass = "bg-red-600";
  }

  let dbStatusLabel = "检测中";

  if (databaseState.status === "running") {
    dbStatusLabel = "正常";
  } else if (databaseState.status === "stopped") {
    dbStatusLabel = "未联通";
  }

  let dbStatusColorClass = "bg-amber-500";

  if (databaseState.status === "running") {
    dbStatusColorClass = "bg-green-600";
  } else if (databaseState.status === "stopped") {
    dbStatusColorClass = "bg-red-600";
  }

  return (
    <main className="mx-auto mt-10 max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="m-0 text-3xl font-semibold tracking-tight text-slate-900">
        UI Chat RAG Tester
      </h1>
      <p className="mt-3 text-slate-700">
        桌面端初始化完成。下一步可接入 Electron Shell 与知识库流程。
      </p>
      <p className="mt-2 text-slate-700">
        运行环境:{" "}
        {desktopApi ? `Electron (${desktopApi.platform})` : "Browser Preview"}
      </p>
      <section
        className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
        aria-label="后端状态"
      >
        <div
          className={`h-3 w-3 flex-none rounded-full shadow-[0_0_0_6px_rgba(15,23,42,0.04)] ${statusColorClass}`}
        />
        <div>
          <div className="font-semibold text-slate-900">
            后端状态: {statusLabel}
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
          className={`h-3 w-3 flex-none rounded-full shadow-[0_0_0_6px_rgba(15,23,42,0.04)] ${dbStatusColorClass}`}
        />
        <div>
          <div className="font-semibold text-slate-900">
            数据库状态: {dbStatusLabel}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {databaseState.detail}
          </div>
        </div>
      </section>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-slate-700">
        <li>模型: DeepSeek 远程 / 本地模型</li>
        <li>向量库: 本地 sqlite-vec / 远程 pgvector</li>
        <li>服务: 本地 Node.js API</li>
      </ul>
    </main>
  );
}

export default App;
