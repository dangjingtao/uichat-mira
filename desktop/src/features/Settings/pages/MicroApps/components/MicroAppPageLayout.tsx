import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Divider from "@/shared/ui/Divider";

export interface MicroAppPageLayoutProps {
  miniTitle: string;
  title: string;
  description?: string;
  slot?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  contentClassName?: string;
  containerClassName?: string;
  scrollBody?: boolean;
  enableSticky?: boolean;
}

export default function MicroAppPageLayout({
  miniTitle: _miniTitle,
  title,
  description,
  slot,
  children,
  className = "",
  bodyClassName = "",
  contentClassName = "",
  containerClassName = "",
  scrollBody = true,
  enableSticky = false,
}: MicroAppPageLayoutProps) {
  const containerClasses = ["mx-auto w-full max-w-[1180px]", containerClassName]
    .filter(Boolean)
    .join(" ");

  const handleBack = () => {
    globalThis.location.hash = "/settings/micro-apps";
  };

  return (
    <div
      className={`mx-auto flex h-full min-h-0 w-full flex-col ${enableSticky ? "overflow-visible" : "overflow-hidden"} ${className}`}
    >
      <div className={`shrink-0 ${containerClasses}`}>
        <div className="shrink-0 space-y-2 bg-transparent px-2 pt-6">
          <div className="flex w-full items-end gap-3 sm:gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Back to micro apps"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-ui-control text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <ArrowLeft className="h-4.5 w-4.5" />
                </button>
                <h3 className="font-serif text-xl font-semibold text-text-primary">{title}</h3>
              </div>
              {description ? (
                <p className="max-w-2xl text-sm leading-6 text-text-secondary">
                  {description}
                </p>
              ) : null}
            </div>
            {slot ? <div className="shrink-0 self-end sm:ml-auto">{slot}</div> : null}
          </div>
          <Divider />
        </div>
      </div>

      <div
        className={[
          "min-h-0 flex-1",
          scrollBody ? "stable-scrollbar overflow-y-auto" : "",
          bodyClassName,
        ].join(" ")}
      >
        <div
          className={`flex h-full min-h-0 flex-col px-2 pb-6 ${containerClasses} ${contentClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
