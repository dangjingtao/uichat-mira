import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Boxes, FileSearch2, Leaf } from "lucide-react";
import { useTypewriter } from "react-typewriter-plus";
import { useAuth } from "@/app/providers/AuthProvider";
import { getAppMeta, type AppMetaData } from "@/shared/api/system";
import { isDesktopShell } from "@/shared/platform/desktopRuntime";
import brandIcon from "@/assets/branding/uichat-logo-icon-login.png";
import loginWatermark from "@/assets/branding/login-watermark.svg";
import { login as apiLogin } from "@/shared/api";
import { ApiError } from "@/shared/lib/request";
import { Button } from "@/shared/ui/Button";
import { TextInput } from "@/shared/ui/Input";
import { appPackageMeta } from "@/shared/appMeta";

const QUOTE_POOL_STORAGE_KEY = "uichat-login-quote-pool";

const fallbackMeta: AppMetaData = {
  name: appPackageMeta.name,
  version: "0.0.0",
  displayName: appPackageMeta.displayName,
  author: "",
  description: "",
  repositoryUrl: "",
  homepageUrl: "",
  links: [],
};

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authErrorMessage, consumeAuthError, login } = useAuth();
  const isLoggingInRef = useRef(false);
  const quoteBodyRef = useRef<HTMLDivElement | null>(null);

  const [appMeta, setAppMeta] = useState<AppMetaData>(fallbackMeta);
  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fieldError = error ? t("auth.login.fieldError") : undefined;
  const quoteCandidates = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => t(`auth.login.quotes.${index}`)),
    [t],
  );
  const [activeQuote, setActiveQuote] = useState("");
  const [typingSpeed, setTypingSpeed] = useState(52);
  const [showQuoteAuthor, setShowQuoteAuthor] = useState(false);
  const capabilityItems = [
    {
      key: "local",
      icon: Leaf,
      label: t("auth.login.capabilities.local.label"),
      value: t("auth.login.capabilities.local.value"),
    },
    {
      key: "model",
      icon: Boxes,
      label: t("auth.login.capabilities.model.label"),
      value: t("auth.login.capabilities.model.value"),
    },
    {
      key: "source",
      icon: FileSearch2,
      label: t("auth.login.capabilities.source.label"),
      value: t("auth.login.capabilities.source.value"),
    },
  ] as const;

  useEffect(() => {
    const shuffledIndexes = [...quoteCandidates.keys()].sort(
      () => Math.random() - 0.5,
    );

    const loadPool = () => {
      try {
        const rawPool = window.sessionStorage.getItem(QUOTE_POOL_STORAGE_KEY);
        if (!rawPool) {
          return [];
        }

        const parsedPool = JSON.parse(rawPool);
        if (!Array.isArray(parsedPool)) {
          return [];
        }

        return parsedPool.filter(
          (index): index is number =>
            Number.isInteger(index) &&
            index >= 0 &&
            index < quoteCandidates.length,
        );
      } catch {
        return [];
      }
    };

    const savePool = (pool: number[]) => {
      window.sessionStorage.setItem(
        QUOTE_POOL_STORAGE_KEY,
        JSON.stringify(pool),
      );
    };

    let pool = loadPool();
    if (pool.length === 0) {
      pool = shuffledIndexes;
    }

    const nextIndex = pool.shift() ?? 0;
    savePool(pool);
    setActiveQuote(quoteCandidates[nextIndex] ?? "");
    setTypingSpeed(42 + Math.floor(Math.random() * 36));
  }, [quoteCandidates]);

  const [quoteBody, quoteAuthor] = useMemo(() => {
    const [body, author] = activeQuote.split(" · ");
    return [body ?? "", author ?? ""];
  }, [activeQuote]);
  const typedQuoteBody = useTypewriter(quoteBody, {
    type: "text",
    speed: typingSpeed,
    loop: false,
    cursor: true,
    cursorBlinkSpeed: 520,
    loadingNode: "",
  });
  const typedQuoteAuthor = useTypewriter(
    showQuoteAuthor ? `——${quoteAuthor}` : "",
    {
      type: "text",
      speed: Math.max(typingSpeed - 10, 28),
      loop: false,
      cursor: false,
      cursorBlinkSpeed: 520,
      loadingNode: "",
    },
  );

  useEffect(() => {
    setShowQuoteAuthor(false);

    if (!quoteAuthor || !quoteBody || !quoteBodyRef.current) {
      return;
    }

    const bodyNode = quoteBodyRef.current;
    const normalize = (value: string) => value.replace(/\|/g, "").trim();
    const tryRevealAuthor = () => {
      const renderedLength = normalize(bodyNode.textContent ?? "").length;
      if (renderedLength >= quoteBody.length) {
        setShowQuoteAuthor(true);
        return true;
      }

      return false;
    };

    if (tryRevealAuthor()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (tryRevealAuthor()) {
        observer.disconnect();
      }
    });

    observer.observe(bodyNode, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [quoteAuthor, quoteBody, typedQuoteBody]);

  useEffect(() => {
    if (!authErrorMessage) {
      return;
    }

    setError(authErrorMessage);
    consumeAuthError();
  }, [authErrorMessage, consumeAuthError]);

  useEffect(() => {
    if (!isDesktopShell()) {
      return;
    }

    let cancelled = false;

    void getAppMeta()
      .then((data) => {
        if (!cancelled) {
          setAppMeta(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppMeta(fallbackMeta);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
    <main className="min-h-screen bg-[rgb(var(--color-surface-auth))]">
      <div className="mx-auto flex min-h-screen max-w-[920px] items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[16px] border border-border/80 bg-[rgb(var(--color-surface-auth))] shadow-[0_14px_36px_rgba(68,52,35,0.05)] lg:grid-cols-[1fr_0.75fr]">
          <section className="relative flex flex-col justify-between overflow-hidden border-b border-border/70 px-7 py-8 sm:px-8 sm:py-9 lg:border-b-0 lg:border-r lg:border-border/70">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[-52px] right-[-112px] h-[336px] w-[272px] opacity-[0.075]"
            >
              <img
                src={loginWatermark}
                alt=""
                className="h-full w-full object-contain object-bottom"
              />
            </div>

            <div className="relative z-10">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-[4px] bg-text-primary">
                    <img
                      src={brandIcon}
                      alt={appMeta.displayName}
                      className="h-5 w-5 object-contain"
                    />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="pt-0.5 text-[15px] font-medium tracking-[-0.02em] text-text-primary">
                      {(appMeta.displayName || appPackageMeta.displayName).toLowerCase()}
                    </span>
                    <span className="text-[11px] text-text-tertiary">
                      v{appMeta.version}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-13">
                <div className="mt-8 mb-6 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {t("auth.login.badge")}
                </div>

                <h1 className="max-w-[11.5ch] text-[31px] font-semibold leading-[1.2] tracking-[-0.04em] text-text-primary sm:text-[36px]">
                  {t("auth.login.titlePrefix")}
                  <span className="text-primary">
                    {t("auth.login.titleHighlight")}
                  </span>
                </h1>

                <div className="mt-7 min-h-[116px] max-w-[31ch] text-[13.5px] leading-[1.75] tracking-[-0.015em] text-text-primary/82">
                  <div ref={quoteBodyRef}>{typedQuoteBody}</div>
                  {showQuoteAuthor ? (
                    <div className="mt-2 text-right text-text-primary/72">
                      <span className="relative inline-block text-left align-top">
                        <span
                          aria-hidden="true"
                          className="invisible pointer-events-none whitespace-pre"
                        >
                          ——{quoteAuthor}
                        </span>
                        <span className="absolute left-0 top-0 whitespace-pre">
                          {typedQuoteAuthor}
                        </span>
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-14 grid max-w-[360px] grid-cols-3 gap-5 pb-1">
              {capabilityItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.key} className="flex items-start gap-2.5">
                    <div className="mt-[1px] text-primary-4">
                      <Icon className="h-[24px] w-[24px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="whitespace-nowrap text-[12px] font-medium leading-none text-text-tertiary/58">
                        {item.label}
                      </div>
                      <div className="mt-[2px] whitespace-nowrap text-[10.5px] font-medium uppercase leading-none tracking-[0.14em] text-text-tertiary/58">
                        {item.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col justify-center bg-[rgb(var(--color-surface-auth))] px-6 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto w-full max-w-[370px] space-y-6">
              <div className="space-y-1.5">
                <h2 className="text-[22px] font-medium tracking-[-0.02em] text-text-primary">
                  {t("auth.login.welcomeBack")}
                </h2>
                <p className="text-[13px] text-text-tertiary">
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

                <div className="flex mt-6 items-center justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={
                      isSubmitting ||
                      !form.username.trim() ||
                      !form.password.trim()
                    }
                    className="mt-4 w-full gap-2"
                  >
                    {isSubmitting
                      ? t("auth.login.signingIn")
                      : t("auth.login.signIn")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;
