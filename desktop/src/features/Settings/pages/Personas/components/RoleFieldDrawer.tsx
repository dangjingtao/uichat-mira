import { SquarePen } from "lucide-react";
import { useTranslation } from "react-i18next";
import Alert from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import Drawer from "@/shared/ui/Drawer";
import ExpandableSection from "@/shared/ui/ExpandableSection";
import MarkdownEditor from "@/shared/ui/MarkdownEditor";
import type { RoleField } from "../types";
import { useRoleTranslation } from "../i18n/useRoleTranslation";

interface RoleFieldDrawerProps {
  activeField: RoleField | null;
  selectedRoleId: string;
  fieldEditorValue: string;
  fieldEditorKey: number;
  onClose: () => void;
  onChange: (value: string) => void;
  onReset: () => void;
  onSave: () => void;
}

export default function RoleFieldDrawer({
  activeField,
  selectedRoleId,
  fieldEditorValue,
  fieldEditorKey,
  onClose,
  onChange,
  onReset,
  onSave,
}: RoleFieldDrawerProps) {
  const t = useRoleTranslation();
  const { t: globalT } = useTranslation();

  const activeFieldDescription = activeField
    ? t(`guide.${activeField}.description`)
    : "";
  const activeFieldNote = activeField ? t(`fieldNotes.${activeField}`) : "";
  const activeFieldSyntax = activeField
    ? t(`fieldExamples.${activeField}.syntax`)
    : "";
  const activeFieldGood = activeField
    ? t(`fieldExamples.${activeField}.good`)
    : "";
  const activeFieldBad = activeField
    ? t(`fieldExamples.${activeField}.bad`)
    : "";

  return (
    <Drawer
      open={activeField !== null}
      onClose={onClose}
      width={560}
      closeLabel={t("fieldDrawer.close")}
      closeMaskLabel={t("fieldDrawer.closeMask")}
      header={
        <div className="space-y-2">
          <div className="flex items-center gap-2  font-semibold text-text-primary">
            <SquarePen className="h-4 w-4 text-icon-secondary" />
            {activeField ? t(`form.${activeField}`) : ""}
          </div>
          <div className="text-xs leading-5 text-text-secondary">
            {activeFieldDescription}
          </div>
          <div className="text-xs leading-5 text-text-secondary">
            {activeFieldNote}
          </div>
          {activeField ? (
            <ExpandableSection
              collapsedLabel={globalT("common.actions.more")}
              expandedLabel={globalT("common.actions.collapse")}
              contentClassName="space-y-2 pt-2"
            >
              <Alert variant="info">
                <div className="whitespace-pre-wrap break-words text-xs leading-5">
                  {activeFieldSyntax}
                </div>
              </Alert>
              <Alert variant="success">
                <div className="whitespace-pre-wrap break-words text-xs leading-5">
                  {activeFieldGood}
                </div>
              </Alert>
              <Alert variant="danger">
                <div className="whitespace-pre-wrap break-words text-xs leading-5">
                  {activeFieldBad}
                </div>
              </Alert>
            </ExpandableSection>
          ) : null}
        </div>
      }
      bodyClassName="flex min-h-0 flex-col overflow-hidden py-3"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onReset}>
            {globalT("common.actions.reset")}
          </Button>
          <Button size="sm" onClick={onSave}>
            {globalT("common.actions.save")}
          </Button>
        </div>
      }
    >
      {activeField ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <MarkdownEditor
            key={`${selectedRoleId}-${activeField}-${fieldEditorKey}`}
            initialValue={fieldEditorValue}
            onChange={onChange}
            placeholder={t(`form.${activeField}`)}
            className="min-h-0 flex-1 overflow-hidden"
          />
        </div>
      ) : null}
    </Drawer>
  );
}
