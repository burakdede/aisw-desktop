import { useId } from "react";
import { cn } from "../lib/utils";
import {
  isSupportedTool,
  toolDisplayName,
  toolShortName,
  type SupportedTool,
} from "../lib/tool-registry";

export const TOOL_BRAND_LOGO_SIZES = {
  compact: 15,
  inline: 16,
  section: 18,
  prominent: 20,
} as const;

export const TOOL_BRAND_VARIANTS = {
  inlineCompact: {
    className: "tool-brand-inline",
    logoSize: TOOL_BRAND_LOGO_SIZES.compact,
  },
  inline: {
    className: "tool-brand-inline",
    logoSize: TOOL_BRAND_LOGO_SIZES.inline,
  },
  inlineSection: {
    className: "tool-brand-inline",
    logoSize: TOOL_BRAND_LOGO_SIZES.section,
  },
  compact: {
    className: "tool-brand-compact",
    logoSize: TOOL_BRAND_LOGO_SIZES.inline,
  },
  headingSection: {
    className: "tool-brand-heading",
    logoSize: TOOL_BRAND_LOGO_SIZES.section,
  },
  headingProminent: {
    className: "tool-brand-heading",
    logoSize: TOOL_BRAND_LOGO_SIZES.prominent,
  },
} as const;

export function ToolBrand({
  tool,
  variant,
  className,
  logoClassName,
  nameClassName,
  logoSize = TOOL_BRAND_LOGO_SIZES.prominent,
  shortName = false,
}: {
  tool: string;
  variant?: keyof typeof TOOL_BRAND_VARIANTS;
  className?: string;
  logoClassName?: string;
  nameClassName?: string;
  logoSize?: number;
  shortName?: boolean;
}) {
  const presentation = variant ? TOOL_BRAND_VARIANTS[variant] : null;
  const resolvedClassName = cn(presentation?.className, className);
  const resolvedLogoSize = presentation?.logoSize ?? logoSize;

  return (
    <span className={cn("tool-brand", resolvedClassName)}>
      <ToolLogo tool={tool} size={resolvedLogoSize} className={logoClassName} />
      <span className={cn("tool-brand-name", nameClassName)}>{formatToolBrandName(tool, shortName)}</span>
    </span>
  );
}

export function ToolLogo({
  tool,
  size = TOOL_BRAND_LOGO_SIZES.prominent,
  className,
}: {
  tool: string;
  size?: number;
  className?: string;
}) {
  if (isSupportedTool(tool)) {
    return (
      <span
        className={cn("tool-logo", `tool-logo-${tool}`, className)}
        aria-hidden="true"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <BrandGlyph tool={tool} />
      </span>
    );
  }

  return (
    <span
      className={cn("tool-logo", "tool-logo-fallback", className)}
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
          <rect x="10.75" y="1.9" width="2.5" height="6.2" rx="1.25" />
          <rect x="10.75" y="15.9" width="2.5" height="6.2" rx="1.25" />
          <rect x="15.9" y="10.75" width="6.2" height="2.5" rx="1.25" />
          <rect x="1.9" y="10.75" width="6.2" height="2.5" rx="1.25" />
          <rect x="14.92" y="4.08" width="2.5" height="6.2" rx="1.25" transform="rotate(45 16.17 7.18)" />
          <rect x="6.58" y="13.72" width="2.5" height="6.2" rx="1.25" transform="rotate(45 7.83 16.82)" />
          <rect x="13.72" y="14.92" width="6.2" height="2.5" rx="1.25" transform="rotate(45 16.82 16.17)" />
          <rect x="4.08" y="6.58" width="6.2" height="2.5" rx="1.25" transform="rotate(45 7.18 7.83)" />
          <circle cx="12" cy="12" r="3.1" fill="var(--surface-0)" />
        </g>
      </svg>
    );
  }

  if (tool === "codex") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <g fill="currentColor">
          <path d="M12.03 2.1c1.22 0 2.15.28 2.88.83l2.2 1.63c1.47 1.08 2.3 2.54 2.48 4.36l.26 2.55c.15 1.44-.08 2.69-.7 3.74l-1.82 3.04c-.95 1.6-2.27 2.56-3.96 2.89l-2.34.45c-1.54.3-2.95.03-4.22-.82l-2.21-1.46c-1.56-1.03-2.48-2.48-2.76-4.35l-.39-2.54c-.21-1.38-.02-2.62.57-3.72l1.72-3.16c.9-1.65 2.23-2.69 3.98-3.11l2.31-.56c.47-.11.93-.17 1.4-.17Zm-1.8 2.31-2.13.52c-1.09.27-1.91.9-2.47 1.9L3.99 9.84c-.39.71-.52 1.51-.39 2.41l.36 2.35c.17 1.14.69 1.96 1.55 2.46l2.02 1.34c.81.54 1.7.72 2.69.52l2.12-.41c1.04-.2 1.85-.79 2.42-1.77l1.66-2.78c.4-.67.55-1.48.44-2.43l-.24-2.36c-.11-1.07-.57-1.89-1.39-2.49l-2.01-1.48c-.78-.58-1.77-.75-2.98-.5Z" />
          <path d="M9.98 7.08a2.1 2.1 0 0 1 2.18-.24l2.86 1.44a2.08 2.08 0 0 1 1.12 1.58l.45 3.16a2.1 2.1 0 0 1-.5 1.68l-2.08 2.37a2.1 2.1 0 0 1-1.52.71l-3.2.1a2.1 2.1 0 0 1-1.55-.58l-2.31-2.2a2.1 2.1 0 0 1-.64-1.57l-.01-.32 2.58 1.75 4.2-.07 2.76-3.12-.35-2.44-3.83-1.93Z" />
        </g>
      </svg>
    );
  }

  if (tool === "antigravity") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.4 16.9 12 7.2l5.6 9.7" strokeWidth="2.2" />
          <path d="M9.1 12.2h5.8" strokeWidth="2" />
          <path d="M8.25 18.9h7.5" strokeWidth="2.2" />
          <path d="M12 5.35v-.55" strokeWidth="1.8" />
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

function formatToolBrandName(tool: string, shortName: boolean) {
  return shortName ? toolShortName(tool) : toolDisplayName(tool);
}
