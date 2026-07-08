import { Loader2, Plug, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import { Button, TextInput } from "@/shared/ui";
import type { ComfyUiConnectionStatus } from "../model/comfyui-workbench";

interface ComfyUiConnectionCardProps {
  status: ComfyUiConnectionStatus;
  address: string;
  editing: boolean;
  draftAddress: string;
  testing: boolean;
  running: boolean;
  onDraftAddressChange: (value: string) => void;
  onStartCreate: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onTest: () => void;
}

const statusVariant = (status: ComfyUiConnectionStatus) => {
  if (status === "connectable") {
    return "success";
  }
  if (status === "failed") {
    return "danger";
  }
  if (status === "unverified") {
    return "warning";
  }
  return "neutral";
};

export default function ComfyUiConnectionCard({
  status,
  address,
  editing,
  draftAddress,
  testing,
  running,
  onDraftAddressChange,
  onStartCreate,
  onStartEdit,
  onCancelEdit,
  onSave,
  onTest,
}: ComfyUiConnectionCardProps) {
  const { t } = useTranslation();
  const saveDisabled = running || !draftAddress.trim() || testing;

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-text-primary">
            {t("settings.microApps.imageGenerationStudio.cards.connection.title")}
          </div>
          <div className="text-sm leading-6 text-text-secondary">
            {t(
              "settings.microApps.imageGenerationStudio.cards.connection.description",
            )}
          </div>
        </div>
        <Badge variant={statusVariant(status)} size="sm">
          {t(`settings.microApps.imageGenerationStudio.connection.status.${status}`)}
        </Badge>
      </div>

      {!editing ? (
        <div className="space-y-4">
          <div className="rounded-ui-panel border border-border bg-surface-secondary/20 p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ui-panel bg-surface-primary text-icon-secondary">
                <Plug className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 space-y-1">
                {status === "unconfigured" ? (
                  <div className="text-sm text-text-secondary">
                    {t(
                      "settings.microApps.imageGenerationStudio.connection.messages.empty",
                    )}
                  </div>
                ) : (
                  <a
                    href={address}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all font-mono text-xs text-primary underline-offset-4 hover:underline"
                  >
                    {address}
                  </a>
                )}
                {status === "failed" ? (
                  <div className="text-xs text-danger-text">
                    {t(
                      "settings.microApps.imageGenerationStudio.connection.messages.failed",
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {status === "unconfigured" ? (
              <Button variant="primary" onClick={onStartCreate} disabled={running}>
                {t(
                  "settings.microApps.imageGenerationStudio.connection.actions.new",
                )}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={onStartEdit} disabled={running}>
                  {t(
                    "settings.microApps.imageGenerationStudio.connection.actions.edit",
                  )}
                </Button>
                <Button
                  variant={status === "failed" ? "primary" : "outline"}
                  onClick={onTest}
                  disabled={running || testing}
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  {t(
                    status === "failed"
                      ? "settings.microApps.imageGenerationStudio.connection.actions.retry"
                      : "settings.microApps.imageGenerationStudio.connection.actions.test",
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <TextInput
            label={t(
              "settings.microApps.imageGenerationStudio.connection.fields.address",
            )}
            value={draftAddress}
            onChange={onDraftAddressChange}
            placeholder={t(
              "settings.microApps.imageGenerationStudio.connection.placeholders.address",
            )}
            disabled={running || testing}
          />

          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={onSave} disabled={saveDisabled}>
              {t(
                "settings.microApps.imageGenerationStudio.connection.actions.save",
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onCancelEdit}
              disabled={running || testing}
            >
              {t(
                "settings.microApps.imageGenerationStudio.connection.actions.cancel",
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
