import React, { Component, type ErrorInfo, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type FatalPhase = "startup" | "runtime";

type FatalReport = {
  phase: FatalPhase;
  message: string;
  stack?: string;
};

type FatalScreenProps = FatalReport;

type FatalBoundaryProps = {
  children: ReactNode;
  onError: (error: unknown) => void;
};

type FatalBoundaryState = {
  hasError: boolean;
};

export async function bootstrapApplication(rootElement: HTMLElement) {
  const root = ReactDOM.createRoot(rootElement);
  let fatalReport: FatalReport | null = null;

  const reportFatal = (phase: FatalPhase, error: unknown) => {
    const nextReport = normalizeFatalReport(phase, error);
    if (
      fatalReport &&
      fatalReport.phase === nextReport.phase &&
      fatalReport.message === nextReport.message &&
      fatalReport.stack === nextReport.stack
    ) {
      return;
    }

    fatalReport = nextReport;
    console.error(`[bootstrap:${phase}]`, error);
    root.render(<FatalScreen {...nextReport} />);
  };

  installFatalListeners(reportFatal);

  try {
    const { App } = await import("./App");
    const queryClient = new QueryClient();

    root.render(
      <React.StrictMode>
        <FatalBoundary onError={(error) => reportFatal("runtime", error)}>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </FatalBoundary>
      </React.StrictMode>,
    );
  } catch (error) {
    reportFatal("startup", error);
  }
}

export function normalizeFatalReport(phase: FatalPhase, error: unknown): FatalReport {
  if (error instanceof Error) {
    return {
      phase,
      message: error.message || "Unknown application error.",
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return {
      phase,
      message: error,
    };
  }

  return {
    phase,
    message: "Unknown application error.",
  };
}

function installFatalListeners(reportFatal: (phase: FatalPhase, error: unknown) => void) {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("error", (event) => {
    if (event.error) {
      reportFatal("runtime", event.error);
      return;
    }

    reportFatal("runtime", event.message || "Unknown application error.");
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportFatal("runtime", event.reason);
  });
}

class FatalBoundary extends Component<FatalBoundaryProps, FatalBoundaryState> {
  state: FatalBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

function FatalScreen({ phase, message, stack }: FatalScreenProps) {
  return (
    <div className="fatal-screen" role="alert" aria-live="assertive">
      <div className="fatal-screen-card">
        <p className="fatal-screen-kicker">AI Switcher</p>
        <h1 className="fatal-screen-title">The app could not load.</h1>
        <p className="fatal-screen-body">
          {phase === "startup"
            ? "A startup error prevented the desktop app from rendering."
            : "A runtime error interrupted the current view."}
        </p>
        <div className="fatal-screen-detail">
          <strong>Error</strong>
          <p>{message}</p>
        </div>
        {stack ? (
          <details className="fatal-screen-stack">
            <summary>Show stack trace</summary>
            <pre>{stack}</pre>
          </details>
        ) : null}
        <p className="fatal-screen-note">
          If this happens again, keep this window open and launch from Terminal with
          <code> npm run tauri:dev</code> so the error output stays visible.
        </p>
      </div>
    </div>
  );
}
