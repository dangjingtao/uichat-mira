import { FilePlus2, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import { Button, Select } from "@/shared/ui";
import type { ComfyUiFlowAsset } from "../model/comfyui-workbench";

interface ComfyUiFlowCardProps {
  flows: ComfyUiFlowAsset[];
  selectedFlowId: string;
  selectedFlow: ComfyUiFlowAsset | null;
  running: boolean;
  onSelectFlow: (id: string) => void;
  onCreateFlow: () => void;
  onEditFlow: () => void;
}

export default function ComfyUiFlowCard({
  flows,
  selectedFlowId,
  selectedFlow,
  running,
  onSelectFlow,
  onCreateFlow,
  onEditFlow,
}: ComfyUiFlowCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-text-primary">
          {t("settings.microApps.imageGenerationStudio.cards.flow.title")}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <Select
          label={t("settings.microApps.imageGenerationStudio.flow.fields.select")}
          value={selectedFlowId}
          onChange={onSelectFlow}
          disabled={running}
          options={[
            {
              value: "",
              label: t(
                "settings.microApps.imageGenerationStudio.flow.placeholders.select",
              ),
            },
            ...flows.map((flow) => ({
              value: flow.id,
              label: flow.name,
            })),
          ]}
        />
        <div className="pt-7">
            <div className="flex flex-wrap gap-3">
              <Button variant="link" onClick={onEditFlow} disabled={running}>
                <Pencil className="h-3.5 w-3.5" />
                {t("settings.microApps.imageGenerationStudio.flow.actions.edit")}
              </Button>
              <Button variant="outline" onClick={onCreateFlow} disabled={running}>
                <FilePlus2 className="h-4 w-4" />
                {t("settings.microApps.imageGenerationStudio.flow.actions.new")}
              </Button>
            </div>
        </div>
      </div>

    </Card>
  );
}
