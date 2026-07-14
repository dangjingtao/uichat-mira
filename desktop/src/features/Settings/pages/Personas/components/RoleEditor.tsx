import {
  Bot,
  ChevronRight,
  ClipboardList,
  Trash2,
  UserRoundPen,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AvatarPickerOption } from "@/shared/ui/AvatarPicker";
import AvatarPicker from "@/shared/ui/AvatarPicker";
import Badge from "@/shared/ui/Badge";
import { Button, IconButton } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { TextInput } from "@/shared/ui/Input";
import TagInput from "@/shared/ui/TagInput";
import type { RoleField, RoleRecord } from "../types";
import { FIELD_META, ROLE_FIELDS } from "../constants";
import {
  estimateTokenCount,
  getStatusLabel,
  statusTone,
  summarizeField,
} from "../utils";
import type { RoleLlmProfile } from "../types";
import RoleSectionTitle from "./RoleSectionTitle";
import { useRoleTranslation } from "../i18n/useRoleTranslation";
import RoleLlmProfileCard from "./RoleLlmProfileCard";

interface RoleEditorProps {
  selectedRole: RoleRecord | null;
  draftAvatarId: string | null;
  draftName: string;
  draftSummary: string;
  draftTags: string[];
  draftValues: Record<RoleField, string>;
  draftLlmProfile: RoleLlmProfile;
  avatarOptions: AvatarPickerOption[];
  isEdited: boolean;
  isCoreContentEmpty: boolean;
  formErrors: { name?: string; summary?: string };
  onAvatarChange: (option: AvatarPickerOption) => void;
  onAvatarClear: () => void;
  onNameChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
  onTagsChange: (tags: string[]) => void;
  onOpenFieldDrawer: (field: RoleField) => void;
  onOpenLlmProfileDrawer: () => void;
  onPreviewOpen: () => void;
  onSave: () => void;
  onReset: () => void;
  onDelete: () => void;
}

function FieldCard({
  field,
  value,
  onClick,
}: {
  field: RoleField;
  value: string;
  onClick: () => void;
}) {
  const t = useRoleTranslation();
  const FieldIcon = FIELD_META[field].icon;
  const tokenCount = estimateTokenCount(value);

  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 rounded-ui-panel border border-border bg-surface-primary p-3 text-left transition-colors hover:bg-surface-secondary"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ui-control bg-surface-secondary text-icon-secondary">
            <FieldIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold text-text-primary">
                {t(`form.${field}`)}
              </div>
              <Badge variant="neutral" className="shrink-0 whitespace-nowrap">
                ~{tokenCount} tok
              </Badge>
            </div>
            <div className="truncate text-xs leading-5 text-text-secondary">
              {summarizeField(value, t("fields.empty"))}
            </div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-icon-secondary" />
      </div>
    </button>
  );
}

export default function RoleEditor({
  selectedRole,
  draftAvatarId,
  draftName,
  draftSummary,
  draftTags,
  draftValues,
  draftLlmProfile,
  avatarOptions,
  isEdited,
  isCoreContentEmpty,
  formErrors,
  onAvatarChange,
  onAvatarClear,
  onNameChange,
  onSummaryChange,
  onTagsChange,
  onOpenFieldDrawer,
  onOpenLlmProfileDrawer,
  onPreviewOpen,
  onSave,
  onReset,
  onDelete,
}: RoleEditorProps) {
  const t = useRoleTranslation();
  const { t: globalT } = useTranslation();

  return (
    <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden p-0">
      <div className="border-b border-border px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <RoleSectionTitle
            icon={UserRoundPen}
            title={t("editor.title")}
            hint={t("editor.hint")}
          />
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={statusTone(selectedRole?.status ?? "draft")}>
              {selectedRole ? getStatusLabel(t, selectedRole.status) : "-"}
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={onPreviewOpen}
            >
              <Bot className="h-4 w-4" />
              {t("actions.preview")}
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex flex-1 flex-col">
        <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto p-3.5">
          <div className="space-y-5 pb-3.5">
            <AvatarPicker
              label={globalT("ui.avatarPicker.title")}
              value={draftAvatarId}
              options={avatarOptions}
              onChange={onAvatarChange}
              onClear={onAvatarClear}
              allowClear
            />

            <div className="grid gap-3 xl:grid-cols-2">
              <TextInput
                label={t("form.name")}
                value={draftName}
                onChange={onNameChange}
                error={formErrors.name}
              />
              <TextInput
                label={t("form.summary")}
                value={draftSummary}
                onChange={onSummaryChange}
                error={formErrors.summary}
              />
            </div>

            {isCoreContentEmpty ? (
              <div className="rounded-ui-control border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-5 text-warning-text">
                {t("form.coreContentEmpty")}
              </div>
            ) : null}

            <TagInput
              label={t("form.tags")}
              labelHelp={t("form.tagsHelp")}
              value={draftTags}
              onChange={onTagsChange}
              maxTags={3}
              placeholder={t("form.tagsPlaceholder")}
            />

            <div className="space-y-3.5 pt-1">
              <RoleSectionTitle
                icon={ClipboardList}
                title={t("fields.title")}
                hint={t("fields.hint")}
              />
              <div className="grid gap-3 xl:grid-cols-2">
                {ROLE_FIELDS.map((field) => (
                  <FieldCard
                    key={field}
                    field={field}
                    value={draftValues[field]}
                    onClick={() => onOpenFieldDrawer(field)}
                  />
                ))}
                <RoleLlmProfileCard
                  profile={draftLlmProfile}
                  onClick={onOpenLlmProfileDrawer}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-surface-primary px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <IconButton
              ariaLabel={t("actions.delete")}
              onClick={onDelete}
              styleType="ghost"
              tone="danger"
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
            <Button
              variant="secondary"
              size="sm"
              onClick={onReset}
              disabled={!isEdited}
            >
              {globalT("common.actions.reset")}
            </Button>
            <Button size="sm" onClick={onSave} disabled={!isEdited}>
              {globalT("common.actions.save")}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
