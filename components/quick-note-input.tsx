"use client";

import { useState } from "react";

type QuickNoteInputProps = {
  name: string;
  required?: boolean;
  placeholder?: string;
  options: string[];
};

export function QuickNoteInput({
  name,
  required = false,
  placeholder,
  options,
}: QuickNoteInputProps) {
  const [value, setValue] = useState("");

  return (
    <div className="quick-note-input">
      <div className="quick-note-options">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? "quick-note-chip is-selected" : "quick-note-chip"}
            onClick={() => setValue(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <input
        name={name}
        required={required}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
