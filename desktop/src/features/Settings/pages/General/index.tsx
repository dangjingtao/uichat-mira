import { FormEvent, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { changePassword } from "@/shared/api";
import { ApiError } from "@/shared/lib/request";
import { Button } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { TextInput } from "@/shared/ui/Input";
import { Modal } from "@/shared/ui/Modal";
import Switch from "@/shared/ui/Switch";
import HealthCheck from "./HealthCheck";
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
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1">
        <div className="text-sm font-semibold text-text-primary">修改密码</div>
        <p className="text-sm leading-6 text-text-secondary">
          新密码至少 6 位，且不能与当前密码相同。保存后立即生效。
        </p>
      </div>

      <TextInput
        label="当前密码"
        type="password"
        value={form.currentPassword}
        onChange={(currentPassword) => onChange({ currentPassword })}
        placeholder="请输入当前密码"
        disabled={isSubmitting}
      />

      <TextInput
        label="新密码"
        type="password"
        value={form.newPassword}
        onChange={(newPassword) => onChange({ newPassword })}
        placeholder="请输入新密码"
        disabled={isSubmitting}
      />

      <TextInput
        label="确认新密码"
        type="password"
        value={form.confirmPassword}
        onChange={(confirmPassword) => onChange({ confirmPassword })}
        placeholder="请再次输入新密码"
        disabled={isSubmitting}
        error={passwordMismatch ? "两次输入的新密码不一致" : undefined}
      />

      {form.currentPassword &&
      form.newPassword &&
      form.currentPassword === form.newPassword ? (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-3.5 py-3 text-sm text-danger">
          新密码不能与当前密码相同。
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-3.5 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        <Button type="button" variant="ghost" onClick={onReset} disabled={isSubmitting}>
          重置
        </Button>
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "保存中..." : "更新密码"}
        </Button>
      </div>
    </form>
  );
}

export default function General() {
  const { session } = useAuth();
  const [form, setForm] = useState<PasswordFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [language, setLanguage] = useState("zh-CN");
  const [colorTheme, setColorTheme] = useState("warm-neutral");

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
      setErrorMessage("请检查密码输入后再提交。");
      return;
    }

    setIsSubmitting(true);

    try {
      await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      setForm(initialFormState);
      setSuccessMessage("密码已更新，请使用新密码进行后续登录。");
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setErrorMessage(requestError.message);
      } else {
        setErrorMessage("修改密码失败，请稍后重试。");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPasswordModal = () => {
    Modal.show({
      title: "修改密码",
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
      miniTitle="General"
      title="通用"
      description="统一管理当前界面的基础偏好与账户操作。"
      contentClassName="space-y-4 pt-6"
    >
      <HealthCheck />

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">偏好设置</h2>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface-secondary/60 px-3.5 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {session?.user.username ?? "-"}
                </span>
                <span className="inline-flex items-center rounded-full border border-cloudy-3 bg-pampas-2 px-2 py-0.5 text-[11px] font-medium capitalize text-text-secondary">
                  {session?.user.role ?? "-"}
                </span>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={openPasswordModal}>
              <KeyRound className="h-4 w-4" />
              修改密码
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface-secondary/60 px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">界面语言</div>
            </div>
            <div className="relative w-full max-w-[168px] shrink-0">
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="h-8 w-full appearance-none rounded-lg border border-border bg-surface-primary pl-3 pr-8 text-sm text-text-primary shadow-shadow-sm transition-all duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-icon-secondary" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface-secondary/60 px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">色彩主题</div>
            </div>
            <div className="relative w-full max-w-[168px] shrink-0">
              <select
                value={colorTheme}
                onChange={(event) => setColorTheme(event.target.value)}
                className="h-8 w-full appearance-none rounded-lg border border-border bg-surface-primary pl-3 pr-8 text-sm text-text-primary shadow-shadow-sm transition-all duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="warm-neutral">暖米色</option>
                <option value="classic-light">浅色默认</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-icon-secondary" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface-secondary/60 px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">暗黑模式</div>
            </div>
            <Switch
              checked={darkModeEnabled}
              onChange={() => setDarkModeEnabled((current) => !current)}
              ariaLabel="切换暗黑模式"
            />
          </div>
        </div>
      </Card>
    </SettingsPageLayout>
  );
}
