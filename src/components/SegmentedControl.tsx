import type { ReactNode } from "react";
import { cn } from "../lib/utils";

type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  className,
  kind = "buttons",
}: {
  ariaLabel: string;
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  kind?: "buttons" | "tabs";
}) {
  return (
    <div
      className={cn("segmented-control", className)}
      role={kind === "tabs" ? "tablist" : undefined}
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role={kind === "tabs" ? "tab" : undefined}
          className={cn(
            "segmented-control-button",
            value === option.value && "segmented-control-button-active",
          )}
          aria-selected={kind === "tabs" ? value === option.value : undefined}
          aria-pressed={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
