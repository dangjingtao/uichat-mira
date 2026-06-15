import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, CircleHelp } from "lucide-react";
import Tooltip from "./Tooltip";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  error?: string;
  compact?: boolean;
  labelHelp?: string;
}

const inputBaseClassName = `
  w-full
  rounded-lg
  border
  border-border
  bg-surface-primary
  px-3.5
  text-sm
  text-text-primary
  shadow-shadow-sm
  transition-[background-color,border-color,box-shadow]
  duration-150
  ease-out
  placeholder:text-text-tertiary
  focus:outline-none
  focus:ring-2
  focus:ring-primary/20
  focus:border-primary
  disabled:cursor-not-allowed
  disabled:bg-surface-secondary
  disabled:text-text-tertiary
`;

const getInputSizeClassName = (compact?: boolean) =>
  compact ? "h-8 px-2.5 py-1.5 text-[13px]" : "h-10 px-3.5 text-sm";

const InputWrapper: React.FC<{
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  error?: string;
  inputId: string;
  describedById?: string;
  compact?: boolean;
  labelHelp?: string;
}> = ({
  label,
  children,
  disabled,
  error,
  inputId,
  describedById,
  compact = false,
  labelHelp,
}) => (
  <div className={compact ? "space-y-1" : "space-y-2"}>
    <label
      htmlFor={inputId}
      className={`flex h-5 items-center gap-1.5 text-xs font-medium ${disabled ? "text-text-tertiary" : "text-text-secondary"}`}
    >
      <span>{label}</span>
      {labelHelp ? (
        <Tooltip text={labelHelp} placement="top">
          <span className="text-icon-secondary">
            <CircleHelp className="h-3.5 w-3.5" />
          </span>
        </Tooltip>
      ) : null}
    </label>
    {children}
    {error ? (
      <span id={describedById} className="text-xs text-danger">
        {error}
      </span>
    ) : null}
  </div>
);

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  disabled,
  error,
  compact,
  labelHelp,
}) => {
  const inputId = useId();
  const describedById = error ? `${inputId}-error` : undefined;
  const listboxId = `${inputId}-listbox`;
  const selectRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [listMaxHeight, setListMaxHeight] = useState(256);

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
  const selectedLabel = selectedOption?.label ?? "请选择";

  const updateDropdownLayout = React.useCallback(() => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) {
      return;
    }

    const closestScrollableAncestor = triggerRef.current?.closest<HTMLElement>(
      "[data-scroll-container='true']",
    );

    const viewportBounds = closestScrollableAncestor?.getBoundingClientRect() ?? {
      top: 8,
      bottom: window.innerHeight - 8,
    };

    const margin = 8;
    const preferredMaxHeight = 256;
    const availableBelow = Math.max(
      0,
      Math.floor(viewportBounds.bottom - triggerRect.bottom - margin),
    );
    const availableAbove = Math.max(
      0,
      Math.floor(triggerRect.top - viewportBounds.top - margin),
    );
    const shouldDropUp =
      availableBelow < preferredMaxHeight && availableAbove > availableBelow;
    const nextMaxHeight = Math.max(
      96,
      Math.min(preferredMaxHeight, shouldDropUp ? availableAbove : availableBelow),
    );

    setDropUp(shouldDropUp);
    setListMaxHeight(nextMaxHeight);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!selectRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Tab") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    updateDropdownLayout();

    const handleReposition = () => {
      updateDropdownLayout();
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    requestAnimationFrame(() => {
      optionRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
      });
    });

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, selectedIndex, updateDropdownLayout]);

  const selectOption = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <InputWrapper
      label={label}
      disabled={disabled}
      error={error}
      inputId={inputId}
      describedById={describedById}
      compact={compact}
      labelHelp={labelHelp}
    >
      <div ref={selectRef} className="relative">
        <button
          id={inputId}
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedById}
          aria-controls={open ? listboxId : undefined}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (disabled) {
              return;
            }

            if (
              event.key === "ArrowDown" ||
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className={`
            cursor-pointer
            text-left
            pr-10
            ${inputBaseClassName}
            ${getInputSizeClassName(compact)}
            ${error ? "border-danger" : ""}
          `}
        >
          <span className="block truncate">{selectedLabel}</span>
        </button>
        <ChevronDown
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-icon-secondary transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />

        {open && !disabled ? (
          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={inputId}
            style={{ maxHeight: `${listMaxHeight}px` }}
            className={`
              absolute
              left-0
              z-30
              w-full
              overflow-y-auto
              rounded-lg
              border
              border-border
              bg-surface-elevated
              p-1
              shadow-shadow-lg
              outline-none
              ${dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"}
            `}
          >
            {options.length > 0 ? (
              options.map((opt, index) => {
                const selected = opt.value === value;

                return (
                  <button
                    key={opt.value}
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectOption(opt.value)}
                    className={`
                      flex
                      w-full
                      items-center
                      gap-2
                      rounded-md
                      px-2.5
                      py-2
                      text-left
                      text-sm
                      transition-colors
                      duration-150
                      focus:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-primary/20
                      ${
                        selected
                          ? "bg-primary/10 text-primary"
                          : "text-text-primary hover:bg-surface-secondary"
                      }
                    `}
                  >
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    {selected ? <Check className="h-4 w-4 flex-shrink-0" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="px-2.5 py-2 text-sm text-text-tertiary">暂无选项</div>
            )}
          </div>
        ) : null}
      </div>
    </InputWrapper>
  );
};

export const SelectInput = Select;

export default Select;
