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
    <div className="shrink-0 space-y-2 bg-transparent pt-6">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
        {miniTitle}
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-text-primary">{title}</h3>
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
          <p className="max-w-2xl flex-1 text-sm leading-6 text-text-secondary">
            {description}
          </p>
          {slot ? <div className="pt-1 lg:ml-auto lg:pt-2">{slot}</div> : null}
        </div>
      </div>
      <Divider />
    </div>
  );
}
