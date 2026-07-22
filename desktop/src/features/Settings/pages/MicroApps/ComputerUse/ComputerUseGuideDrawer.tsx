import { BookOpen, CircleAlert, Cog, PlayCircle, ShieldCheck } from "lucide-react";
import Drawer from "@/shared/ui/Drawer";

export type ComputerUseGuideLabels = {
  brandName: string;
  title: string;
  intro: string;
  capabilityTitle: string;
  capabilityBody: string;
  environmentTitle: string;
  environmentBody: string;
  setupTitle: string;
  setupBody: string;
  stepsTitle: string;
  stepsBody: string;
  approvalTitle: string;
  approvalBody: string;
  boundaryTitle: string;
  boundaryBody: string;
  close: string;
};

function GuideSection({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <section className="rounded-ui-control border border-border bg-surface-secondary px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
    </section>
  );
}

export default function ComputerUseGuideDrawer({ open, onClose, labels }: { open: boolean; onClose: () => void; labels: ComputerUseGuideLabels }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      closeLabel={labels.close}
      closeMaskLabel={labels.close}
      header={
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-text-tertiary">{labels.brandName}</div>
          <div className="text-base font-semibold text-text-primary">{labels.title}</div>
          <div className="text-sm leading-6 text-text-secondary">{labels.intro}</div>
        </div>
      }
    >
      <div className="space-y-3">
        <GuideSection icon={<BookOpen className="h-4 w-4 text-icon-secondary" />} title={labels.capabilityTitle} body={labels.capabilityBody} />
        <GuideSection icon={<Cog className="h-4 w-4 text-icon-secondary" />} title={labels.environmentTitle} body={labels.environmentBody} />
        <GuideSection icon={<Cog className="h-4 w-4 text-icon-secondary" />} title={labels.setupTitle} body={labels.setupBody} />
        <GuideSection icon={<PlayCircle className="h-4 w-4 text-icon-secondary" />} title={labels.stepsTitle} body={labels.stepsBody} />
        <GuideSection icon={<ShieldCheck className="h-4 w-4 text-icon-secondary" />} title={labels.approvalTitle} body={labels.approvalBody} />
        <GuideSection icon={<CircleAlert className="h-4 w-4 text-icon-secondary" />} title={labels.boundaryTitle} body={labels.boundaryBody} />
      </div>
    </Drawer>
  );
}
