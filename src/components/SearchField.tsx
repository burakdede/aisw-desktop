import { forwardRef } from "react";
import { SymbolIcon } from "./SymbolIcon";

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
        <SymbolIcon name="search" size="sm" />
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
          <SymbolIcon name="clear" size="sm" />
        </button>
      ) : null}
    </div>
  );
});
