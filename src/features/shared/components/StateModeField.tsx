import { SegmentedControl } from "../../../components/SegmentedControl";
import { resolveSelectionValue } from "../../../lib/utils";
import { stateModeDescription, stateModeLabel } from "../state-modes";

export function StateModeField({
  name,
  value,
  options,
  onChange,
  variant = "cards",
}: {
  name: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  variant?: "cards" | "compact";
}) {
  if (variant === "compact") {
    const selectedOption = resolveSelectionValue(value, options, (option) => option) ?? "";
    const copy = stateModeDescription(selectedOption);
    return (
      <fieldset className="state-mode-field state-mode-field-compact">
        <legend>State mode</legend>
        <SegmentedControl
          ariaLabel="State mode"
          options={options.map((option) => ({
            value: option,
            label: stateModeLabel(option),
          }))}
          value={selectedOption}
          onChange={onChange}
        />
        <p className="state-mode-copy">{copy}</p>
      </fieldset>
    );
  }

  return (
    <fieldset className="state-mode-field">
        <legend>State mode</legend>
        <div className="state-mode-options">
          {options.map((option) => {
          const copy = stateModeDescription(option);
          const descriptionId = `${name}-${option}-description`;
          return (
            <div
              key={option}
              className={`state-mode-option ${value === option ? "state-mode-option-active" : ""}`}
            >
              <label className="state-mode-choice">
                <input
                  type="radio"
                  name={name}
                  value={option}
                  checked={value === option}
                  aria-describedby={descriptionId}
                  onChange={(event) => onChange(event.target.value)}
                />
                <span className="state-mode-label">{stateModeLabel(option)}</span>
              </label>
              <span id={descriptionId} className="state-mode-copy">
                {copy}
              </span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
