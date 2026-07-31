import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, HelpCircle, Link2, Monitor, Network } from "lucide-react";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import {
  Badge,
  Button,
  Select,
  Switch,
  TextInput,
} from "@/shared/ui";
import SectionCard, { SectionCardRow } from "@/shared/ui/SectionCard";
import TailscaleRemoteAccessGuideDrawer from "./TailscaleRemoteAccessGuideDrawer";

type AccessScope = "owner" | "tailnet";

export default function TailscaleRemoteAccessSettings() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [tailnetDomain, setTailnetDomain] = useState("");
  const [accessScope, setAccessScope] = useState<AccessScope>("owner");
  const [guideOpen, setGuideOpen] = useState(false);

  const accessScopeOptions = useMemo(
    () =>
      (["owner", "tailnet"] as const).map((value) => ({
        value,
        label: t(`settings.tailscaleRemoteAccess.access.options.${value}`),
      })),
    [t],
  );

  const normalizedDeviceName = deviceName.trim() || "mira-desktop";
  const normalizedTailnet = tailnetDomain.trim() || "example.ts.net";
  const previewAddress = `https://${normalizedDeviceName}.${normalizedTailnet}`;

  return (
    <>
      <SettingsPageLayout
        miniTitle={t("settings.tailscaleRemoteAccess.page.miniTitle")}
        title={t("settings.tailscaleRemoteAccess.page.title")}
        description={t("settings.tailscaleRemoteAccess.page.description")}
        slot={
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setGuideOpen(true)}
          >
            <HelpCircle className="h-4 w-4" />
            {t("settings.tailscaleRemoteAccess.actions.openGuide")}
          </Button>
        }
        contentClassName="space-y-4 pt-6"
        contentMode="flow"
      >
      <SectionCard
        title={t("settings.tailscaleRemoteAccess.status.title")}
        icon={<Network className="h-4 w-4" />}
        meta={
          <Badge variant="muted">
            {t("settings.tailscaleRemoteAccess.preview.badge")}
          </Badge>
        }
        divided
      >
        <SectionCardRow>
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary">
              {t("settings.tailscaleRemoteAccess.status.connection")}
            </div>
            <div className="mt-0.5 text-xs leading-5 text-text-secondary">
              {t("settings.tailscaleRemoteAccess.status.connectionDescription")}
            </div>
          </div>
          <Badge variant="warning" outline>
            {t("settings.tailscaleRemoteAccess.status.notConnected")}
          </Badge>
        </SectionCardRow>

        <SectionCardRow>
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary">
              {t("settings.tailscaleRemoteAccess.status.enable")}
            </div>
            <div className="mt-0.5 text-xs leading-5 text-text-secondary">
              {t("settings.tailscaleRemoteAccess.status.enableDescription")}
            </div>
          </div>
          <Switch
            checked={enabled}
            onChange={() => setEnabled((current) => !current)}
            ariaLabel={t("settings.tailscaleRemoteAccess.status.enable")}
          />
        </SectionCardRow>
      </SectionCard>

      <SectionCard
        title={t("settings.tailscaleRemoteAccess.device.title")}
        icon={<Monitor className="h-4 w-4" />}
        contentClassName="space-y-4 p-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label={t("settings.tailscaleRemoteAccess.device.name")}
            value={deviceName}
            onChange={setDeviceName}
            placeholder={t(
              "settings.tailscaleRemoteAccess.device.namePlaceholder",
            )}
          />
          <TextInput
            label={t("settings.tailscaleRemoteAccess.device.tailnet")}
            value={tailnetDomain}
            onChange={setTailnetDomain}
            placeholder={t(
              "settings.tailscaleRemoteAccess.device.tailnetPlaceholder",
            )}
          />
        </div>

        <div className="rounded-ui-panel border border-border bg-surface-secondary px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <Link2 className="h-3.5 w-3.5" />
            {t("settings.tailscaleRemoteAccess.device.previewAddress")}
          </div>
          <div className="mt-2 break-all font-mono text-sm text-text-primary">
            {previewAddress}
          </div>
          <div className="mt-1 text-xs text-text-tertiary">
            {t("settings.tailscaleRemoteAccess.device.previewHint")}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t("settings.tailscaleRemoteAccess.access.title")}
        contentClassName="space-y-4 p-4"
      >
        <div className="max-w-md">
          <Select
            label={t("settings.tailscaleRemoteAccess.access.scope")}
            value={accessScope}
            onChange={(value) => setAccessScope(value as AccessScope)}
            options={accessScopeOptions}
          />
        </div>
        <p className="text-xs leading-5 text-text-secondary">
          {t("settings.tailscaleRemoteAccess.access.description")}
        </p>
        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <Button disabled>
            <Check className="h-4 w-4" />
            {t("settings.tailscaleRemoteAccess.actions.check")}
          </Button>
          <Button variant="primary" disabled>
            {t("settings.tailscaleRemoteAccess.actions.save")}
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
