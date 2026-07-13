import { SegmentedControl } from "../../../components/SegmentedControl";
import { titleCase } from "../../../lib/utils";

const STATE_MODE_COPY: Record<string, string> = {
  isolated: "Separate config, history, and extensions for this profile.",
  shared: "Keep the normal tool config and history while switching credentials only.",
};

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
    const selectedOption = options.find((option) => option === value) ?? options[0];
    const copy =
      STATE_MODE_COPY[selectedOption] ??
      "Use the runtime-supported state handling for this profile.";
    return (
      <fieldset className="state-mode-field state-mode-field-compact">
        <legend>State mode</legend>
        <SegmentedControl
          ariaLabel="State mode"
          options={options.map((option) => ({
            value: option,
            label: titleCase(option),
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
          const copy = STATE_MODE_COPY[option] ?? "Use the runtime-supported state handling for this profile.";
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
                <span className="state-mode-label">{titleCase(option)}</span>
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
