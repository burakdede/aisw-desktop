import { forwardRef } from "react";

type SearchFieldProps = {
  ariaLabel: string;
  ariaControls?: string;
  ariaActiveDescendant?: string;
  className?: string;
  inputClassName?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    ariaLabel,
    ariaControls,
    ariaActiveDescendant,
    className,
    inputClassName,
    placeholder,
    value,
    onChange,
  },
  ref,
) {
  return (
    <div className={className ?? "search-field"}>
      <span className="search-field-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.25" />
          <path d="M10.25 10.25L13.25 13.25" />
        </svg>
      </span>
      <input
        ref={ref}
        type="search"
        className={inputClassName ?? "search-field-input"}
        aria-label={ariaLabel}
        aria-controls={ariaControls}
        aria-activedescendant={ariaActiveDescendant}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          className="search-field-clear"
          type="button"
          aria-label={`Clear ${ariaLabel}`}
          onClick={() => onChange("")}
        >
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M5 5L11 11" />
            <path d="M11 5L5 11" />
          </svg>
        </button>
      ) : null}
    </div>
  );
});
