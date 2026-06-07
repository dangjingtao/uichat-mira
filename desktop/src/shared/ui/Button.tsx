// src/components/ui/Button.tsx
import React from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "default" | "small";

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
}

/**
 * 通用按钮组件
 * 支持多种样式变体和尺寸
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = "secondary",
  size = "default",
  className = "",
  disabled = false,
}) => {
  const baseClasses =
    "font-medium rounded-lg transition-colors focus:outline-none";

  const sizeClasses = {
    default: "px-4 py-2 text-sm",
    small: "px-3 py-1.5 text-xs",
  };

  const variantClasses = {
    primary:
      "bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200",
    secondary:
      "bg-white dark:bg-[#242424] text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost:
      "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

interface IconButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * 图标按钮组件
 * 用于操作图标的小按钮，支持禁用状态
 */
export const IconButton: React.FC<IconButtonProps> = ({
  children,
  onClick,
  className = "",
  disabled = false,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`p-1 rounded text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition ${className} ${
      disabled ? "opacity-50 cursor-not-allowed" : ""
    }`}
  >
    {children}
  </button>
);
