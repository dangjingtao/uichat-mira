import Divider from "@/shared/ui/Divider";
export default function Header({
  miniTitle,
  title,
  description,
  slot,
}: {
  miniTitle: string;
  title: string;
  description: string;
  slot?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 space-y-2 pt-6 bg-white">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
        {miniTitle}
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-text-primary">{title}</h3>
        <div className="w-full flex items-center gap-4">
          <p className="max-w-2xl text-sm leading-6 text-text-secondary">
            {description}
          </p>
          <div className="pt-2 ml-auto">{slot}</div>
        </div>
      </div>
      <Divider />
    </div>
  );
}
