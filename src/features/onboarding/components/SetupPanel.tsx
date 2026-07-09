import { FormEvent, useMemo, useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import { AppSnapshot, InitReport } from "../../../lib/schemas";
import { useDesktopActions } from "../../shared/useDesktopActions";

type LiveAccount = {
  tool: string;
  outcome?: string;
  auth_method?: string;
  matched_profile?: string | null;
};

export function SetupPanel({
  snapshot,
  initReport,
}: {
  snapshot: AppSnapshot;
  initReport: InitReport | undefined;
}) {
  const { initMutation, addProfileMutation } = useDesktopActions();
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});

  const totalProfiles = useMemo(
    () =>
      Object.values(snapshot.profiles).reduce(
        (sum, entry) => sum + entry.profiles.length,
        0,
      ),
    [snapshot.profiles],
  );
  const liveAccounts = readLiveAccounts(initReport);

  function submitImport(event: FormEvent<HTMLFormElement>, tool: string) {
    event.preventDefault();
    const value = profileNames[tool]?.trim();
    if (!value) return;
    addProfileMutation.mutate({
      tool,
      profile: value,
      label: null,
      stateMode: tool === "gemini" ? null : "isolated",
      importMode: { kind: "from_live" },
    });
  }

  if (totalProfiles > 0 && !liveAccounts.length) {
    return null;
  }

  return (
    <SectionCard
      title="First-run setup"
      kicker="Onboarding"
      actions={
        <button className="primary-button" onClick={() => initMutation.mutate()}>
          {initMutation.isPending ? "Scanning…" : "Run setup scan"}
        </button>
      }
    >
      <p className="inline-note">
        Initialize `aisw`, detect live accounts, and import the identities already
        present on this machine without editing provider files directly.
      </p>
      <div className="stack-list">
        {liveAccounts.map((account) => (
          <form
            key={account.tool}
            className="list-row list-row-form"
            onSubmit={(event) => submitImport(event, account.tool)}
          >
            <div>
              <strong>{account.tool}</strong>
              <p>
                {account.outcome ?? "unknown"} · {account.auth_method ?? "unknown"}
                {account.matched_profile ? ` · matches ${account.matched_profile}` : ""}
              </p>
            </div>
            <div className="inline-form">
              <input
                aria-label={`${account.tool} profile name`}
                placeholder="profile name"
                value={profileNames[account.tool] ?? ""}
                onChange={(event) =>
                  setProfileNames((current) => ({
                    ...current,
                    [account.tool]: event.target.value,
                  }))
                }
              />
              <button className="ghost-button" type="submit">
                Import current login
              </button>
            </div>
          </form>
        ))}
        {!liveAccounts.length ? (
          <p className="inline-note">
            Run the setup scan to detect live Claude, Codex, and Gemini accounts.
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}

function readLiveAccounts(initReport: InitReport | undefined): LiveAccount[] {
  const result = initReport?.result as { live_accounts?: unknown } | undefined;
  const accounts = result?.live_accounts;
  return Array.isArray(accounts) ? (accounts as LiveAccount[]) : [];
}
