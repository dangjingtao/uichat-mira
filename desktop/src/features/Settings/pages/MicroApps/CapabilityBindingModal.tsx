import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Select, Skeleton } from "@/shared/ui";
import { Modal } from "@/shared/ui/Modal";
import { message } from "@/shared/ui/Message";
import {
  saveMicroAppCapability,
  type MicroAppCapabilityBinding,
  type MicroAppCapabilityCode,
  type MicroAppProviderId,
} from "@/shared/api/microAppCapabilities";

type CapabilityBindingModalProps = {
  capability: MicroAppCapabilityCode;
  title: string;
  currentBinding: MicroAppCapabilityBinding | null;
  onSaved: (binding: MicroAppCapabilityBinding) => void;
};

const providerOptions: Record<MicroAppCapabilityCode, Array<{ value: MicroAppProviderId; labelKey: string }>> = {
  imageGeneration: [
    { value: "api_provider", labelKey: "apiProvider" },
    { value: "comfyui_local", labelKey: "comfyui" },
  ],
  tts: [
    { value: "piper_local", labelKey: "piper" },
    { value: "gpt_sovits", labelKey: "gptSovits" },
    { value: "api_provider", labelKey: "apiProvider" },
  ],
};

export function openCapabilityBindingModal(
  props: CapabilityBindingModalProps,
) {
  Modal.show({
    title: props.title,
    width: 560,
    maskClosable: false,
    footer: null,
    content: <CapabilityBindingModalContent {...props} />,
  });
}

function CapabilityBindingModalContent({
  capability,
  currentBinding,
  onSaved,
}: CapabilityBindingModalProps) {
  const { t } = useTranslation();
  const options = providerOptions[capability];
  const [providerId, setProviderId] = useState<MicroAppProviderId | "">(
    currentBinding?.providerId ?? options[0]?.value ?? "",
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProviderId(
      currentBinding?.providerId && options.some((item) => item.value === currentBinding.providerId)
        ? currentBinding.providerId
        : options[0]?.value ?? "",
    );
    setLoading(false);
  }, [capability, currentBinding?.providerId, options]);

  const handleSave = async () => {
    if (!providerId) {
      message.error(t("settings.microApps.capabilityBinding.selectProvider"));
      return;
    }

    setSaving(true);
    try {
      const binding = await saveMicroAppCapability(capability, {
        providerId,
      });
      onSaved(binding);
      Modal.close();
      message.success(t("settings.microApps.capabilityBinding.saved"));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("settings.microApps.capabilityBinding.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-ui-control border border-border bg-surface-secondary px-3 py-2 text-xs leading-5 text-text-secondary">
        {t("settings.microApps.capabilityBinding.description")}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton height={40} />
          <Skeleton height={40} />
        </div>
      ) : (
        <>
          <Select
            label={t("settings.microApps.capabilityBinding.provider")}
            value={providerId}
            onChange={(value) =>
              setProviderId(
                options.some((item) => item.value === value)
                  ? (value as MicroAppProviderId)
                  : "",
              )
            }
            options={options.map((option) => ({
              value: option.value,
              label: t(`settings.microApps.capabilityBinding.providers.${option.labelKey}`),
            }))}
          />
        </>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="secondary" onClick={() => Modal.close()} disabled={saving}>
          {t("settings.microApps.capabilityBinding.cancel")}
        </Button>
        <Button variant="primary" onClick={() => void handleSave()} disabled={loading || saving}>
          {saving
            ? t("settings.microApps.capabilityBinding.saving")
            : t("settings.microApps.capabilityBinding.confirm")}
        </Button>
      </div>
    </div>
  );
}
