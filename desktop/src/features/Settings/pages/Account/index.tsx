import { FormEvent, useMemo, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { changePassword } from "@/shared/api";
import { ApiError } from "@/shared/lib/request";
import { Button } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { TextInput } from "@/shared/ui/Input";
import Header from "../../components/Header";

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

export default function SettingsAccount() {
  const { session, logout } = useAuth();
  const [form, setForm] = useState<PasswordFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  return (
    <div className="mx-auto flex w-full  flex-col gap-6 px-4 pb-6">
      <section className="space-y-2">
        <Header
          miniTitle="Account"
          title="账号设置"
          description="保留当前已落地的账号能力：查看当前登录身份、修改密码、退出登录。"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-secondary">
              <UserRound className="h-5 w-5 text-icon-primary" />
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-text-secondary">当前账号</div>
                <div className="text-lg font-semibold text-text-primary">
                  {session?.user.username ?? "-"}
                </div>
              </div>
              <div className="text-sm text-text-secondary">
                用户 ID：{session?.user.id ?? "-"}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-secondary">
              <ShieldCheck className="h-5 w-5 text-icon-primary" />
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-text-secondary">权限角色</div>
                <div className="text-lg font-semibold capitalize text-text-primary">
                  {session?.user.role ?? "-"}
                </div>
              </div>
              <div className="text-sm text-text-secondary">
                密码修改后立即生效，不保留旧密码。
              </div>
            </div>
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-secondary">
            <KeyRound className="h-5 w-5 text-icon-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              修改密码
            </h2>
            <p className="text-sm text-text-secondary">
              新密码至少 6 位，且不能与当前密码相同。
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="当前密码"
              type="password"
              value={form.currentPassword}
              onChange={(currentPassword) =>
                setForm((previous) => ({ ...previous, currentPassword }))
              }
              placeholder="请输入当前密码"
              disabled={isSubmitting}
            />
            <TextInput
              label="新密码"
              type="password"
              value={form.newPassword}
              onChange={(newPassword) =>
                setForm((previous) => ({ ...previous, newPassword }))
              }
              placeholder="请输入新密码"
              disabled={isSubmitting}
            />
          </div>

          <TextInput
            label="确认新密码"
            type="password"
            value={form.confirmPassword}
            onChange={(confirmPassword) =>
              setForm((previous) => ({ ...previous, confirmPassword }))
            }
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

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "保存中..." : "更新密码"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setForm(initialFormState);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              disabled={isSubmitting}
            >
              重置
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              退出登录
            </h2>
            <p className="text-sm text-text-secondary">
              结束当前设备上的登录状态并返回登录页。
            </p>
          </div>
          <Button variant="outline" onClick={() => logout()}>
            <LogOut className="h-4 w-4" />
            退出登录
          </Button>
        </div>
      </Card>
    </div>
  );
}
