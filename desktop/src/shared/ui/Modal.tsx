import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button, IconButton } from "./Button";

export interface ModalShowOptions {
  title?: ReactNode;
  content: ReactNode;
  footer?: ReactNode | null;
  width?: number | string;
  height?: number | string;
  maxHeight?: number | string;
  closable?: boolean;
  maskClosable?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
}

interface ModalItem extends ModalShowOptions {
  key: string;
}

interface ModalContextValue {
  show: (options: ModalShowOptions) => string;
  close: (key?: string) => void;
  destroy: () => void;
}

interface ModalShellProps {
  open: boolean;
  title?: ReactNode;
  width?: number | string;
  height?: number | string;
  maxHeight?: number | string;
  closable?: boolean;
  maskClosable?: boolean;
  showCloseButton?: boolean;
  footer?: ReactNode | null;
  children: ReactNode;
  onClose: () => void;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

let globalModalApi: ModalContextValue | undefined;

const resolveWidthStyle = (width?: number | string) => {
  if (typeof width === "number") {
    return `${width}px`;
  }

  return width ?? "560px";
};

const resolveSizeStyle = (value?: number | string) => {
  if (typeof value === "number") {
    return `${value}px`;
  }

  return value;
};

export const ModalShell: React.FC<ModalShellProps> = ({
  open,
  title,
  width,
  height,
  maxHeight,
  closable = true,
  maskClosable = true,
  showCloseButton = true,
  footer,
  children,
  onClose,
}) => {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="关闭弹窗"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={() => {
          if (maskClosable && closable) {
            onClose();
          }
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        className="relative z-[101] flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-shadow-xl animate-in fade-in duration-200"
        style={{
          maxWidth: resolveWidthStyle(width),
          height: resolveSizeStyle(height),
          maxHeight: resolveSizeStyle(maxHeight) ?? "calc(100vh - 2rem)",
        }}
      >
        {(title || showCloseButton) && (
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              {title ? (
                <div className="text-sm font-semibold text-text-primary">
                  {title}
                </div>
              ) : null}
            </div>
            {showCloseButton && closable ? (
              <IconButton ariaLabel="关闭弹窗" onClick={onClose} className="h-8 w-8">
                <X className="h-4 w-4" />
              </IconButton>
            ) : null}
          </header>
        )}

        <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm text-text-primary">
          {children}
        </div>

        {footer !== null ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
            {footer ?? (
              <Button variant="secondary" onClick={onClose}>
                关闭
              </Button>
            )}
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  );
};

export const ModalProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [modals, setModals] = useState<ModalItem[]>([]);
  const keyRef = useRef(0);

  const close = useCallback((key?: string) => {
    setModals((prev) => {
      if (prev.length === 0) {
        return prev;
      }

      const targetKey = key ?? prev[prev.length - 1]?.key;
      const target = prev.find((item) => item.key === targetKey);
      target?.onClose?.();

      return prev.filter((item) => item.key !== targetKey);
    });
  }, []);

  const destroy = useCallback(() => {
    setModals((prev) => {
      prev.forEach((item) => item.onClose?.());
      return [];
    });
  }, []);

  const show = useCallback((options: ModalShowOptions) => {
    const key = `modal_${keyRef.current++}`;
    setModals((prev) => [...prev, { key, ...options }]);
    return key;
  }, []);

  useEffect(() => {
    if (modals.length === 0) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      const topModal = modals[modals.length - 1];
      if (topModal?.closable !== false) {
        close(topModal.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, modals]);

  const api = useMemo<ModalContextValue>(
    () => ({
      show,
      close,
      destroy,
    }),
    [show, close, destroy],
  );

  globalModalApi = api;

  return (
    <ModalContext.Provider value={api}>
      {children}
      {modals.map((modal) => (
        <ModalShell
          key={modal.key}
          open
          title={modal.title}
          width={modal.width}
          height={modal.height}
          maxHeight={modal.maxHeight}
          closable={modal.closable}
          maskClosable={modal.maskClosable}
          showCloseButton={modal.showCloseButton}
          footer={modal.footer}
          onClose={() => close(modal.key)}
        >
          {modal.content}
        </ModalShell>
      ))}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);

  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }

  return context;
};

const createModalStaticApi = (): ModalContextValue => ({
  show: (options) => {
    if (!globalModalApi) {
      throw new Error("ModalProvider is not mounted");
    }

    return globalModalApi.show(options);
  },
  close: (key) => {
    globalModalApi?.close(key);
  },
  destroy: () => {
    globalModalApi?.destroy();
  },
});

export const Modal = Object.assign(ModalShell, createModalStaticApi());
