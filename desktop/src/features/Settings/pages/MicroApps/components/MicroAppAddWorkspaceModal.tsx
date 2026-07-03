import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal, Select } from "@/shared/ui";

type MicroAppAddWorkspaceModalProps = {
  open: boolean;
  appName: string;
  onClose: () => void;
};

const workspaceOptions = [
  { value: "", label: "添加到多维表格空间，团队协作更高效" },
  { value: "official", label: "官方提效工具推荐" },
  { value: "new", label: "新建多维表格空间" },
];

export default function MicroAppAddWorkspaceModal({
  open,
  appName,
  onClose,
}: MicroAppAddWorkspaceModalProps) {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useState("");

  const footer = useMemo(
    () => (
      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-ui-control bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          onClick={onClose}
        >
          {t("settings.microApps.actions.confirmUse")}
        </button>
      </div>
    ),
    [onClose, t],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      title={t("settings.microApps.detail.modal.title", { name: appName })}
      footer={footer}
      bodyClassName="space-y-3 py-5"
    >
      <div className="space-y-3">
        <div className="relative">
          <Select
            value={workspace}
            onChange={setWorkspace}
            options={workspaceOptions}
          />
          <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-icon-secondary" />
        </div>

        <div className="overflow-hidden rounded-ui-control border border-border bg-surface-primary">
          {workspaceOptions.slice(1).map((option, index) => (
            <button
              key={option.value}
              type="button"
              className={[
                "flex w-full items-center px-4 py-3 text-left text-sm text-text-primary transition-colors hover:bg-surface-secondary",
                index > 0 ? "border-t border-border" : "",
              ].join(" ")}
              onClick={() => setWorkspace(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
