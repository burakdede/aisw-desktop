import { describe, expect, it } from "vitest";
import {
  parseWorkspaceBindings,
  parseWorkspaceStatus,
} from "./workspace-parsers";

describe("workspace-parsers", () => {
  it("normalizes workspace status fallbacks", () => {
    expect(parseWorkspaceStatus(undefined)).toEqual({
      status: "unknown",
      currentContext: "none",
      expectedContext: "none",
      scope: "none",
      target: "No path or remote match",
    });

    expect(
      parseWorkspaceStatus({
        result: {
          status: "drifted",
          current_context: "work",
          matched_binding: {
            context: "client-acme",
            scope: "path",
            path: "/tmp/project",
          },
        },
      }),
    ).toEqual({
      status: "drifted",
      currentContext: "work",
      expectedContext: "client-acme",
      scope: "path",
      target: "/tmp/project",
    });
  });

  it("normalizes workspace binding guard modes and defaults", () => {
    expect(parseWorkspaceBindings(undefined)).toEqual({
      guardMode: "warn",
      defaultContext: "none",
      bindings: [],
    });

    expect(
      parseWorkspaceBindings({
        result: {
          user_bindings: {
            guard_mode: "invalid",
            default_context: "",
            items: [
              {
                context: "client-acme",
                scope: "git_remote",
                pattern: "github.com/acme/*",
              },
            ],
          },
        },
      }),
    ).toEqual({
      guardMode: "warn",
      defaultContext: "none",
      bindings: [
        {
          context: "client-acme",
          scope: "git_remote",
          target: "github.com/acme/*",
        },
      ],
    });
  });
});
