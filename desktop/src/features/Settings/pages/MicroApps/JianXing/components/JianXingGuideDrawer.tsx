import { BookOpen, CheckCircle2, KeyRound, MousePointer2, Puzzle, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Drawer } from "@/shared/ui";

type GuideSectionProps = {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
};

function GuideSection({ icon, title, children }: GuideSectionProps) {
  return (
    <section className="border-b border-border pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
        {icon}
        <h3>{title}</h3>
      </div>
      <div className="mt-2 text-sm leading-6 text-text-secondary">{children}</div>
    </section>
  );
}

export default function JianXingGuideDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const key = (name: string) => `settings.microApps.jianXing.guide.${name}`;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      closeLabel={t(key("close"))}
      closeMaskLabel={t(key("close"))}
      header={
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <BookOpen className="h-4 w-4 text-icon-secondary" />
            <h2>{t(key("title"))}</h2>
          </div>
          <p className="text-sm leading-6 text-text-secondary">{t(key("intro"))}</p>
        </div>
      }
      footer={<Button size="sm" variant="secondary" onClick={onClose}>{t(key("footerClose"))}</Button>}
    >
      <div className="space-y-4">
        <GuideSection icon={<Puzzle className="h-4 w-4 text-icon-secondary" />} title={t(key("extensionTitle"))}>
          {t(key("extensionBody"))}
        </GuideSection>
        <GuideSection icon={<Wrench className="h-4 w-4 text-icon-secondary" />} title={t(key("nativeTitle"))}>
          {t(key("nativeBody"))}
        </GuideSection>
        <GuideSection icon={<KeyRound className="h-4 w-4 text-icon-secondary" />} title={t(key("authTitle"))}>
          {t(key("authBody"))}
        </GuideSection>
        <GuideSection icon={<CheckCircle2 className="h-4 w-4 text-icon-secondary" />} title={t(key("connectionTitle"))}>
          {t(key("connectionBody"))}
        </GuideSection>
        <GuideSection icon={<MousePointer2 className="h-4 w-4 text-icon-secondary" />} title={t(key("usageTitle"))}>
          {t(key("usageBody"))}
        </GuideSection>
      </div>
    </Drawer>
  );
}
