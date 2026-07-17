import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { useCompactLayout } from "./useCompactLayout";

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
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);

  useEffect(() => {
    if (!compactLayout && compactInspectorOpen) {
      setCompactInspectorOpen(false);
    }
  }, [compactInspectorOpen, compactLayout]);

  return {
    compactLayout,
    compactInspectorOpen,
    setCompactInspectorOpen,
    showPrimary: !compactLayout || !compactInspectorOpen,
    showInspector: !compactLayout || compactInspectorOpen,
  };
}
