import React, { useId, useMemo } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import Tooltip from "./Tooltip";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  error?: string;
  compact?: boolean;
  labelHelp?: string;
}

const encodedValuePrefix = "__radix-select__";

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

const encodeValue = (value: string) =>
  `${encodedValuePrefix}${encodeURIComponent(value)}`;

const decodeValue = (value: string) =>
  value.startsWith(encodedValuePrefix)
    ? decodeURIComponent(value.slice(encodedValuePrefix.length))
    : value;

const InputWrapper: React.FC<{
  label?: string;
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
    {label || labelHelp ? (
      <label
        htmlFor={inputId}
        className={`flex h-5 items-center gap-1.5 text-xs font-medium ${disabled ? "text-text-tertiary" : "text-text-secondary"}`}
      >
        {label ? <span>{label}</span> : null}
        {labelHelp ? (
          <Tooltip text={labelHelp} placement="top">
            <span className="text-icon-secondary">
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
          </Tooltip>
        ) : null}
      </label>
    ) : null}
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
  const { t } = useTranslation();
  const inputId = useId();
  const describedById = error ? `${inputId}-error` : undefined;

  const encodedOptions = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        encodedValue: encodeValue(option.value),
      })),
    [options],
  );

  const selectedOption = encodedOptions.find(
    (option) => option.value === value,
  );
  const hasOptions = encodedOptions.length > 0;
  const currentValue = selectedOption?.encodedValue;
  const placeholder =
    options.find((option) => option.value === "")?.label ??
    t("ui.select.empty");

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
      <SelectPrimitive.Root
        value={currentValue}
        onValueChange={(nextValue) => {
          onChange(decodeValue(nextValue));
        }}
        disabled={disabled || !hasOptions}
      >
        <SelectPrimitive.Trigger
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedById}
          className={`
            group
            inline-flex
            w-full
            items-center
            justify-between
            gap-2
            text-left
            ${inputBaseClassName}
            ${getInputSizeClassName(compact)}
            ${error ? "border-danger" : ""}
          `}
        >
          <SelectPrimitive.Value
            placeholder={
              <span className="block truncate text-text-tertiary">
                {hasOptions ? placeholder : t("ui.select.noOptions")}
              </span>
            }
          />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-icon-secondary transition-transform duration-150 group-data-[state=open]:rotate-180" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        {hasOptions ? (
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              position="popper"
              sideOffset={6}
              collisionPadding={8}
              className="
                z-[110]
                max-h-64
                min-w-[var(--radix-select-trigger-width)]
                overflow-hidden
                rounded-lg
                border
                border-border
                bg-surface-elevated
                shadow-shadow-lg
                data-[state=open]:animate-in
                data-[state=closed]:animate-out
                data-[side=bottom]:slide-in-from-top-1
                data-[side=top]:slide-in-from-bottom-1
              "
            >
              <SelectPrimitive.Viewport className="p-1">
                {encodedOptions.map((option) => {
                  const isSelected = option.value === value;

                  return (
                    <SelectPrimitive.Item
                      key={option.encodedValue}
                      value={option.encodedValue}
                      className={`
                        relative
                        flex
                        w-full
                        cursor-default
                        items-center
                        gap-2
                        rounded-md
                        px-2.5
                        py-2
                        pr-8
                        text-left
                        text-sm
                        text-text-primary
                        outline-none
                        transition-colors
                        duration-150
                        data-[highlighted]:bg-primary/10
                        data-[highlighted]:text-text-primary
                        data-[state=checked]:bg-primary/8
                        data-[state=checked]:text-primary
                      `}
                    >
                      <SelectPrimitive.ItemText>
                        {option.label}
                      </SelectPrimitive.ItemText>
                      <SelectPrimitive.ItemIndicator className="absolute right-2.5 inline-flex items-center justify-center">
                        <Check
                          className={`h-4 w-4 ${isSelected ? "text-primary" : "text-text-primary"}`}
                        />
                      </SelectPrimitive.ItemIndicator>
                    </SelectPrimitive.Item>
                  );
                })}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        ) : null}
      </SelectPrimitive.Root>
    </InputWrapper>
  );
};

export const SelectInput = Select;

export default Select;
