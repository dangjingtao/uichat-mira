// src/pages/SettingsAccount.tsx
import { Camera, LogOut, KeyRound, Bell, Trash2 } from "lucide-react";
import Divider from "../../components/Divider";

export default function SettingsAccount() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* 单张大卡片 */}
      <div
        className="
          rounded-2xl
          bg-white dark:bg-[#171717]
          border border-gray-200 dark:border-white/10
          overflow-hidden
        "
      >
        {/* ===== 用户信息区域 ===== */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-4">
            {/* 用户信息 */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-base font-medium text-gray-900 dark:text-white truncate">
                用户名
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                user@example.com
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                一个面向企业知识库验证的 Electron
                桌面应用初始化项目，支持本地和远程模型、向量数据库双模式切换。一个面向企业知识库验证的
                Electron
                桌面应用初始化项目，支持本地和远程模型、向量数据库双模式切换。
                一个面向企业知识库验证的 Electron
                桌面应用初始化项目，支持本地和远程模型、向量数据库双模式切换。一个面向企业知识库验证的
                Electron
                桌面应用初始化项目，支持本地和远程模型、向量数据库双模式切换。
              </p>
            </div>
          </div>
        </div>

        <Divider />

        {/* ===== 设置项列表 ===== */}
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {/* 修改密码 */}
          <SettingItem
            icon={<KeyRound className="w-4 h-4" />}
            title="修改密码"
            description="定期更改密码以保护账号安全"
            action={<Button variant="secondary">修改</Button>}
          />

          {/* 通知 */}
          <SettingItem
            icon={<Bell className="w-4 h-4" />}
            title="通知"
            description="管理邮件和系统通知偏好"
            action={<Toggle checked />}
          />

          {/* 注销账号 */}
          <SettingItem
            icon={
              <Trash2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            }
            title="注销账号"
            description="永久删除账号及所有数据，不可恢复"
            action={
              <Button variant="destructive" outline>
                注销
              </Button>
            }
          />

          {/* 退出登录 */}
          <SettingItem
            icon={<LogOut className="w-4 h-4" />}
            title="退出登录"
            description="从当前设备登出"
            action={<Button variant="ghost">退出</Button>}
          />
        </div>
      </div>
    </div>
  );
}

/* ===== 子组件 ===== */

function SettingItem({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-3.5">
        <div className="text-gray-400 dark:text-gray-500">{icon}</div>
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {title}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {description}
          </div>
        </div>
      </div>
      {action}
    </div>
  );
}

function Button({
  children,
  variant = "secondary",
  outline = false,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  outline?: boolean;
}) {
  const base = "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors";

  const styles = {
    primary:
      "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100",
    secondary:
      "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10",
    destructive: outline
      ? "border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/20"
      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
    ghost:
      "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5",
  };

  return <button className={`${base} ${styles[variant]}`}>{children}</button>;
}

function Toggle({ checked }: { checked: boolean }) {
  return (
    <button
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-gray-900 dark:bg-white" : "bg-gray-200 dark:bg-gray-700"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}
