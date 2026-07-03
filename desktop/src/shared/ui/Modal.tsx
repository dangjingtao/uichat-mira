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
import { useTranslation } from "react-i18next";
import { Button, IconButton } from "./Button";
import ConfirmDialog, { type ConfirmTone } from "./ConfirmDialog";

export interface ModalShowOptions {
  title?: ReactNode;
  content: ReactNode;
  footer?: ReactNode | null;
  width?: number | string;
  height?: number | string;
  maxHeight?: number | string;
  bodyClassName?: string;
  closable?: boolean;
  maskClosable?: boolean;
  showCloseButton?: boolean;
  enableEscapeClose?: boolean;
  onClose?: () => void;
}

export interface ModalConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  width?: number | string;
  loadingText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ModalItem extends ModalShowOptions {
  key: string;
}

interface ModalContextValue {
  show: (options: ModalShowOptions) => string;
  confirm: (options: ModalConfirmOptions) => string;
  close: (key?: string) => void;
  destroy: () => void;
}

interface ModalShellProps {
  open: boolean;
  title?: ReactNode;
  width?: number | string;
  height?: number | string;
  maxHeight?: number | string;
  bodyClassName?: string;
  closable?: boolean;
  maskClosable?: boolean;
  showCloseButton?: boolean;
  enableEscapeClose?: boolean;
  footer?: ReactNode | null;
  children: ReactNode;
  onClose: () => void;
}

interface ConfirmModalContentProps extends ModalConfirmOptions {
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

const ConfirmModalContent: React.FC<ConfirmModalContentProps> = ({
  title,
  description,
  confirmText,
  cancelText,
  loadingText,
  tone,
  onConfirm,
  onCancel,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  return (
    <ConfirmDialog
      title={title}
      description={description}
      confirmText={confirmText}
      cancelText={cancelText}
      loadingText={loadingText}
      errorMessage={errorMessage}
      tone={tone}
      loading={loading}
      onCancel={() => {
        onCancel?.();
        onClose();
      }}
      onConfirm={async () => {
        try {
          setErrorMessage(undefined);
          setLoading(true);
          await onConfirm();
          onClose();
        } catch (error) {
          setErrorMessage(
            error instanceof Error ? error.message : "操作失败，请重试",
          );
        } finally {
          setLoading(false);
        }
      }}
    />
  );
};

export const ModalShell: React.FC<ModalShellProps> = ({
  open,
  title,
  width,
  height,
  maxHeight,
  bodyClassName,
  closable = true,
  maskClosable = true,
  showCloseButton = true,
  enableEscapeClose = true,
  footer,
  children,
  onClose,
}) => {
  const { t } = useTranslation();

  const showTitle = title || showCloseButton;

  useEffect(() => {
    if (!open || !closable || !enableEscapeClose) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closable, enableEscapeClose, onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label={t("ui.modal.closeAria")}
        className="absolute inset-0 bg-black/45 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        onClick={() => {
          if (maskClosable && closable) {
            onClose();
          }
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        className="relative z-[101] flex w-full flex-col overflow-hidden rounded-ui-panel border border-border bg-surface-elevated shadow-shadow-xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200"
        style={{
          maxWidth: resolveWidthStyle(width),
          height: resolveSizeStyle(height),
          maxHeight: resolveSizeStyle(maxHeight) ?? "calc(100vh - 2rem)",
        }}
      >
        {showTitle && (
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-2.5">
            <div className={`min-w-0 flex-1`}>
              {title ? (
                <div className="text-[15px] leading-8 font-semibold text-text-primary">
                  {title}
                </div>
              ) : null}
            </div>
            {showCloseButton && closable ? (
              <IconButton
                ariaLabel={t("ui.modal.closeAria")}
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </IconButton>
            ) : null}
          </header>
        )}

        <div
          data-scroll-container="true"
          className={`stable-scrollbar min-h-0 flex-1 overflow-y-auto px-4 ${title ? "py-4" : "py-3"} text-sm text-text-primary ${bodyClassName ?? ""}`}
        >
          {children}
        </div>

        {footer !== null ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
            {footer ?? (
              <Button variant="secondary" onClick={onClose}>
                {t("common.actions.close")}
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

  const confirm = useCallback(
    (options: ModalConfirmOptions) => {
      const key = `modal_${keyRef.current++}`;
      setModals((prev) => [
        ...prev,
        {
          key,
          title: undefined,
          width: options.width ?? 440,
          maskClosable: false,
          showCloseButton: false,
          footer: null,
          content: (
            <ConfirmModalContent {...options} onClose={() => close(key)} />
          ),
        },
      ]);
      return key;
    },
    [close],
  );

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
      confirm,
      close,
      destroy,
    }),
    [show, confirm, close, destroy],
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
          bodyClassName={modal.bodyClassName}
          closable={modal.closable}
          maskClosable={modal.maskClosable}
          showCloseButton={modal.showCloseButton}
          enableEscapeClose={false}
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
  confirm: (options) => {
    if (!globalModalApi) {
      throw new Error("ModalProvider is not mounted");
    }

    return globalModalApi.confirm(options);
  },
  close: (key) => {
    globalModalApi?.close(key);
  },
  destroy: () => {
    globalModalApi?.destroy();
  },
});

export const Modal = Object.assign(ModalShell, createModalStaticApi());
