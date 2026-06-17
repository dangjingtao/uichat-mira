import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LockKeyhole, User2 } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import logo from "@/assets/branding/uichat-logo.png";
import { login as apiLogin } from "@/shared/api";
import { ApiError } from "@/shared/lib/request";
import { Button } from "@/shared/ui/Button";
import { TextInput } from "@/shared/ui/Input";

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authErrorMessage, consumeAuthError, login } = useAuth();
  const isLoggingInRef = useRef(false);

  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fieldError = error ? t("auth.login.fieldError") : undefined;

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
        setError(t("auth.login.requestFailed"));
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
          <section className="rounded-[28px] border border-cloudy-3/80 bg-pampas-3/94 px-6 py-8 shadow-[0_10px_28px_rgba(73,52,33,0.045)] sm:px-8 sm:py-10">
            <div className="max-w-2xl space-y-5">
              <div className="inline-flex items-center rounded-full border border-cloudy-3/70 bg-surface-primary/85 px-3 py-1 text-xs font-medium text-primary">
                {t("auth.login.badge")}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={logo}
                    alt="UI Chat RAG Tester"
                    className="h-[30px] w-auto"
                  />
                  <span className="translate-y-[3px] font-mono text-[30px] font-semibold leading-none text-text-primary">
                    RAG Tester
                  </span>
                </div>

                <h1 className="text-[30px] font-semibold leading-tight text-text-primary">
                  {t("auth.login.title")}
                </h1>

                <p className="max-w-xl text-sm leading-6 text-text-secondary">
                  {t("auth.login.description")}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-cloudy-3/70 bg-pampas-2/92 px-4 py-4 shadow-[0_4px_12px_rgba(73,52,33,0.025)]">
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-pampas-4">
                    <User2 className="h-4 w-4 text-icon-primary" />
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    {t("auth.login.featureContinueTitle")}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-text-secondary">
                    {t("auth.login.featureContinueDescription")}
                  </div>
                </div>

                <div className="rounded-2xl border border-cloudy-3/70 bg-pampas-2/92 px-4 py-4 shadow-[0_4px_12px_rgba(73,52,33,0.025)]">
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-pampas-4">
                    <LockKeyhole className="h-4 w-4 text-icon-primary" />
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    {t("auth.login.featureQuietTitle")}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-text-secondary">
                    {t("auth.login.featureQuietDescription")}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-cloudy-3/80 bg-pampas-1/92 px-6 py-8 shadow-[0_12px_32px_rgba(73,52,33,0.055)] ring-1 ring-surface-primary/60 sm:px-8 sm:py-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  {t("auth.login.welcomeBack")}
                </div>
                <h2 className="text-xl font-semibold text-text-primary">
                  {t("auth.login.signIn")}
                </h2>
                <p className="text-sm leading-6 text-text-secondary">
                  {t("auth.login.signInDescription")}
                </p>
              </div>

              <form className="space-y-4" onSubmit={onSubmit}>
                <TextInput
                  label={t("auth.login.username")}
                  value={form.username}
                  onChange={(username) =>
                    setForm((previous) => ({
                      ...previous,
                      username,
                    }))
                  }
                  placeholder={t("auth.login.usernamePlaceholder")}
                  disabled={isSubmitting}
                  error={fieldError}
                />

                <TextInput
                  label={t("auth.login.password")}
                  type="password"
                  value={form.password}
                  onChange={(password) =>
                    setForm((previous) => ({
                      ...previous,
                      password,
                    }))
                  }
                  placeholder={t("auth.login.passwordPlaceholder")}
                  disabled={isSubmitting}
                  error={fieldError}
                />

                {error ? (
                  <div className="rounded-lg border border-danger/20 bg-danger/5 px-3.5 py-3 text-sm text-danger">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    isSubmitting ||
                    !form.username.trim() ||
                    !form.password.trim()
                  }
                  className="w-full"
                >
                  {isSubmitting ? t("auth.login.signingIn") : t("auth.login.signIn")}
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
