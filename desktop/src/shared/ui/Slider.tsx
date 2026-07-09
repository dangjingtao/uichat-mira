import React, { useId } from "react";
import { CircleHelp } from "lucide-react";
import Tooltip from "./Tooltip";

type SliderProps = {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  labelHelp?: string;
  valueFormatter?: (value: number) => string;
  compact?: boolean;
  ariaLabel?: string;
};

const formatValue = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");

const trackProgressStyle = (value: number, min: number, max: number) => {
  const ratio = max <= min ? 0 : ((value - min) / (max - min)) * 100;
  const progress = Math.max(0, Math.min(100, ratio));

  return {
    background: `linear-gradient(to right, rgb(var(--color-primary)) 0%, rgb(var(--color-primary)) ${progress}%, rgb(var(--color-border)) ${progress}%, rgb(var(--color-border)) 100%)`,
  };
};

export default function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  labelHelp,
  valueFormatter = formatValue,
  compact = false,
  ariaLabel,
}: SliderProps) {
  const inputId = useId();
  const displayValue = valueFormatter(value);

  return (
    <div className={`w-full ${compact ? "space-y-1.5" : "space-y-2"}`}>
      {label ? (
        <label
          htmlFor={inputId}
          className={`flex items-baseline justify-between gap-3 ${
            disabled ? "text-text-tertiary" : "text-text-secondary"
          }`}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
            <span>{label}</span>
            {labelHelp ? (
              <Tooltip text={labelHelp} placement="top">
                <span className="text-icon-secondary">
                  <CircleHelp className="h-3.5 w-3.5" />
                </span>
              </Tooltip>
            ) : null}
          </span>
          <span className="font-mono text-[11px] text-text-secondary">{displayValue}</span>
        </label>
      ) : null}

      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        style={trackProgressStyle(value, min, max)}
        aria-label={ariaLabel ?? label ?? "slider"}
        className={`claude-range-slider ${compact ? "claude-range-slider-compact" : ""} ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      />
    </div>
  );
}
