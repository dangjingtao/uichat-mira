interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  size?: "sm" | "md";
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  size = "md",
}: SwitchProps) {
  const sizeClasses =
    size === "sm"
      ? {
          track: "h-5 w-9",
          thumb: checked
            ? "h-4 w-4 translate-x-4"
            : "h-4 w-4 translate-x-0.5",
        }
      : {
          track: "h-6 w-11",
          thumb: checked ? "h-5 w-5 translate-x-5" : "h-5 w-5 translate-x-0.5",
        };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex items-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-surface-tertiary"
      } ${sizeClasses.track}`}
    >
      <span
        className={`inline-block rounded-full bg-white shadow-shadow-sm transition-transform duration-150 ${sizeClasses.thumb}`}
      />
    </button>
  );
}

export default Switch;
