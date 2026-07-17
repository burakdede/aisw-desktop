import type { ReactNode } from "react";
import { cn } from "../lib/utils";

type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

type SegmentedControlKind = "buttons" | "tabs";

type SegmentedControlSemantics = {
  listRole?: "tablist";
  itemRole?: "tab";
  selected: boolean;
};

function buildSegmentedControlSemantics(
  kind: SegmentedControlKind,
  value: string,
  optionValue: string,
): SegmentedControlSemantics {
  const selected = value === optionValue;
  if (kind === "tabs") {
    return {
      listRole: "tablist",
      itemRole: "tab",
      selected,
    };
  }

  return {
    selected,
  };
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  className,
  kind = "buttons",
}: {
  ariaLabel: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  kind?: SegmentedControlKind;
}) {
  const listSemantics = buildSegmentedControlSemantics(kind, value, value);

  return (
    <div
      className={cn("segmented-control", className)}
      role={listSemantics.listRole}
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const itemSemantics = buildSegmentedControlSemantics(
          kind,
          value,
          option.value,
        );

        return (
          <button
            key={option.value}
            type="button"
            role={itemSemantics.itemRole}
            className={cn(
              "segmented-control-button",
              itemSemantics.selected && "segmented-control-button-active",
            )}
            aria-selected={itemSemantics.itemRole ? itemSemantics.selected : undefined}
            aria-pressed={itemSemantics.selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
