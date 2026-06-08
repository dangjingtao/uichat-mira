import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, User2 } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { login as apiLogin } from "@/shared/api";
import { ApiError } from "@/shared/lib/request";
import { Button } from "@/shared/ui/Button";
import { TextInput } from "@/shared/ui/Input";

function LoginPage() {
  const navigate = useNavigate();
  const { authErrorMessage, consumeAuthError, login } = useAuth();
  const isLoggingInRef = useRef(false);

  const [form, setForm] = useState({
    username: "",
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
      const result = await apiLogin({
        username: form.username,
        password: form.password,
      });

      login({
        token: result.token,
        user: result.user,
      });

      navigate("/chat", { replace: true });
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("登录请求失败");
      }
    } finally {
      setIsSubmitting(false);
      isLoggingInRef.current = false;
    }
  };

  return (
    <main className="min-h-screen bg-surface-secondary">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-border bg-surface-primary px-6 py-8 shadow-shadow-sm sm:px-8 sm:py-10">
            <div className="max-w-2xl space-y-5">
              <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Desktop AI workspace
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src="https://uichat.tomz.io/assets/logo.C9Wlp9a2.png"
                    alt="UI Chat RAG Tester"
                    className="h-[30px] w-auto"
                  />
                  <span className="translate-y-[3px] font-mono text-[30px] font-semibold leading-none text-text-primary">
                    RAG Tester
                  </span>
                </div>

                <h1 className="text-[30px] font-semibold leading-tight text-text-primary">
                  登录并开始你的 RAG 对话测试
                </h1>

                <p className="max-w-xl text-sm leading-6 text-text-secondary">
                  登录后你可以继续使用当前桌面端能力，包括模型联调、知识库验证、后端健康检查与聊天测试链路。
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface-secondary px-4 py-4">
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-primary">
                    <User2 className="h-4 w-4 text-icon-primary" />
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    统一登录入口
                  </div>
                  <div className="mt-1 text-sm leading-6 text-text-secondary">
                    保持当前账号态与路由守卫逻辑一致，不改变既有认证流程。
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface-secondary px-4 py-4">
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-primary">
                    <LockKeyhole className="h-4 w-4 text-icon-primary" />
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    安静的登录体验
                  </div>
                  <div className="mt-1 text-sm leading-6 text-text-secondary">
                    使用统一 token、标准输入框与按钮风格，减少页面视觉噪音。
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface-primary px-6 py-8 shadow-shadow-sm sm:px-8 sm:py-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  Account Access
                </div>
                <h2 className="text-xl font-semibold text-text-primary">
                  登录
                </h2>
                <p className="text-sm leading-6 text-text-secondary">
                  输入你的账号信息以继续。
                </p>
              </div>

              <form className="space-y-4" onSubmit={onSubmit}>
                <TextInput
                  label="用户名"
                  value={form.username}
                  onChange={(username) =>
                    setForm((previous) => ({
                      ...previous,
                      username,
                    }))
                  }
                  placeholder="请输入用户名"
                  disabled={isSubmitting}
                  error={undefined}
                />

                <TextInput
                  label="密码"
                  type="password"
                  value={form.password}
                  onChange={(password) =>
                    setForm((previous) => ({
                      ...previous,
                      password,
                    }))
                  }
                  placeholder="请输入密码"
                  disabled={isSubmitting}
                  error={undefined}
                />

                {error ? (
                  <div className="rounded-lg border border-danger/20 bg-danger/5 px-3.5 py-3 text-sm text-danger">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !form.username.trim() ||
                    !form.password.trim()
                  }
                  className="w-full"
                >
                  {isSubmitting ? "登录中..." : "登录"}
                </Button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;
