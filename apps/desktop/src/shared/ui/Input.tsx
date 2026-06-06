// OpenAI 风格的精致输入框组件

// 基础输入框样式
const inputBaseClass =
  "w-full px-2 py-1.5 bg-transparent border border-gray-200 dark:border-gray-700 rounded-md text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400/50 focus:border-gray-400 dark:focus:border-gray-500";
const inputInteractiveClass =
  "hover:border-gray-300 dark:hover:border-gray-600";
const inputDisabledClass =
  "opacity-50 cursor-not-allowed hover:border-gray-200 dark:hover:border-gray-700";

interface InputWrapperProps {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}

const InputWrapper: React.FC<InputWrapperProps> = ({
  label,
  children,
  disabled,
}) => (
  <div className="space-y-1">
    <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
      {label}
    </label>
    {children}
  </div>
);

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  disabled?: boolean;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  label,
  value,
  onChange,
  step,
  disabled,
}) => {
  const inputClass = disabled
    ? `${inputBaseClass} ${inputDisabledClass}`
    : `${inputBaseClass} ${inputInteractiveClass}`;

  return (
    <InputWrapper label={label} disabled={disabled}>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className={inputClass}
      />
    </InputWrapper>
  );
};

interface SelectInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}

export const SelectInput: React.FC<SelectInputProps> = ({
  label,
  value,
  onChange,
  options,
  disabled,
}) => {
  const inputClass = disabled
    ? `${inputBaseClass} ${inputDisabledClass}`
    : `${inputBaseClass} ${inputInteractiveClass}`;

  return (
    <InputWrapper label={label} disabled={disabled}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputClass}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </InputWrapper>
  );
};
