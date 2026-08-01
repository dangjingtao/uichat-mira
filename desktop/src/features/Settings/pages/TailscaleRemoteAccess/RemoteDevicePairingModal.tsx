import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Clipboard,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import {
  approveRemotePairingClaim,
  createRemotePairingChallenge,
  getRemotePairingChallenge,
  rejectRemotePairingClaim,
  type CreatedPairingChallenge,
  type PairingChallengeView,
  type RemoteDeviceScope,
} from "@/shared/api/remoteAccess";
import { ApiError } from "@/shared/lib/request";
import { Badge, Button } from "@/shared/ui";
import { ModalShell } from "@/shared/ui/Modal";
import SettingsNotice from "../../components/SettingsNotice";

const readError = (error: unknown, fallback: string) =>
  error instanceof ApiError || error instanceof Error ? error.message : fallback;

const scopeLabels: Record<RemoteDeviceScope, { zh: string; en: string }> = {
  "threads:read": { zh: "读取会话", en: "Read threads" },
  "messages:read": { zh: "读取消息", en: "Read messages" },
  "messages:write": { zh: "发送消息", en: "Send messages" },
  "agent:read": { zh: "读取 Agent 状态", en: "Read agent state" },
  "agent:approve": { zh: "审批工具调用", en: "Approve tool calls" },
  "agent:control": { zh: "停止 Agent", en: "Control agent runs" },
  "artifacts:read": { zh: "读取产物", en: "Read artifacts" },
};

export default function RemoteDevicePairingModal({
  open,
  onClose,
  onPaired,
}: {
  open: boolean;
  onClose: () => void;
  onPaired: () => void | Promise<void>;
}) {
  const { i18n } = useTranslation();
  const zh = i18n.resolvedLanguage?.toLowerCase().startsWith("zh") ?? true;
  const [challenge, setChallenge] = useState<CreatedPairingChallenge | null>(null);
  const [current, setCurrent] = useState<PairingChallengeView | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"code" | "uri" | null>(null);

  const copy = useMemo(
    () =>
      zh
        ? {
            title: "配对手机设备",
            intro:
              "手机必须已经加入同一 Tailnet。配对码只在本机显示，五分钟后失效。",
            loading: "正在创建一次性配对挑战...",
            failed: "创建配对挑战失败",
            code: "配对码",
            uri: "配对链接",
            copy: "复制",
            copied: "已复制",
            waiting: "等待手机提交设备信息",
            waitingHint:
              "在 uichat-mira-mobile 中输入上面的地址与配对码。手机提交后，这里会出现确认信息。",
            requestTitle: "设备请求",
            fingerprint: "公钥指纹",
            scopes: "申请权限",
            approve: "批准设备",
            reject: "拒绝",
            approved: "设备已批准，等待手机领取凭证",
            delivered: "手机已经领取设备凭证",
            rejected: "本次配对已拒绝",
            expired: "配对码已过期，请重新生成",
            close: "关闭",
            approveFailed: "批准设备失败",
            rejectFailed: "拒绝设备失败",
          }
        : {
            title: "Pair a mobile device",
            intro:
              "The phone must already be on the same Tailnet. This one-time code expires in five minutes.",
            loading: "Creating a one-time pairing challenge...",
            failed: "Failed to create pairing challenge",
            code: "Pairing code",
            uri: "Pairing URI",
            copy: "Copy",
            copied: "Copied",
            waiting: "Waiting for the phone to submit device details",
            waitingHint:
              "Enter the address and code in uichat-mira-mobile. The device request will appear here for confirmation.",
            requestTitle: "Device request",
            fingerprint: "Public-key fingerprint",
            scopes: "Requested access",
            approve: "Approve device",
            reject: "Reject",
            approved: "Device approved; waiting for mobile to collect its credential",
            delivered: "Mobile collected the device credential",
            rejected: "This pairing request was rejected",
            expired: "The pairing code expired. Generate a new one.",
            close: "Close",
            approveFailed: "Failed to approve device",
            rejectFailed: "Failed to reject device",
          },
    [zh],
  );

  useEffect(() => {
    if (!open) {
      setChallenge(null);
      setCurrent(null);
      setError("");
      setCopied(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const created = await createRemotePairingChallenge();
        if (!cancelled) {
          setChallenge(created);
          setCurrent(created);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(readError(requestError, copy.failed));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [copy.failed, open]);

  useEffect(() => {
    if (!open || !challenge || !current) {
      return;
    }
    if (!["pending", "claimed", "approved"].includes(current.status)) {
      return;
    }

    let stopped = false;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const next = await getRemotePairingChallenge(challenge.challengeId);
          if (!stopped) {
            setCurrent(next);
          }
        } catch (requestError) {
          if (!stopped) {
            setError(readError(requestError, copy.failed));
          }
        }
      })();
    }, 1500);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [challenge, copy.failed, current, open]);

  const handleCopy = async (kind: "code" | "uri", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied((currentValue) => (currentValue === kind ? null : currentValue)), 1500);
  };

  const handleApprove = async () => {
    if (!current?.claim) return;
    setApproving(true);
    setError("");
    try {
      const next = await approveRemotePairingClaim(
        current.claim.claimId,
        current.claim.requestedScopes,
      );
      setCurrent(next);
      await onPaired();
    } catch (requestError) {
      setError(readError(requestError, copy.approveFailed));
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!current?.claim) return;
    setRejecting(true);
    setError("");
    try {
      setCurrent(await rejectRemotePairingClaim(current.claim.claimId));
    } catch (requestError) {
      setError(readError(requestError, copy.rejectFailed));
    } finally {
      setRejecting(false);
    }
  };

  const statusNotice =
    current?.status === "approved"
      ? copy.approved
      : current?.status === "delivered"
        ? copy.delivered
        : current?.status === "rejected"
          ? copy.rejected
          : current?.status === "expired"
            ? copy.expired
            : null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={copy.title}
      width={620}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {copy.close}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-text-secondary">{copy.intro}</p>

        {error ? <SettingsNotice tone="danger">{error}</SettingsNotice> : null}

        {loading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-text-secondary">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {copy.loading}
          </div>
        ) : challenge ? (
          <>
            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div className="rounded-ui-panel border border-primary/20 bg-primary/5 p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-xs font-medium text-text-secondary">
                  <KeyRound className="h-3.5 w-3.5" />
                  {copy.code}
                </div>
                <div className="mt-3 select-all font-mono text-2xl font-semibold tracking-[0.18em] text-text-primary">
                  {challenge.code}
                </div>
                <Button
                  className="mt-3"
                  size="xs"
                  variant="ghost"
                  onClick={() => void handleCopy("code", challenge.code)}
                >
                  {copied === "code" ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                  {copied === "code" ? copy.copied : copy.copy}
                </Button>
              </div>

              <div className="min-w-0 rounded-ui-panel border border-border bg-surface-secondary p-4">
                <div className="text-xs font-medium text-text-secondary">{copy.uri}</div>
                <div className="mt-2 max-h-20 overflow-auto break-all font-mono text-xs leading-5 text-text-primary">
                  {challenge.pairingUri}
                </div>
                <Button
                  className="mt-3"
                  size="xs"
                  variant="ghost"
                  onClick={() => void handleCopy("uri", challenge.pairingUri)}
                >
                  {copied === "uri" ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                  {copied === "uri" ? copy.copied : copy.copy}
                </Button>
              </div>
            </div>

            {statusNotice ? (
              <SettingsNotice
                tone={current?.status === "rejected" || current?.status === "expired" ? "danger" : "success"}
              >
                {statusNotice}
              </SettingsNotice>
            ) : current?.claim ? (
              <div className="rounded-ui-panel border border-border bg-surface-primary p-4 shadow-shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-text-primary">{copy.requestTitle}</div>
                    <div className="mt-1 text-sm text-text-primary">
                      {current.claim.deviceName} · {current.claim.platform}
                    </div>
                    {current.claim.publicKeyFingerprint ? (
                      <div className="mt-1 font-mono text-xs text-text-secondary">
                        {copy.fingerprint}: {current.claim.publicKeyFingerprint}
                      </div>
                    ) : null}

                    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-text-secondary">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {copy.scopes}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {current.claim.requestedScopes.map((scope) => (
                        <Badge key={scope} variant="muted" outline>
                          {scopeLabels[scope][zh ? "zh" : "en"]}
                        </Badge>
                      ))}
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="danger-outline"
                        disabled={approving || rejecting}
                        onClick={() => void handleReject()}
                      >
                        {rejecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        {copy.reject}
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={approving || rejecting}
                        onClick={() => void handleApprove()}
                      >
                        {approving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {copy.approve}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-ui-panel border border-dashed border-border bg-surface-secondary px-4 py-5 text-center">
                <div className="text-sm font-medium text-text-primary">{copy.waiting}</div>
                <div className="mt-1 text-xs leading-5 text-text-secondary">{copy.waitingHint}</div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </ModalShell>
  );
}
