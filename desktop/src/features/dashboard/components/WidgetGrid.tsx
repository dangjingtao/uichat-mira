import type { ReactNode } from "react";

export function WidgetGrid({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
