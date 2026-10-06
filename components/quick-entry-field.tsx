"use client";

import { useState } from "react";

type QuickEntryFieldProps = {
  name: string;
  label: string;
  defaultValue?: string | null;
  options: string[];
  placeholder?: string;
  rows?: number;
  wide?: boolean;
  multi?: boolean;
};

export function QuickEntryField({
  name,
  label,
  defaultValue = "",
  options,
  placeholder,
  rows = 3,
  wide = false,
  multi = false,
}: QuickEntryFieldProps) {
  const [value, setValue] = useState(defaultValue || "");

  function choose(option: string) {
    if (!multi) {
      setValue(option);
      return;
    }

    const parts = value
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.includes(option)) {
      setValue(parts.filter((part) => part !== option).join("; "));
      return;
    }

    setValue([...parts, option].join("; "));
  }

  return (
    <div className={wide ? "field field-wide quick-entry-field" : "field quick-entry-field"}>
      <span>{label}</span>
      <div className="quick-entry-options" aria-label={`${label} quick choices`}>
        {options.map((option) => {
          const selected = multi
            ? value
                .split(";")
                .map((part) => part.trim())
                .includes(option)
            : value === option;

          return (
            <button
              className={selected ? "quick-entry-chip is-selected" : "quick-entry-chip"}
              key={option}
              type="button"
              onClick={() => choose(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
      <textarea
        name={name}
        rows={rows}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
