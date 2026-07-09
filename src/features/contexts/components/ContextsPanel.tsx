import { SectionCard } from "../../../components/SectionCard";
import { AppSnapshot } from "../../../lib/schemas";
import { useDesktopActions } from "../../shared/useDesktopActions";

export function ContextsPanel({ snapshot }: { snapshot: AppSnapshot }) {
  const { useContextMutation } = useDesktopActions();

  return (
    <SectionCard title="Contexts" kicker="Work modes">
      <div className="stack-list">
        {snapshot.contexts.map((context) => (
          <article key={context.name} className="list-row">
            <div>
              <strong>{context.name}</strong>
              <p>
                {Object.entries(context.profiles)
                  .map(([tool, profile]) => `${tool}: ${profile ?? "none"}`)
                  .join(" · ")}
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() =>
                useContextMutation.mutate({ context: context.name, stateMode: "isolated" })
              }
            >
              Activate
            </button>
          </article>
        ))}
        {!snapshot.contexts.length ? (
          <p className="inline-note">No contexts are stored yet. Create them in `aisw` or extend the desktop workflow next.</p>
        ) : null}
      </div>
    </SectionCard>
  );
}
