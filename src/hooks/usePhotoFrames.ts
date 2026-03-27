import { useState, useCallback, type CSSProperties } from "react";

type FrameMode = "none" | "theme" | "adaptive";

const STORAGE_KEY = "photobank-frame-mode";

const readStoredMode = (): FrameMode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "none" || stored === "theme" || stored === "adaptive") {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return "none";
};

export const usePhotoFrames = () => {
  const [frameMode, setFrameModeState] = useState<FrameMode>(readStoredMode);

  const setFrameMode = useCallback((mode: FrameMode) => {
    setFrameModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const getFrameStyle = useCallback(
    (dominantColor?: string): CSSProperties => {
      switch (frameMode) {
        case "theme":
          return {
            padding: 6,
            background: "hsl(var(--muted))",
          };
        case "adaptive":
          return {
            padding: 6,
            background: dominantColor || "#9ca3af",
          };
        default:
          return {};
      }
    },
    [frameMode]
  );

  return { frameMode, setFrameMode, getFrameStyle };
};

export default usePhotoFrames;
