import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { post } from "@/shared/lib/request";
import Card from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

type AuthorizeParams = Record<string, string>;

export default function ExtensionAuthorizePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, isCheckingSession } = useAuth();
  const [params] = useState<AuthorizeParams>(() => Object.fromEntries(searchParams.entries()));
  const [status, setStatus] = useState<"ready" | "authorizing" | "error">("ready");
  const [error, setError] = useState("");

  const approve = async () => {
    setStatus("authorizing");
    setError("");
    try {
      const redirect = await post<{ redirectUri: string }>("/oauth/authorize/approve", params);
      window.location.assign(redirect.redirectUri);
    } catch (requestError) {
      setStatus("error");
      setError(requestError instanceof Error ? requestError.message : "授权失败，请重试");
    }
  };

  useEffect(() => {
    if (!session) return;
    if (!params.client_id || !params.redirect_uri || !params.code_challenge || !params.state) {
      setStatus("error");
      setError("授权请求参数不完整");
    }
  }, [params, session]);

  if (isCheckingSession) {
    return <FullPageStatus message="正在校验登录状态..." />;
  }

  if (!session) {
    const returnTo = `/oauth/authorize?${searchParams.toString()}`;
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-secondary px-4 py-8">
        <Card className="w-full max-w-md space-y-5 p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-text-primary">授权 Mira Clipper</h1>
              <p className="text-sm text-text-secondary">请先登录 Mira，再确认浏览器扩展授权</p>
            </div>
          </div>
          <Button variant="primary" className="w-full" onClick={() => navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)}>
            登录 Mira
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-secondary px-4 py-8">
      <Card className="w-full max-w-md space-y-5 p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary">授权 Mira Clipper</h1>
            <p className="text-sm text-text-secondary">允许浏览器扩展将网页内容保存到洞见</p>
          </div>
        </div>
        {status === "error" ? <p className="text-sm text-danger">{error}</p> : null}
        {status === "ready" || status === "authorizing" ? (
          <Button variant="primary" className="w-full" disabled={status === "authorizing"} onClick={() => void approve()}>
            {status === "authorizing" ? "授权中..." : "确认授权"}
          </Button>
        ) : null}
        {status === "authorizing" ? <CheckCircle2 className="mx-auto h-5 w-5 text-success" /> : null}
      </Card>
    </main>
  );
}
