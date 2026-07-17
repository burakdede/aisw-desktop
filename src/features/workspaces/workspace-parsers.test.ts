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

    expect(
      parseWorkspaceStatus({
        result: {
          status: "match",
          active_context: "personal",
          binding: {
            context: "shared",
            scope: "git_remote",
            target: "github.com/acme/repo",
          },
        },
      }),
    ).toEqual({
      status: "match",
      currentContext: "personal",
      expectedContext: "shared",
      scope: "git_remote",
      target: "github.com/acme/repo",
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

    expect(
      parseWorkspaceBindings({
        result: {
          user_bindings: {
            guard_mode: "strict",
            default_context: "work",
            bindings: [
              {
                context: "org",
                scope: "path",
                target: "/tmp/org",
              },
            ],
            entries: [
              {
                context: "personal",
                scope: "git_remote",
              },
            ],
          },
        },
      }),
    ).toEqual({
      guardMode: "strict",
      defaultContext: "work",
      bindings: [
        {
          context: "org",
          scope: "path",
          target: "/tmp/org",
        },
        {
          context: "personal",
          scope: "git_remote",
          target: "default",
        },
      ],
    });
  });
});
