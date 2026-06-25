import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/Button";
import Drawer from "@/shared/ui/Drawer";
import { TextInput } from "@/shared/ui/Input";
import type { RoleLlmProfile } from "../types";
import { useRoleTranslation } from "../i18n/useRoleTranslation";

type RoleLlmProfileFieldKey = keyof RoleLlmProfile;

const PROFILE_FIELDS: Array<{
  key: RoleLlmProfileFieldKey;
  step: string;
}> = [
  { key: "temperature", step: "0.1" },
  { key: "topP", step: "0.01" },
  { key: "topK", step: "1" },
  { key: "maxTokens", step: "1" },
  { key: "frequencyPenalty", step: "0.1" },
  { key: "presencePenalty", step: "0.1" },
];

interface RoleLlmProfileDrawerProps {
  open: boolean;
  profile: RoleLlmProfile;
  saving?: boolean;
  onClose: () => void;
  onChange: (key: RoleLlmProfileFieldKey, rawValue: string) => void;
  onReset: () => void;
  onSave: () => void;
}

function getDisplayValue(value: number | undefined) {
  return typeof value === "number" ? String(value) : "";
}

export default function RoleLlmProfileDrawer({
  open,
  profile,
  saving = false,
  onClose,
  onChange,
  onReset,
  onSave,
}: RoleLlmProfileDrawerProps) {
  const t = useRoleTranslation();
  const { t: globalT } = useTranslation();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      closeLabel={t("llmProfile.drawer.close")}
      closeMaskLabel={t("llmProfile.drawer.closeMask")}
      header={
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-semibold text-text-primary">
            <SlidersHorizontal className="h-4 w-4 text-icon-secondary" />
            {t("llmProfile.drawer.title")}
          </div>
          <div className="text-xs leading-5 text-text-secondary">
            {t("llmProfile.drawer.hint")}
          </div>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onReset} disabled={saving}>
            {globalT("common.actions.reset")}
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {globalT("common.actions.save")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {PROFILE_FIELDS.map(({ key, step }) => (
          <TextInput
            key={key}
            label={t(`llmProfile.fields.${key}.label`)}
            labelHelp={t(`llmProfile.fields.${key}.tooltip`)}
            value={getDisplayValue(profile[key])}
            onChange={(value) => onChange(key, value)}
            placeholder={t(`llmProfile.fields.${key}.placeholder`)}
            type="number"
            step={step}
            disabled={saving}
          />
        ))}
      </div>
      <div className="mt-3 text-xs leading-5 text-text-secondary">
        {t("llmProfile.drawer.note")}
      </div>
    </Drawer>
  );
}
