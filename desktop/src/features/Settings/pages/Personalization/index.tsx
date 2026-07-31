import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Brain, Info, Sparkles } from "lucide-react";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import {
  Button,
  Drawer,
  Select,
  Switch,
  TextArea,
  TextInput,
} from "@/shared/ui";
import SectionCard, { SectionCardRow } from "@/shared/ui/SectionCard";

type TonePreset = "friendly" | "professional" | "concise" | "direct";

export default function PersonalizationSettings() {
  const { t } = useTranslation();
  const [tone, setTone] = useState<TonePreset>("friendly");
  const [customInstructions, setCustomInstructions] = useState("");
  const [nickname, setNickname] = useState("");
  const [occupation, setOccupation] = useState("");
  const [details, setDetails] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");

  const toneOptions = useMemo(
    () =>
      (["friendly", "professional", "concise", "direct"] as const).map(
        (value) => ({
          value,
          label: t(`settings.personalization.tone.options.${value}`),
        }),
      ),
    [t],
  );

  return (
    <>
      <SettingsPageLayout
        miniTitle={t("settings.personalization.page.miniTitle")}
        title={t("settings.personalization.page.title")}
        description={t("settings.personalization.page.description")}
        contentClassName="space-y-4 pt-6"
        contentMode="flow"
      >
        <SectionCard
          title={t("settings.personalization.communication.title")}
          icon={<Sparkles className="h-4 w-4" />}
          divided
        >
          <SectionCardRow>
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">
                {t("settings.personalization.tone.label")}
              </div>
              <div className="mt-0.5 max-w-2xl text-xs leading-5 text-text-secondary">
                {t("settings.personalization.tone.description")}
              </div>
            </div>
            <div className="w-full max-w-[190px] shrink-0">
              <Select
                value={tone}
                onChange={(value) => setTone(value as TonePreset)}
                options={toneOptions}
                compact
              />
            </div>
          </SectionCardRow>

          <div className="p-4">
            <TextArea
              label={t("settings.personalization.instructions.label")}
              value={customInstructions}
              onChange={setCustomInstructions}
              placeholder={t(
                "settings.personalization.instructions.placeholder",
              )}
              rows={4}
            />
          </div>
        </SectionCard>

        <SectionCard
          title={t("settings.personalization.aboutYou.title")}
          contentClassName="grid gap-4 p-4 md:grid-cols-2"
        >
          <TextInput
            label={t("settings.personalization.aboutYou.nickname")}
            value={nickname}
            onChange={setNickname}
            placeholder={t(
              "settings.personalization.aboutYou.nicknamePlaceholder",
            )}
          />
          <TextInput
            label={t("settings.personalization.aboutYou.occupation")}
            value={occupation}
            onChange={setOccupation}
            placeholder={t(
              "settings.personalization.aboutYou.occupationPlaceholder",
            )}
          />
          <div className="md:col-span-2">
            <TextArea
              label={t("settings.personalization.aboutYou.details")}
              value={details}
              onChange={setDetails}
              placeholder={t(
                "settings.personalization.aboutYou.detailsPlaceholder",
              )}
              rows={3}
            />
          </div>
        </SectionCard>

        <SectionCard
          title={t("settings.personalization.memory.title")}
          icon={<Brain className="h-4 w-4" />}
          meta={
            <span className="inline-flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              {t("settings.personalization.previewOnly")}
            </span>
          }
          divided
        >
          <SectionCardRow>
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">
                {t("settings.personalization.memory.enable")}
              </div>
              <div className="mt-0.5 max-w-2xl text-xs leading-5 text-text-secondary">
                {t("settings.personalization.memory.enableDescription")}
              </div>
            </div>
            <Switch
              checked={memoryEnabled}
              onChange={() => setMemoryEnabled((enabled) => !enabled)}
              ariaLabel={t("settings.personalization.memory.enable")}
            />
          </SectionCardRow>

          <SectionCardRow>
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">
                {t("settings.personalization.memory.summary")}
              </div>
              <div className="mt-0.5 max-w-2xl text-xs leading-5 text-text-secondary">
                {t("settings.personalization.memory.summaryDescription")}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setMemoryDrawerOpen(true)}
              disabled={!memoryEnabled}
            >
              {t("settings.personalization.memory.manage")}
            </Button>
          </SectionCardRow>
        </SectionCard>
      </SettingsPageLayout>

      <Drawer
        open={memoryDrawerOpen}
        onClose={() => setMemoryDrawerOpen(false)}
        width={620}
        closeLabel={t("settings.personalization.memory.close")}
        header={
          <div>
            <div className="text-base font-semibold text-text-primary">
              {t("settings.personalization.memory.drawerTitle")}
            </div>
            <div className="mt-1 text-xs text-text-tertiary">
              {t("settings.personalization.memory.drawerDescription")}
            </div>
          </div>
        }
        footer={
          <Button onClick={() => setMemoryDrawerOpen(false)}>
            {t("settings.personalization.memory.done")}
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="rounded-ui-panel border border-border bg-surface-secondary p-4">
            <div className="text-sm font-semibold text-text-primary">
              {t("settings.personalization.memory.overviewTitle")}
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {t("settings.personalization.memory.overviewDescription")}
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <TextArea
              label={t("settings.personalization.memory.updateLabel")}
              value={memoryDraft}
              onChange={setMemoryDraft}
              placeholder={t(
                "settings.personalization.memory.updatePlaceholder",
              )}
              rows={3}
            />
            <div className="mt-2 text-xs text-text-tertiary">
              {t("settings.personalization.memory.updateHint")}
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
