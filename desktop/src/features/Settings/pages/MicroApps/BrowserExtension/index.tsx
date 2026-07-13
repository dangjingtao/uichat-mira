import { useState } from "react";
import { Copy, KeyRound, ShieldCheck } from "lucide-react";
import { ApiError, post } from "@/shared/lib/request";
import Card from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import SettingsNotice from "@/features/Settings/components/SettingsNotice";
import MicroAppPageLayout from "../components/MicroAppPageLayout";

export default function BrowserExtensionPage() {
  const [extensionCode, setExtensionCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const generateCode = async () => {
    setLoading(true);
    setMessage("");
    try {
      const result = await post<{ code: string }>("/oauth/extension/authorization-code");
      setExtensionCode(result.code);
      setMessage("授权码已生成，5 分钟内有效且只能使用一次。");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "生成授权码失败");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!extensionCode) return;
    await navigator.clipboard.writeText(extensionCode);
    setMessage("授权码已复制");
  };

  return (
    <MicroAppPageLayout
      miniTitle="微应用"
      title="浏览器扩展"
      description="管理 Mira Clipper 的授权，让浏览器中的文本和图片可以保存到智识进化库。"
      contentClassName="space-y-4 pt-6"
    >
      <Card className="max-w-3xl space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-text-secondary" />
          <h2 className="text-sm font-semibold text-text-primary">浏览器扩展授权</h2>
        </div>
        <p className="text-sm leading-6 text-text-secondary">
          使用一次性授权码连接 Mira Clipper，不需要把访问令牌复制到浏览器扩展中。
        </p>
        <SettingsNotice tone="info">
          生成授权码后，将它粘贴到 Mira Clipper 扩展中完成授权。授权码只显示在当前登录用户的前端。
        </SettingsNotice>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={loading} onClick={() => void generateCode()}>
            <KeyRound className="h-4 w-4" />
            {loading ? "生成中..." : "生成授权码"}
          </Button>
          {extensionCode ? (
            <>
              <code className="rounded-ui-control border border-border bg-surface-secondary px-3 py-2 text-sm font-semibold tracking-[0.16em] text-text-primary">
                {extensionCode}
              </code>
              <Button variant="ghost" size="sm" onClick={() => void copyCode()}>
                <Copy className="h-4 w-4" />
                复制
              </Button>
            </>
          ) : null}
        </div>
        {message ? <p className="text-xs text-text-secondary">{message}</p> : null}
      </Card>
    </MicroAppPageLayout>
  );
}
