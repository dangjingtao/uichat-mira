import axios from "axios";
import { FormEvent, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";

function LoginPage() {
  const navigate = useNavigate();
  const { apiClient, authErrorMessage, consumeAuthError, login } = useAuth();
  const isLoggingInRef = useRef(false);

  const [form, setForm] = useState({
    user: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authErrorMessage) {
      return;
    }

    setError(authErrorMessage);
    consumeAuthError();
  }, [authErrorMessage, consumeAuthError]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    isLoggingInRef.current = true;

    try {
      const response = await apiClient.post("/api/login", {
        user: form.user,
        password: form.password,
      });

      const payload = response.data as {
        ok: boolean;
        token: string;
        user: {
          id: number;
          username: string;
          role: "admin" | "user";
        };
      };

      if (!payload.ok) {
        setError("登录失败，请检查账号密码");
        return;
      }

      login({
        token: payload.token,
        user: payload.user,
      });

      navigate("/chat", { replace: true });
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
      isLoggingInRef.current = false;
    }
  };

  return (
    <main className="mx-auto mt-20 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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

export default LoginPage;
