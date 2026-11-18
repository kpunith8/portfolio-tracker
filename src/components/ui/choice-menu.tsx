"use client";

import { useEffect, useId, type RefObject } from "react";
import { ChevronDown } from "lucide-react";

/** Styled choice menu shared by dashboard forms and report dialogs. */
export function ChoiceMenu<T extends string | number>({
  menuRef,
  label,
  labelledBy,
  value,
  valueLabel,
  options,
  onChange,
  className = "",
}: {
  menuRef: RefObject<HTMLDetailsElement | null>;
  label?: string;
  labelledBy?: string;
  value: T;
  valueLabel: string;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const valueId = useId();

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
      }
    }

    document.addEventListener("pointerdown", dismiss);

    return () => document.removeEventListener("pointerdown", dismiss);
  }, [menuRef]);

  const close = () => {
    if (menuRef.current) {
      menuRef.current.open = false;
      menuRef.current.querySelector("summary")?.focus();
    }
  };

  return (
    <details
      className={`investment-select ${className}`.trim()}
      ref={menuRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          event.currentTarget.open = false;
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuRef.current?.open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <summary
        aria-label={label}
        aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
      >
        <span id={valueId}>{valueLabel}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="investment-select-options">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            aria-pressed={option.value === value}
            onClick={() => {
              onChange(option.value);
              close();
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </details>
  );
}
