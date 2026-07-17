import type { ReactNode } from "react";

type PaneSectionHeaderProps = {
  kicker?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  titleTag?: "h3" | "h4";
};

export function PaneSectionHeader({
  kicker,
  title,
  detail,
  actions,
  titleTag = "h3",
}: PaneSectionHeaderProps) {
  const TitleTag = titleTag;

  return (
    <div className="desktop-pane-section-header">
      <div>
        {kicker ? <p className="card-kicker">{kicker}</p> : null}
        <TitleTag>{title}</TitleTag>
        {detail ? <p className="inline-note">{detail}</p> : null}
      </div>
      {actions}
    </div>
  );
}
