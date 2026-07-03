import React, { useId, useState } from "react";
import Tag from "./Tag";

interface TagInputProps {
  label?: string;
  labelHelp?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  placeholder?: string;
  disabled?: boolean;
}

export default function TagInput({
  label,
  labelHelp,
  value,
  onChange,
  maxTags = 3,
  placeholder,
  disabled = false,
}: TagInputProps) {
  const id = useId();
  const [inputValue, setInputValue] = useState("");

  const addTag = (raw: string) => {
    const next = raw.trim();
    if (!next || value.length >= maxTags) {
      return;
    }

    if (value.some((tag) => tag.toLowerCase() === next.toLowerCase())) {
      setInputValue("");
      return;
    }

    onChange([...value, next]);
    setInputValue("");
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag(inputValue);
    } else if (
      event.key === "Backspace" &&
      inputValue === "" &&
      value.length > 0
    ) {
      onChange(value.slice(0, -1));
    }
  };

  const isFull = value.length >= maxTags;

  return (
    <div className="space-y-2">
      {label ? (
        <label
          htmlFor={id}
          className="flex h-5 items-center gap-1.5 text-xs font-medium text-text-secondary"
        >
          <span>{label}</span>
          {labelHelp ? (
            <span className="text-text-tertiary" title={labelHelp}>
              ({labelHelp})
            </span>
          ) : null}
          <span className="text-text-tertiary">
            {value.length}/{maxTags}
          </span>
        </label>
      ) : null}

      <div
        className={`flex min-h-[32px] flex-wrap items-center gap-1.5 rounded-ui-control border bg-surface-primary px-2 py-1 transition-[background-color,border-color,box-shadow] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
          disabled
            ? "cursor-not-allowed border-border bg-surface-secondary"
            : "border-border"
        }`}
      >
        {value.map((tag, index) => (
          <Tag
            key={`${tag}-${index}`}
            label={tag}
            onRemove={disabled ? undefined : () => removeTag(index)}
          />
        ))}

        {!isFull && !disabled ? (
          <input
            id={id}
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => addTag(inputValue)}
            placeholder={placeholder}
            className="min-w-[80px] flex-1 bg-transparent py-0.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
        ) : null}
      </div>
    </div>
  );
}
