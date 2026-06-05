import axios, { AxiosInstance } from "axios";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";

type UserRole = "admin" | "user";

type SessionUser = {
  id: number;
  username: string;
  role: UserRole;
};

type SessionState = {
  token: string;
  user: SessionUser;
};

const SESSION_STORAGE_KEY = "rag-demo-auth-session";

const readSessionFromStorage = (): SessionState | null => {
  const serialized = globalThis.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!serialized) {
    return null;
  }

  try {
    const parsed = JSON.parse(serialized) as SessionState;

    if (!parsed.token || !parsed.user?.username || !parsed.user?.role) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

type HomePageProps = {
  session: SessionState;
  onLogout: () => void;
};

function HomePage({ session, onLogout }: HomePageProps) {
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
          onClick={onLogout}
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
        运行环境:
        {desktopApi ? ` Electron (${desktopApi.platform})` : " Browser Preview"}
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

type LoginPageProps = {
  apiClient: AxiosInstance;
  session: SessionState | null;
  authErrorMessage: string;
  onLoginSuccess: (session: SessionState) => void;
  onAuthErrorShown: () => void;
};

function LoginPage({
  apiClient,
  session,
  authErrorMessage,
  onLoginSuccess,
  onAuthErrorShown,
}: LoginPageProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    user: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session) {
      navigate("/", { replace: true });
    }
  }, [navigate, session]);

  useEffect(() => {
    if (!authErrorMessage) {
      return;
    }

    setError(authErrorMessage);
    onAuthErrorShown();
  }, [authErrorMessage, onAuthErrorShown]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const response = await apiClient.post("/api/login", {
        user: form.user,
        password: form.password,
      });

      const payload = response.data as {
        ok: boolean;
        token: string;
        user: SessionUser;
      };

      if (!payload.ok) {
        setError("登录失败，请检查账号密码");
        return;
      }

      onLoginSuccess({
        token: payload.token,
        user: payload.user,
      });

      navigate("/", { replace: true });
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const message =
          (requestError.response?.data as { message?: string } | undefined)
            ?.message ?? requestError.message;
        setError(message);
      } else {
        setError("登录请求失败");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto mt-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <img
          src="https://uichat.tomz.io/assets/logo.C9Wlp9a2.png"
          alt="Logo"
          className="h-6"
        />
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-slate-800">
          登录
        </h1>
      </div>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            user
          </span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
            value={form.user}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, user: event.target.value }))
            }
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            password
          </span>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
            value={form.password}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                password: event.target.value,
              }))
            }
            required
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? "登录中..." : "登录"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </main>
  );
}

function App() {
  const backendUrl =
    globalThis.window?.desktopApi?.backendUrl ?? "http://127.0.0.1:8787";
  const apiClient = useMemo(
    () =>
      axios.create({
        baseURL: backendUrl,
        timeout: 10000,
      }),
    [backendUrl],
  );

  const [session, setSession] = useState<SessionState | null>(() =>
    readSessionFromStorage(),
  );
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [authErrorMessage, setAuthErrorMessage] = useState("");

  const clearSession = (message = "") => {
    globalThis.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setAuthErrorMessage(message);
  };

  const saveSession = (nextSession: SessionState) => {
    globalThis.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(nextSession),
    );
    setSession(nextSession);
    setAuthErrorMessage("");
  };

  useEffect(() => {
    if (session?.token) {
      apiClient.defaults.headers.common.Authorization = `Bearer ${session.token}`;
      return;
    }

    delete apiClient.defaults.headers.common.Authorization;
  }, [apiClient, session]);

  useEffect(() => {
    let mounted = true;

    const validateCurrentSession = async () => {
      if (!session?.token) {
        if (mounted) {
          setIsCheckingSession(false);
        }
        return;
      }

      try {
        const response = await apiClient.get("/api/me", {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        });

        const payload = response.data as { ok: boolean; user: SessionUser };

        if (mounted && payload.ok) {
          saveSession({
            token: session.token,
            user: payload.user,
          });
        }
      } catch {
        if (mounted) {
          clearSession("登录状态已过期，请重新登录。");
        }
      } finally {
        if (mounted) {
          setIsCheckingSession(false);
        }
      }
    };

    void validateCurrentSession();

    return () => {
      mounted = false;
    };
  }, [apiClient]);

  useEffect(() => {
    const responseInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error?.response?.status === 401) {
          clearSession("请重新登录。");
        }

        return Promise.reject(error);
      },
    );

    return () => {
      apiClient.interceptors.response.eject(responseInterceptor);
    };
  }, [apiClient]);

  if (isCheckingSession) {
    return (
      <main className="mx-auto mt-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
        正在校验登录状态...
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          session ? (
            <HomePage session={session} onLogout={() => clearSession()} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/login"
        element={
          <LoginPage
            apiClient={apiClient}
            session={session}
            authErrorMessage={authErrorMessage}
            onLoginSuccess={saveSession}
            onAuthErrorShown={() => setAuthErrorMessage("")}
          />
        }
      />
      <Route
        path="*"
        element={<Navigate to={session ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}

export default App;
