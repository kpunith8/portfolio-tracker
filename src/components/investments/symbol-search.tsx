"use client";

import { useEffect, useId, useState } from "react";
import { displayCompanyName } from "../../domain/company-name";
import {
  searchSymbols,
  type SymbolOption,
} from "../../app/dashboard/purchase-actions";

export function SymbolSearch({
  value,
  onChange,
  label,
  invalid = false,
  mutualFund = false,
}: {
  value: string;
  onChange: (text: string, selected?: SymbolOption) => void;
  label: string;
  invalid?: boolean;
  mutualFund?: boolean;
}) {
  const errorId = useId();
  const [options, setOptions] = useState<SymbolOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || value.trim().length < 2) return;

    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      searchSymbols(value)
        .then((result) => {
          if (current) setOptions(result);
        })
        .catch(() => {
          if (current) setOptions([]);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 150);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [value, open]);

  return (
    <div
      className="symbol-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      <input
        aria-label={label}
        required={mutualFund}
        maxLength={mutualFund ? 200 : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        value={value}
        onChange={(e) => {
          setOpen(true);
          setOptions([]);
          onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        placeholder={
          mutualFund ? "Search ticker or fund name" : "Search ticker or company"
        }
      />
      {invalid && (
        <span id={errorId} className="sr-only">
          Select a matching symbol.
        </span>
      )}
      {open && value.trim().length >= 2 && (
        <div className="symbol-results" aria-label="Symbol results">
          {options.map((option) => (
            <button
              type="button"
              key={option.fyersSymbol}
              onClick={() => {
                onChange(option.symbol, option);
                setOpen(false);
                setOptions([]);
              }}
            >
              <strong>
                {option.symbol} · {option.exchange}
                {((option.exchange === "BSE" && option.series === "F") ||
                  (option.series !== "A" &&
                    options.filter(
                      (item) =>
                        item.symbol === option.symbol &&
                        item.exchange === option.exchange,
                    ).length > 1)) &&
                  ` ${option.series || option.fyersSymbol}`}
              </strong>
              <span>{displayCompanyName(option.name)}</span>
            </button>
          ))}
          {!options.length && (
            <span>{loading ? "Searching…" : "Type to search symbols"}</span>
          )}
        </div>
      )}
    </div>
  );
}
