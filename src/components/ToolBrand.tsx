import { useId } from "react";
import { toolDisplayName } from "../lib/tool-display";

type SupportedTool = "claude" | "codex" | "gemini";

export function ToolBrand({
  tool,
  className,
  logoClassName,
  nameClassName,
  logoSize = 20,
  shortName = false,
}: {
  tool: string;
  className?: string;
  logoClassName?: string;
  nameClassName?: string;
  logoSize?: number;
  shortName?: boolean;
}) {
  return (
    <span className={joinClasses("tool-brand", className)}>
      <ToolLogo tool={tool} size={logoSize} className={logoClassName} />
      <span className={joinClasses("tool-brand-name", nameClassName)}>{formatToolBrandName(tool, shortName)}</span>
    </span>
  );
}

export function ToolLogo({
  tool,
  size = 20,
  className,
}: {
  tool: string;
  size?: number;
  className?: string;
}) {
  if (isSupportedTool(tool)) {
    return (
      <span
        className={joinClasses("tool-logo", `tool-logo-${tool}`, className)}
        aria-hidden="true"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <BrandGlyph tool={tool} />
      </span>
    );
  }

  return (
    <span
      className={joinClasses("tool-logo", "tool-logo-fallback", className)}
      aria-hidden="true"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {tool.slice(0, 1).toUpperCase()}
    </span>
  );
}

function BrandGlyph({ tool }: { tool: SupportedTool }) {
  const gradientId = useId();

  if (tool === "claude") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <g fill="currentColor">
          <path d="M12 2.5 14.3 6 18.5 5.1 17.2 9.2 21.5 12 17.2 14.8 18.5 18.9 14.3 18 12 21.5 9.7 18 5.5 18.9 6.8 14.8 2.5 12 6.8 9.2 5.5 5.1 9.7 6Z" />
          <circle cx="12" cy="12" r="3.35" fill="var(--surface-0)" />
        </g>
      </svg>
    );
  }

  if (tool === "codex") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3.4 18.7 7.2V14.8L12 18.6 5.3 14.8V7.2Z" />
          <path d="M12 3.4v7.2l6.7 4.2" />
          <path d="m12 10.6-6.7 4.2" />
          <path d="M18.7 7.2 12 11 5.3 7.2" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67b7ff" />
          <stop offset="50%" stopColor="#7b78ff" />
          <stop offset="100%" stopColor="#a45bff" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradientId})`}>
        <path d="M12 2.8 14.25 9.75 21.2 12 14.25 14.25 12 21.2 9.75 14.25 2.8 12 9.75 9.75Z" />
        <path d="M18.1 3.6 18.95 6.05 21.4 6.9 18.95 7.75 18.1 10.2 17.25 7.75 14.8 6.9 17.25 6.05Z" />
      </g>
    </svg>
  );
}

function isSupportedTool(tool: string): tool is SupportedTool {
  return tool === "claude" || tool === "codex" || tool === "gemini";
}

function formatToolBrandName(tool: string, shortName: boolean) {
  if (!shortName) {
    return toolDisplayName(tool);
  }

  if (tool === "claude") {
    return "Claude";
  }
  if (tool === "codex") {
    return "Codex";
  }
  if (tool === "gemini") {
    return "Gemini";
  }

  return toolDisplayName(tool);
}

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}
