import React from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "success-ghost"
  | "info-ghost"
  | "danger"
  | "danger-ghost"
  | "danger-outline"
  | "link";

export type ButtonSize = "xs" | "sm" | "md" | "lg";
export type LegacyButtonSize =
  | ButtonSize
  | "small"
  | "medium"
  | "large";

const normalizeButtonSize = (size: LegacyButtonSize): ButtonSize => {
  if (size === "small") return "sm";
  if (size === "medium") return "md";
  if (size === "large") return "lg";
  return size;
};

const buttonBaseClassName = `
  inline-flex
  items-center
  justify-center
  gap-2
  whitespace-nowrap
  rounded-ui-control
  border
  font-medium
  transition-all
  duration-150
  ease-out
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-primary/20
  focus-visible:ring-offset-2
  focus-visible:ring-offset-surface-primary
  disabled:cursor-not-allowed
  disabled:opacity-50
`;

const buttonSizeClassNames: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs",
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

const buttonVariantClassNames: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-primary text-white shadow-shadow-sm hover:bg-primary-hover active:scale-[0.99]",
  secondary:
    "border-border bg-surface-primary text-text-primary shadow-shadow-sm hover:bg-surface-secondary active:scale-[0.99]",
  outline:
    "border-border bg-transparent text-text-primary hover:bg-surface-secondary active:scale-[0.99]",
  ghost:
    "border-transparent bg-transparent text-text-secondary hover:bg-surface-secondary hover:text-text-primary active:scale-[0.99]",
  "success-ghost":
    "border-transparent bg-transparent text-success-text hover:bg-success-soft hover:text-success-text active:scale-[0.99]",
  "info-ghost":
    "border-transparent bg-transparent text-info-text hover:bg-info-soft hover:text-info-text active:scale-[0.99]",
  danger:
    "border-transparent bg-danger text-white shadow-shadow-sm hover:bg-danger/90 active:scale-[0.99]",
  "danger-ghost":
    "border-transparent bg-transparent text-danger-text hover:bg-danger-soft hover:text-danger-text active:scale-[0.99]",
  "danger-outline":
    "border-danger-border bg-surface-primary text-danger-text hover:bg-danger-soft active:scale-[0.99]",
  link: "h-auto border-transparent bg-transparent px-0 text-text-secondary hover:text-text-primary hover:underline shadow-none",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: LegacyButtonSize;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "secondary",
  size = "md",
  className = "",
  disabled = false,
  type = "button",
  ...buttonProps
}) => {
  const normalizedSize = normalizeButtonSize(size);

  return (
    <button
      type={type}
      disabled={disabled}
      {...buttonProps}
      className={`
        ${buttonBaseClassName}
        ${variant === "link" ? "" : buttonSizeClassNames[normalizedSize]}
        ${buttonVariantClassNames[variant]}
        ${className}
      `}
    >
      {children}
    </button>
  );
};

type IconButtonTone = "default" | "danger" | "primary";
type IconButtonStyle = "ghost" | "outline" | "filled";

interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  size?: LegacyButtonSize;
  tone?: IconButtonTone;
  styleType?: IconButtonStyle;
}

const iconButtonSizeClassNames: Record<ButtonSize, string> = {
  xs: "h-7 w-7",
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

const iconButtonVariantClassNames: Record<
  IconButtonStyle,
  Record<IconButtonTone, string>
> = {
  ghost: {
    default:
      "border-transparent bg-transparent text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
    danger:
      "border-transparent bg-transparent text-danger-text hover:bg-danger-soft hover:text-danger-text",
    primary:
      "border-transparent bg-transparent text-primary hover:bg-primary/10 hover:text-primary",
  },
  outline: {
    default:
      "border-border bg-surface-primary text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
    danger:
      "border-danger-border bg-surface-primary text-danger-text hover:bg-danger-soft hover:text-danger-text",
    primary:
      "border-primary/20 bg-surface-primary text-primary hover:bg-primary/10 hover:text-primary",
  },
  filled: {
    default:
      "border-transparent bg-surface-secondary text-text-primary hover:bg-surface-tertiary",
    danger:
      "border-transparent bg-danger-soft text-danger-text hover:bg-danger-soft/80",
    primary:
      "border-transparent bg-primary/10 text-primary hover:bg-primary/15",
  },
};

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  className = "",
  disabled = false,
  ariaLabel,
  size = "md",
  tone = "default",
  styleType = "ghost",
  type = "button",
  ...buttonProps
}) => {
  const normalizedSize = normalizeButtonSize(size);

  return (
    <button
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      {...buttonProps}
      className={`
        ${buttonBaseClassName}
        ${iconButtonSizeClassNames[normalizedSize]}
        ${iconButtonVariantClassNames[styleType][tone]}
        p-0
        ${className}
      `}
    >
      {children}
    </button>
  );
};
