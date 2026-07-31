import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  ExternalLink,
  HelpCircle,
  Link2,
  LoaderCircle,
  Monitor,
  Network,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import SettingsNotice from "../../components/SettingsNotice";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import {
  checkTailscaleRemoteAccess,
  getTailscaleRemoteAccess,
  revokeTailscaleRemoteDevice,
  updateTailscaleRemoteAccess,
  type TailscaleRemoteAccessSnapshot,
  type TailscaleRemoteRuntimeState,
} from "@/shared/api/generalSettings";
import { ApiError } from "@/shared/lib/request";
import { openExternalUrl } from "@/shared/platform/desktopRuntime";
import { Badge, Button, Switch, TextInput } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import SectionCard, { SectionCardRow } from "@/shared/ui/SectionCard";
import TailscaleRemoteAccessGuideDrawer from "./TailscaleRemoteAccessGuideDrawer";
import { getTailscaleRemoteAccessCopy } from "./copy";

const statusVariant = (state: TailscaleRemoteRuntimeState) => {
  if (state === "ready") {
    return "success" as const;
  }
  if (
    state === "serve_conflict" ||
    state === "unreachable" ||
    state === "error"
  ) {
    return "danger" as const;
  }
  if (
    state === "connecting" ||
    state === "serve_not_configured" ||
    state === "needs_login"
  ) {
    return "warning" as const;
  }
  return "muted" as const;
};

const readErrorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError || error instanceof Error ? error.message : fallback;

export default function TailscaleRemoteAccessSettings() {
  const { i18n } = useTranslation();
  const copy = getTailscaleRemoteAccessCopy(i18n.resolvedLanguage);
  const [snapshot, setSnapshot] =
    useState<TailscaleRemoteAccessSnapshot | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  const applySnapshot = (next: TailscaleRemoteAccessSnapshot) => {
    setSnapshot(next);
    setEnabled(next.config.enabled);
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await getTailscaleRemoteAccess();
        if (!cancelled) {
          applySnapshot(next);
          setError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(readErrorMessage(requestError, copy.messages.loadFailed));
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
  }, [copy.messages.loadFailed]);

  const runtime = snapshot?.runtime;
  const statusCopy = runtime
    ? copy.status.states[runtime.state]
    : copy.status.states.connecting;
  const dirty = snapshot ? enabled !== snapshot.config.enabled : false;
  const canChangeRemoteAccess =
    runtime?.state === "connected" ||
    runtime?.state === "ready" ||
    runtime?.state === "unreachable" ||
    runtime?.state === "serve_not_configured";

  const formattedCheckedAt = useMemo(() => {
    if (!runtime?.checkedAt) {
      return "-";
    }

    const value = new Date(runtime.checkedAt);
    return Number.isNaN(value.getTime())
      ? runtime.checkedAt
      : new Intl.DateTimeFormat(i18n.resolvedLanguage || "zh-CN", {
          dateStyle: "medium",
          timeStyle: "medium",
        }).format(value);
  }, [i18n.resolvedLanguage, runtime?.checkedAt]);

  const handleCheck = async () => {
    setChecking(true);
    setError("");
    try {
      applySnapshot(await checkTailscaleRemoteAccess());
    } catch (requestError) {
      setError(readErrorMessage(requestError, copy.messages.checkFailed));
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      applySnapshot(await updateTailscaleRemoteAccess(enabled));
      message.success(copy.messages.saved);
    } catch (requestError) {
      setError(readErrorMessage(requestError, copy.messages.saveFailed));
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeDevice = (id: string, name: string) => {
    Modal.confirm({
      title: copy.devices.revoke,
      description: name,
      tone: "danger",
      confirmText: copy.devices.revoke,
      cancelText: i18n.resolvedLanguage?.startsWith("zh") ? "取消" : "Cancel",
      onConfirm: async () => {
        setRevokingDeviceId(id);
        try {
          await revokeTailscaleRemoteDevice(id);
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  pairedDevices: current.pairedDevices.filter(
                    (device) => device.id !== id,
                  ),
                }
              : current,
          );
          message.success(copy.devices.revoked);
        } catch (requestError) {
          message.error(
            readErrorMessage(requestError, copy.devices.revokeFailed),
          );
        } finally {
          setRevokingDeviceId(null);
        }
      },
      onCancel: () => void 0,
    });
  };

  const serveValue = runtime?.serveManagedByMira
    ? copy.diagnostics.serveManaged
    : runtime?.serveConfigured
      ? copy.diagnostics.serveOther
      : copy.diagnostics.serveMissing;
  const healthValue =
    runtime?.healthOk === true
      ? copy.diagnostics.healthOk
      : runtime?.healthOk === false
        ? copy.diagnostics.healthFailed
        : copy.diagnostics.healthPending;

  return (
    <>
      <SettingsPageLayout
        miniTitle={copy.page.miniTitle}
        title={copy.page.title}
        description={copy.page.description}
        slot={
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setGuideOpen(true)}
          >
            <HelpCircle className="h-4 w-4" />
            {copy.actions.help}
          </Button>
        }
        contentClassName="space-y-4 pt-6"
        contentMode="flow"
      >
        {error ? <SettingsNotice tone="danger">{error}</SettingsNotice> : null}

        <SectionCard
          title={copy.status.title}
          icon={<Network className="h-4 w-4" />}
          meta={
            <Badge variant={runtime ? statusVariant(runtime.state) : "muted"}>
              {loading ? copy.actions.checking : statusCopy[0]}
            </Badge>
          }
          divided
        >
          <SectionCardRow>
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">
                {copy.status.connection}
              </div>
              <div className="mt-0.5 text-xs leading-5 text-text-secondary">
                {statusCopy[1]}
              </div>
              {runtime?.error ? (
                <div className="mt-1 text-xs leading-5 text-danger-text">
                  {runtime.error}
                </div>
              ) : null}
            </div>
            <Badge
              variant={runtime ? statusVariant(runtime.state) : "muted"}
              outline
            >
              {statusCopy[0]}
            </Badge>
          </SectionCardRow>

          <SectionCardRow>
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">
                {copy.status.enable}
              </div>
              <div className="mt-0.5 text-xs leading-5 text-text-secondary">
                {copy.status.enableDescription}
              </div>
            </div>
            <Switch
              checked={enabled}
              onChange={() => setEnabled((current) => !current)}
              ariaLabel={copy.status.enable}
              disabled={
                loading || checking || saving || !canChangeRemoteAccess
              }
            />
          </SectionCardRow>
        </SectionCard>

        <SectionCard
          title={copy.device.title}
          icon={<Monitor className="h-4 w-4" />}
          contentClassName="space-y-4 p-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label={copy.device.name}
              value={runtime?.deviceName || copy.device.unavailable}
              onChange={() => void 0}
              disabled
            />
            <TextInput
              label={copy.device.tailnet}
              value={
                runtime?.tailnetDomain ||
                runtime?.tailnetName ||
                copy.device.unavailable
              }
              onChange={() => void 0}
              disabled
            />
          </div>

          <div className="rounded-ui-panel border border-border bg-surface-secondary px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-text-secondary">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                {copy.device.accessAddress}
              </div>
              {runtime?.accessUrl ? (
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={runtime.state !== "ready"}
                  onClick={() => void openExternalUrl(runtime.accessUrl!)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {copy.device.open}
                </Button>
              ) : null}
            </div>
            <div className="mt-2 break-all font-mono text-sm text-text-primary">
              {runtime?.accessUrl || copy.device.unavailable}
            </div>
            <div className="mt-1 text-xs text-text-tertiary">
              {copy.device.autoDetected}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={copy.access.title}
          icon={<ShieldCheck className="h-4 w-4" />}
          divided
        >
          {[
            [copy.access.network, copy.access.networkValue],
            [copy.access.auth, copy.access.authValue],
            [copy.access.policy, copy.access.policyValue],
          ].map(([label, value]) => (
            <SectionCardRow key={label}>
              <span className="text-sm text-text-secondary">{label}</span>
              <span className="max-w-[60%] text-right text-sm font-medium text-text-primary">
                {value}
              </span>
            </SectionCardRow>
          ))}
        </SectionCard>

        <SectionCard
          title={copy.devices.title}
          icon={<Smartphone className="h-4 w-4" />}
          divided={Boolean(snapshot?.pairedDevices.length)}
          contentClassName={
            snapshot?.pairedDevices.length ? undefined : "p-4"
          }
        >
          {snapshot?.pairedDevices.length ? (
            snapshot.pairedDevices.map((device) => (
              <SectionCardRow key={device.id}>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary">
                    {device.name}
                  </div>
                  <div className="mt-0.5 text-xs text-text-secondary">
                    {device.platform} · {copy.devices.lastSeen}: {" "}
                    {device.lastSeenAt || copy.devices.neverSeen}
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={revokingDeviceId === device.id}
                  onClick={() => handleRevokeDevice(device.id, device.name)}
                >
                  {revokingDeviceId === device.id ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {copy.devices.revoke}
                </Button>
              </SectionCardRow>
            ))
          ) : (
            <div className="rounded-ui-panel border border-dashed border-border bg-surface-secondary px-4 py-5 text-center">
              <div className="text-sm font-medium text-text-primary">
                {copy.devices.empty}
              </div>
              <div className="mt-1 text-xs leading-5 text-text-secondary">
                {copy.devices.emptyHint}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={copy.diagnostics.title}
          icon={<RefreshCw className="h-4 w-4" />}
          divided
        >
          {[
            [copy.diagnostics.version, runtime?.version || "-"],
            [copy.diagnostics.backend, runtime?.backendState || "-"],
            [
              copy.diagnostics.ips,
              runtime?.tailscaleIps.length
                ? runtime.tailscaleIps.join(", ")
                : "-",
            ],
            [copy.diagnostics.serve, serveValue],
            [copy.diagnostics.health, healthValue],
            [copy.diagnostics.checkedAt, formattedCheckedAt],
          ].map(([label, value]) => (
            <SectionCardRow key={label}>
              <span className="text-sm text-text-secondary">{label}</span>
              <span className="max-w-[65%] break-all text-right font-mono text-xs text-text-primary">
                {value}
              </span>
            </SectionCardRow>
          ))}
          <div className="flex justify-end gap-2 px-4 py-3">
            <Button
              disabled={loading || checking || saving}
              onClick={() => void handleCheck()}
            >
              {checking ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {checking ? copy.actions.checking : copy.actions.check}
            </Button>
            <Button
              variant="primary"
              disabled={!dirty || loading || checking || saving}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              {saving ? copy.actions.saving : copy.actions.save}
            </Button>
          </div>
        </SectionCard>
      </SettingsPageLayout>

      <TailscaleRemoteAccessGuideDrawer
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      />
    </>
  );
}
