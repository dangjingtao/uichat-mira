import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

export type ConfirmTone = "default" | "warning" | "danger";

export interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loadingText?: string;
  errorMessage?: string;
  tone?: ConfirmTone;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

const toneStyles: Record<
  ConfirmTone,
  {
    iconClassName: string;
    badgeClassName: string;
    confirmVariant: "secondary" | "danger";
  }
> = {
  default: {
    iconClassName: "text-primary",
    badgeClassName: "bg-primary/10",
    confirmVariant: "secondary",
  },
  warning: {
    iconClassName: "text-warning",
    badgeClassName: "bg-warning-soft",
    confirmVariant: "danger",
  },
  danger: {
    iconClassName: "text-danger",
    badgeClassName: "bg-danger-soft",
    confirmVariant: "danger",
  },
};

export default function ConfirmDialog({
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  loadingText,
  errorMessage,
  tone = "danger",
  onCancel,
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const styles = toneStyles[tone];

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 mt-2">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-ui-control ${styles.badgeClassName}`}
        >
          <AlertTriangle className={`h-4 w-4 ${styles.iconClassName}`} />
        </div>

        <div className="min-w-0 space-y-1">
          <div className="text-[15px] font-semibold leading-6 text-text-primary">
            {title}
          </div>
          <p className="text-sm leading-6 text-text-secondary">{description}</p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-ui-control border border-danger-border bg-danger-soft px-3 py-2 text-sm leading-6 text-danger-text">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          size="sm"
          variant={styles.confirmVariant}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? (loadingText ?? confirmText) : confirmText}
        </Button>
      </div>
    </div>
  );
}
