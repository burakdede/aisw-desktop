export const FATAL_PHASES = {
  startup: "startup",
  runtime: "runtime",
} as const;

export type FatalPhase = (typeof FATAL_PHASES)[keyof typeof FATAL_PHASES];

export const UNKNOWN_APPLICATION_ERROR_MESSAGE = "Unknown application error.";

export function bootstrapConsoleScope(phase: FatalPhase) {
  return `[bootstrap:${phase}]`;
}

export function fatalPhaseBody(phase: FatalPhase) {
  return phase === FATAL_PHASES.startup
    ? "A startup error prevented the desktop app from rendering."
    : "A runtime error interrupted the current view.";
}
