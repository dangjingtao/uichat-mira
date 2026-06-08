import React from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "small" | "medium" | "large";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

const normalizeButtonSize = (size: ButtonSize): "sm" | "md" | "lg" => {
  if (size === "small") return "sm";
  if (size === "medium") return "md";
  if (size === "large") return "lg";
  return size;
};

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

  const sizeClasses = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-sm",
  };

  const variantClasses = {
    primary:
      "border-transparent bg-primary text-white shadow-shadow-sm hover:bg-primary-hover active:scale-[0.99]",
    secondary:
      "border-border bg-surface-primary text-text-primary shadow-shadow-sm hover:bg-surface-secondary active:scale-[0.99]",
    outline:
      "border-border bg-transparent text-text-primary hover:bg-surface-secondary active:scale-[0.99]",
    ghost:
      "border-transparent bg-transparent text-text-secondary hover:bg-surface-secondary hover:text-text-primary active:scale-[0.99]",
    danger:
      "border-transparent bg-danger text-white shadow-shadow-sm hover:bg-danger/90 active:scale-[0.99]",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      {...buttonProps}
      className={`
        inline-flex
        items-center
        justify-center
        gap-2
        whitespace-nowrap
        rounded-lg
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
        ${sizeClasses[normalizedSize]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </button>
  );
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  className = "",
  disabled = false,
  ariaLabel,
  type = "button",
  ...buttonProps
}) => (
  <button
    type={type}
    disabled={disabled}
    aria-label={ariaLabel}
    {...buttonProps}
    className={`
      inline-flex
      h-9
      w-9
      items-center
      justify-center
      rounded-lg
      border
      border-transparent
      bg-transparent
      text-text-secondary
      transition-all
      duration-150
      ease-out
      hover:bg-surface-secondary
      hover:text-text-primary
      focus-visible:outline-none
      focus-visible:ring-2
      focus-visible:ring-primary/20
      focus-visible:ring-offset-2
      focus-visible:ring-offset-surface-primary
      disabled:cursor-not-allowed
      disabled:opacity-50
      ${className}
    `}
  >
    {children}
  </button>
);
