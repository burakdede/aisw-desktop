import type { ComponentType, SVGProps } from "react";
import { SFArchivebox } from "sf-symbols-lib/monochrome/SFArchivebox";
import { SFChartLineUptrendXyaxis } from "sf-symbols-lib/monochrome/SFChartLineUptrendXyaxis";
import { SFGearshape } from "sf-symbols-lib/monochrome/SFGearshape";
import { SFMagnifyingglass } from "sf-symbols-lib/monochrome/SFMagnifyingglass";
import { SFPerson2 } from "sf-symbols-lib/monochrome/SFPerson2";
import { SFRectangleGrid2x2 } from "sf-symbols-lib/monochrome/SFRectangleGrid2x2";
import { SFSidebarLeft } from "sf-symbols-lib/monochrome/SFSidebarLeft";
import { SFSquareStack3dUp } from "sf-symbols-lib/monochrome/SFSquareStack3dUp";
import { SFStethoscope } from "sf-symbols-lib/monochrome/SFStethoscope";
import { SFXmarkCircleFill } from "sf-symbols-lib/monochrome/SFXmarkCircleFill";

const ICONS = {
  overview: SFRectangleGrid2x2,
  profiles: SFPerson2,
  sets: SFSquareStack3dUp,
  diagnostics: SFStethoscope,
  backups: SFArchivebox,
  activity: SFChartLineUptrendXyaxis,
  settings: SFGearshape,
  search: SFMagnifyingglass,
  sidebar: SFSidebarLeft,
  clear: SFXmarkCircleFill,
} as const;

export type SymbolIconName = keyof typeof ICONS;

export function SymbolIcon({
  name,
  size = "sm",
  className,
}: {
  name: SymbolIconName;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  className?: string;
}) {
  const Icon = ICONS[name] as ComponentType<SVGProps<SVGSVGElement> & { size?: string | number }>;
  return <Icon aria-hidden="true" focusable="false" size={size} className={className} />;
}
