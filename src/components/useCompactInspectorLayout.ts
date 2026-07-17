import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCompactLayout } from "./useCompactLayout";
import { useCompactPaneVisibility } from "./useCompactPaneVisibility";

type CompactInspectorLayoutState = {
  compactLayout: boolean;
  compactInspectorOpen: boolean;
  setCompactInspectorOpen: Dispatch<SetStateAction<boolean>>;
  showPrimary: boolean;
  showInspector: boolean;
};

export function useCompactInspectorLayout(
  rootRef: RefObject<HTMLDivElement | null>,
  breakpoint: number,
): CompactInspectorLayoutState {
  const compactLayout = useCompactLayout(rootRef, breakpoint);
  const { compactPaneOpen, setCompactPaneOpen, showPrimary, showSecondary } =
    useCompactPaneVisibility(compactLayout);

  return {
    compactLayout,
    compactInspectorOpen: compactPaneOpen,
    setCompactInspectorOpen: setCompactPaneOpen,
    showPrimary,
    showInspector: showSecondary,
  };
}
