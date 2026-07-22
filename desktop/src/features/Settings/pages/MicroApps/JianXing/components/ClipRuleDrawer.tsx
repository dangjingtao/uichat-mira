import { Focus, Plus, Save, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Drawer, IconButton, NumberInput, Select, Switch, TextInput } from "@/shared/ui";
import type { ClipRule, ClipRules } from "@/shared/api/webbridge";

interface ClipRuleDrawerProps {
  open: boolean;
  onClose: () => void;
  ruleKey: string;
  ruleForm: ClipRule;
  clipRules: ClipRules;
  rulesSaving: boolean;
  regionPicking: "include" | "exclude" | null;
  extensionConnected: boolean;
  rulesError: string;
  rulesMessage: string;
  onRuleFormChange: (patch: Partial<ClipRule>) => void;
  onPickRuleRegion: (kind: "include" | "exclude") => void;
  onRemoveExcludeRegion: (selector: string) => void;
  onDelete: () => void;
  onSave: () => void;
}

export default function ClipRuleDrawer({
  open,
  onClose,
  ruleKey,
  ruleForm,
  clipRules,
  rulesSaving,
  regionPicking,
  extensionConnected,
  rulesError,
  rulesMessage,
  onRuleFormChange,
  onPickRuleRegion,
  onRemoveExcludeRegion,
  onDelete,
  onSave,
}: ClipRuleDrawerProps) {
  const { t } = useTranslation();
  const key = (name: string) => `settings.microApps.jianXing.rulesDrawer.${name}`;
  const hasSavedRule = Boolean(clipRules[ruleKey]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={620}
      closeLabel={t(key("close"))}
      closeMaskLabel={t(key("close"))}
      header={
        <div>
          <div className="text-sm font-semibold text-text-primary">
            {hasSavedRule ? t(key("editTitle")) : t(key("addTitle"))}
          </div>
          <div className="mt-1 text-xs text-text-secondary">
            {t(key("description"))}
          </div>
        </div>
      }
      footer={
        <>
          <Button size="sm" variant="danger-ghost" onClick={onDelete} disabled={rulesSaving || !hasSavedRule}>
            <Trash2 className="h-4 w-4" />{t(key("delete"))}
          </Button>
          <Button size="sm" variant="primary" onClick={onSave} disabled={rulesSaving || !extensionConnected}>
            <Save className="h-4 w-4" />{rulesSaving ? t(key("saving")) : t(key("save"))}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {rulesError ? <Alert variant="danger" title={t(key("syncFailed"))}>{rulesError}</Alert> : null}
        {rulesMessage ? <Alert variant="success" title={t(key("status"))}>{rulesMessage}</Alert> : null}

        <TextInput
          label={t(key("alias"))}
          value={ruleForm.alias || ""}
          onChange={(value) => onRuleFormChange({ alias: value })}
          placeholder={t(key("aliasPlaceholder"))}
          compact
        />
        <TextInput
          label={t(key("urlPattern"))}
          value={ruleForm.urlPattern}
          onChange={(value) => onRuleFormChange({ urlPattern: value })}
          placeholder={ruleForm.urlPatternMode === "regex" ? t(key("regexPlaceholder")) : t(key("wildcardPlaceholder"))}
          compact
        />
        <Select
          label={t(key("matchMode"))}
          value={ruleForm.urlPatternMode || "wildcard"}
          onChange={(value) => onRuleFormChange({ urlPatternMode: value as "wildcard" | "regex" })}
          options={[{ value: "wildcard", label: t(key("wildcard")) }, { value: "regex", label: t(key("regex")) }]}
        />
        <p className="text-xs leading-5 text-text-tertiary">
          {t(key("matchHelp"))}
        </p>

        <div className="flex items-center justify-between rounded-ui-control border border-border bg-surface-secondary px-3 py-2">
          <div>
            <div className="text-sm font-medium text-text-primary">{t(key("enabled"))}</div>
            <div className="text-xs text-text-tertiary">{t(key("disabledHint"))}</div>
          </div>
          <Switch checked={ruleForm.enabled} onChange={() => onRuleFormChange({ enabled: !ruleForm.enabled })} ariaLabel={t(key("enabledAria"))} size="sm" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-text-secondary">{t(key("includeRegion"))}</span>
            <Button size="xs" variant="outline" onClick={() => onPickRuleRegion("include")} disabled={regionPicking !== null || !extensionConnected}>
              <Focus className="h-4 w-4" />{regionPicking === "include" ? t(key("picking")) : ruleForm.includeSelector ? t(key("reselect")) : t(key("selectInclude"))}
            </Button>
          </div>
          <div className="min-h-16 rounded-ui-control border border-border bg-surface-secondary px-3 py-2">
            {ruleForm.includeRegion ? <>
              <div className="text-sm font-medium text-text-primary">{ruleForm.includeRegion.tag} · {ruleForm.includeRegion.elementCount} 个元素 · {ruleForm.includeRegion.imageCount} 张图片</div>
              <p className="mt-1 line-clamp-2 text-xs text-text-tertiary">{ruleForm.includeRegion.text || t(key("noPreview"))}</p>
            </> : ruleForm.includeSelector ? <p className="text-sm text-text-secondary">{t(key("legacyRegion"))}</p> : <p className="text-sm text-text-tertiary">{t(key("emptyInclude"))}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-text-secondary">{t(key("excludeRegion"))}</span>
            <Button size="xs" variant="outline" onClick={() => onPickRuleRegion("exclude")} disabled={regionPicking !== null || !extensionConnected}>
              <Plus className="h-4 w-4" />{regionPicking === "exclude" ? t(key("picking")) : t(key("addExclude"))}
            </Button>
          </div>
          <div className="space-y-1.5 rounded-ui-control border border-border bg-surface-secondary p-2">
            {(ruleForm.excludeRegions || ruleForm.excludeSelectors.map((selector) => ({ selector, summary: undefined }))).map((region, index) => (
              <div key={region.selector} className="flex items-start gap-2 rounded-ui-control bg-surface-primary px-2.5 py-2">
                <div className="min-w-0 flex-1"><div className="text-xs font-medium text-text-primary">{t(key("excludeItem"), { index: index + 1, tag: region.summary?.tag || t(key("webRegion")) })}</div><p className="mt-0.5 truncate text-xs text-text-tertiary">{region.summary?.text || t(key("selectedRegion"))}</p></div>
                <IconButton size="xs" ariaLabel={t(key("deleteExclude"), { index: index + 1 })} onClick={() => onRemoveExcludeRegion(region.selector)}><X className="h-3.5 w-3.5" /></IconButton>
              </div>
            ))}
            {!(ruleForm.excludeRegions || ruleForm.excludeSelectors.map((selector) => ({ selector, summary: undefined }))).length ? <p className="px-1 py-2 text-xs text-text-tertiary">{t(key("noExclude"))}</p> : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <NumberInput label={t(key("minWidth"))} value={ruleForm.imagePolicy.minWidth} onChange={(value) => onRuleFormChange({ imagePolicy: { ...ruleForm.imagePolicy, minWidth: value } })} compact />
          <NumberInput label={t(key("minHeight"))} value={ruleForm.imagePolicy.minHeight} onChange={(value) => onRuleFormChange({ imagePolicy: { ...ruleForm.imagePolicy, minHeight: value } })} compact />
          <NumberInput label={t(key("maxCount"))} value={ruleForm.imagePolicy.maxCount} onChange={(value) => onRuleFormChange({ imagePolicy: { ...ruleForm.imagePolicy, maxCount: value } })} compact />
        </div>
      </div>
    </Drawer>
  );
}
