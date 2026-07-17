import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type CompactPaneVisibilityState = {
  compactPaneOpen: boolean;
  setCompactPaneOpen: Dispatch<SetStateAction<boolean>>;
  showPrimary: boolean;
  showSecondary: boolean;
};

export function useCompactPaneVisibility(
  compactLayout: boolean,
): CompactPaneVisibilityState {
  const [compactPaneOpen, setCompactPaneOpen] = useState(false);

  useEffect(() => {
    if (!compactLayout && compactPaneOpen) {
      setCompactPaneOpen(false);
    }
  }, [compactLayout, compactPaneOpen]);

  return {
    compactPaneOpen,
    setCompactPaneOpen,
    showPrimary: !compactLayout || !compactPaneOpen,
    showSecondary: !compactLayout || compactPaneOpen,
  };
}
