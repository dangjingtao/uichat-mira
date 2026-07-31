import type { ReactNode } from "react";

export function WidgetGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 md:grid-cols-[minmax(250px,0.9fr)_minmax(0,2fr)] md:grid-rows-[324px_166px]">
      {children}
    </div>
  );
}
