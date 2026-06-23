import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./Button";

type DrawerWidth = number | string;

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  width?: DrawerWidth;
  closeLabel?: string;
  closeMaskLabel?: string;
  bodyClassName?: string;
  panelClassName?: string;
  showCloseButton?: boolean;
}

const exitDurationMs = 280;
const enterFrameDelayMs = 32;

const resolveWidth = (width: DrawerWidth) =>
  typeof width === "number" ? `${width}px` : width;

function Drawer({
  open,
  onClose,
  children,
  header,
  footer,
  width = 560,
  closeLabel,
  closeMaskLabel,
  bodyClassName = "",
  panelClassName = "",
  showCloseButton = true,
}: DrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const timer = window.setTimeout(() => {
        setVisible(true);
      }, enterFrameDelayMs);

      return () => window.clearTimeout(timer);
    }

    setVisible(false);
    const timer = window.setTimeout(() => {
      setMounted(false);
    }, exitDurationMs);

    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label={closeMaskLabel ?? closeLabel ?? "Close drawer"}
        className={`absolute inset-0 transition-[opacity,backdrop-filter] duration-300 ease-out ${
          visible
            ? "bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_0%,rgba(15,23,42,0.28)_40%,rgba(15,23,42,0.5)_100%)] opacity-100 backdrop-blur-[1px]"
            : "opacity-0 backdrop-blur-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-full flex-col border-l border-border bg-surface-primary shadow-shadow-xl will-change-transform transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          visible ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0"
        } ${panelClassName}`}
        style={{ width: resolveWidth(width) }}
      >
        {header || showCloseButton ? (
          <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
            <div className="min-w-0 flex-1">{header}</div>
            {showCloseButton ? (
              <IconButton ariaLabel={closeLabel} onClick={onClose}>
                <X className="h-4 w-4" />
              </IconButton>
            ) : null}
          </header>
        ) : null}

        <div
          className={`stable-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 ${bodyClassName}`}
        >
          {children}
        </div>

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}

export default Drawer;
