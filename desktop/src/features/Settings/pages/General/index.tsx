import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useLanguagePreferences } from "@/app/providers/LanguageProvider";
import { changePassword } from "@/shared/api";
import { ApiError } from "@/shared/lib/request";
import { useThemePreferences } from "@/app/providers/ThemeProvider";
import type { ThemePresetId } from "@/shared/theme/colorThemes";
import Badge from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { TextInput } from "@/shared/ui/Input";
import { Modal } from "@/shared/ui/Modal";
import { Select } from "@/shared/ui/Select";
import Switch from "@/shared/ui/Switch";
import HealthCheck from "./HealthCheck";
import SettingsNotice from "../../components/SettingsNotice";
import SettingsPageLayout from "../../components/SettingsPageLayout";

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const initialFormState: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function ChangePasswordModal({
  form,
  isSubmitting,
  errorMessage,
  successMessage,
  passwordMismatch,
  canSubmit,
  onChange,
  onSubmit,
  onReset,
}: {
  form: PasswordFormState;
  isSubmitting: boolean;
  errorMessage: string;
  successMessage: string;
  passwordMismatch: boolean;
  canSubmit: boolean;
  onChange: (next: Partial<PasswordFormState>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1">
        <p className="text-sm leading-6 text-text-secondary">
          {t("settings.general.password.description")}
        </p>
      </div>

      <TextInput
        label={t("settings.general.password.current")}
        type="password"
        value={form.currentPassword}
        onChange={(currentPassword) => onChange({ currentPassword })}
        placeholder={t("settings.general.password.currentPlaceholder")}
        disabled={isSubmitting}
      />

      <TextInput
        label={t("settings.general.password.next")}
        type="password"
        value={form.newPassword}
        onChange={(newPassword) => onChange({ newPassword })}
        placeholder={t("settings.general.password.nextPlaceholder")}
        disabled={isSubmitting}
      />

      <TextInput
        label={t("settings.general.password.confirm")}
        type="password"
        value={form.confirmPassword}
        onChange={(confirmPassword) => onChange({ confirmPassword })}
        placeholder={t("settings.general.password.confirmPlaceholder")}
        disabled={isSubmitting}
        error={
          passwordMismatch ? t("settings.general.password.mismatch") : undefined
        }
      />

      {form.currentPassword &&
      form.newPassword &&
      form.currentPassword === form.newPassword ? (
        <SettingsNotice tone="danger">
          {t("settings.general.password.sameAsCurrent")}
        </SettingsNotice>
      ) : null}

      {errorMessage ? (
        <SettingsNotice tone="danger">
          {errorMessage}
        </SettingsNotice>
      ) : null}

      {successMessage ? (
        <SettingsNotice
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4 text-success" />}
        >
          {successMessage}
        </SettingsNotice>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
          disabled={isSubmitting}
        >
          {t("common.actions.reset")}
        </Button>
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting
            ? t("settings.general.password.submitting")
            : t("settings.general.password.submit")}
        </Button>
      </div>
    </form>
  );
}

export default function General() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { language, setLanguage, supportedLanguages } =
    useLanguagePreferences();
  const { colorTheme, setColorTheme, themeMode, setThemeMode, themePresets } =
    useThemePreferences();
  const [form, setForm] = useState<PasswordFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const themeMetadata = useMemo(
    () =>
      ({
        "warm-neutral": {
          label: t("settings.general.theme.presets.warm-neutral.label"),
          description: t(
            "settings.general.theme.presets.warm-neutral.description",
          ),
        },
        "knowledge-blue": {
          label: t("settings.general.theme.presets.knowledge-blue.label"),
          description: t(
            "settings.general.theme.presets.knowledge-blue.description",
          ),
        },
        "archive-green": {
          label: t("settings.general.theme.presets.archive-green.label"),
          description: t(
            "settings.general.theme.presets.archive-green.description",
          ),
        },
        "slate-ocean": {
          label: t("settings.general.theme.presets.slate-ocean.label"),
          description: t(
            "settings.general.theme.presets.slate-ocean.description",
          ),
        },
      }) satisfies Record<
        ThemePresetId,
        {
          label: string;
          description: string;
        }
      >,
    [t],
  );

  const passwordMismatch = useMemo(() => {
    if (!form.confirmPassword) {
      return false;
    }

    return form.newPassword !== form.confirmPassword;
  }, [form.confirmPassword, form.newPassword]);

  const canSubmit =
    form.currentPassword.trim().length > 0 &&
    form.newPassword.trim().length >= 6 &&
    form.confirmPassword.trim().length > 0 &&
    !passwordMismatch &&
    form.currentPassword !== form.newPassword;

  const resetForm = () => {
    setForm(initialFormState);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!canSubmit) {
      setErrorMessage(t("settings.general.password.submitInvalid"));
      return;
    }

    setIsSubmitting(true);

    try {
      await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      setForm(initialFormState);
      setSuccessMessage(t("settings.general.password.success"));
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setErrorMessage(requestError.message);
      } else {
        setErrorMessage(t("settings.general.password.failed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPasswordModal = () => {
    Modal.show({
      title: t("settings.general.password.modalTitle"),
      width: 520,
      content: (
        <ChangePasswordModal
          form={form}
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          successMessage={successMessage}
          passwordMismatch={passwordMismatch}
          canSubmit={canSubmit}
          onChange={(next) => setForm((previous) => ({ ...previous, ...next }))}
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          onReset={resetForm}
        />
      ),
      footer: null,
      onClose: resetForm,
    });
  };

  return (
    <SettingsPageLayout
      miniTitle={t("settings.general.page.miniTitle")}
      title={t("settings.general.page.title")}
      description={t("settings.general.page.description")}
      contentClassName="space-y-4 pt-6"
    >
      <HealthCheck />

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">
          {t("settings.general.preferences")}
        </h2>

        <div className="space-y-2">
          <Card
            variant="subtle"
            className="flex items-center justify-between gap-4 border-border/70 bg-surface-secondary/60 px-3.5 py-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {session?.user.username ?? "-"}
                </span>
                <Badge variant="muted" className="capitalize">
                  {session?.user.role ?? "-"}
                </Badge>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={openPasswordModal}>
              <KeyRound className="h-4 w-4" />
              {t("settings.general.account.changePassword")}
            </Button>
          </Card>

          <Card
            variant="subtle"
            className="flex items-center justify-between gap-4 border-border/70 bg-surface-secondary/60 px-3.5 py-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">
                {t("settings.general.language.label")}
              </div>
            </div>
            <div className="w-full max-w-[168px] shrink-0">
              <Select
                value={language}
                onChange={(value) =>
                  void setLanguage(value as "zh-CN" | "en-US")
                }
                options={supportedLanguages.map((value) => ({
                  value,
                  label: t(`settings.general.language.options.${value}`),
                }))} 
                compact
              />
            </div>
          </Card>

          <Card
            variant="subtle"
            className="flex items-center justify-between gap-4 border-border/70 bg-surface-secondary/60 px-3.5 py-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">
                {t("settings.general.theme.label")}
              </div>
              <div className="mt-0.5 text-xs leading-5 text-text-secondary">
                {themeMetadata[colorTheme]?.description}
              </div>
            </div>
            <div className="w-full max-w-[168px] shrink-0">
              <Select
                value={colorTheme}
                onChange={(value) => setColorTheme(value as ThemePresetId)}
                options={themePresets.map((theme) => ({
                  value: theme.id,
                  label: themeMetadata[theme.id].label,
                }))} 
                compact
              />
            </div>
          </Card>

          <Card
            variant="subtle"
            className="flex items-center justify-between gap-4 border-border/70 bg-surface-secondary/60 px-3.5 py-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">
                {t("settings.general.darkMode.label")}
              </div>
            </div>
            <Switch
              checked={themeMode === "dark"}
              onChange={() =>
                setThemeMode(themeMode === "dark" ? "light" : "dark")
              }
              ariaLabel={t("settings.general.darkMode.ariaLabel")}
            />
          </Card>
        </div>
      </Card>
    </SettingsPageLayout>
  );
}
