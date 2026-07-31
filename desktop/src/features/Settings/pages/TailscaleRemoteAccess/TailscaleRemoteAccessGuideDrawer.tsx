import { useTranslation } from "react-i18next";
import Drawer from "@/shared/ui/Drawer";

export default function TailscaleRemoteAccessGuideDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={460}
      closeLabel={t("settings.tailscaleRemoteAccess.guide.close")}
      closeMaskLabel={t("settings.tailscaleRemoteAccess.guide.close")}
      header={
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-text-tertiary">
            Tailscale
          </div>
          <div className="text-base font-semibold text-text-primary">
            {t("settings.tailscaleRemoteAccess.guide.drawerTitle")}
          </div>
          <div className="text-sm leading-6 text-text-secondary">
            {t("settings.tailscaleRemoteAccess.guide.intro")}
          </div>
        </div>
      }
    >
      <ol className="space-y-3">
        {(["install", "login", "publish"] as const).map((step, index) => (
          <li
            key={step}
            className="rounded-ui-control border border-border bg-surface-secondary px-4 py-3"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <span>
                {t(`settings.tailscaleRemoteAccess.guide.steps.${step}.title`)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {t(
                `settings.tailscaleRemoteAccess.guide.steps.${step}.description`,
              )}
            </p>
          </li>
        ))}
      </ol>
    </Drawer>
  );
}
