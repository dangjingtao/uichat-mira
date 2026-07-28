import type { ReactNode } from "react";

export function WidgetGrid({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 items-stretch grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-[320px_auto]">{children}</div>;
}
