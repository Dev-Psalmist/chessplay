import type { CSSProperties } from "react";

/**
 * Heirloom walnut and ivory board: warm squares, a deep timber frame,
 * and restrained brass-toned highlights to complement the 3D Staunton set.
 */
export const BOARD_LIGHT = "#ead9b8";
export const BOARD_DARK = "#76513b";

export const boardFrameStyle: CSSProperties = {
  borderRadius: 14,
  overflow: "hidden",
  background: "linear-gradient(145deg, #9a704c 0%, #4a2d20 24%, #24160f 68%, #6d4a31 100%)",
  border: "7px solid #5b3927",
  boxShadow:
    "0 34px 72px -28px rgba(0,0,0,.95), inset 0 2px 0 rgba(255,235,198,.24), inset 0 -4px 10px rgba(0,0,0,.55), 0 0 0 1px rgba(224,187,128,.35)",
};

export const lightSquareStyle: CSSProperties = {
  backgroundColor: BOARD_LIGHT,
  backgroundImage:
    "linear-gradient(115deg, rgba(255,248,228,.5), transparent 48%, rgba(110,72,39,.08)), repeating-linear-gradient(2deg, rgba(126,88,50,.035) 0 1px, transparent 1px 5px)",
};

export const darkSquareStyle: CSSProperties = {
  backgroundColor: BOARD_DARK,
  backgroundImage:
    "linear-gradient(135deg, rgba(255,221,174,.14), transparent 52%, rgba(20,9,4,.24)), repeating-linear-gradient(2deg, rgba(255,228,192,.035) 0 1px, transparent 1px 6px)",
};

export const dropSquareStyle: CSSProperties = {
  boxShadow: "inset 0 0 0 3px rgba(224,184,116,.95)",
  backgroundColor: "rgba(224,184,116,.24)",
};

export const draggingPieceStyle: CSSProperties = {
  transform: "scale(1.07)",
  filter: "drop-shadow(0 16px 22px rgba(0,0,0,.62))",
};

export const draggingPieceGhostStyle: CSSProperties = { opacity: 0.24 };

export const darkNotationStyle: CSSProperties = {
  color: "rgba(247,225,190,.9)", fontSize: "11px", fontWeight: 800,
  textShadow: "0 1px 2px rgba(0,0,0,.55)",
};

export const lightNotationStyle: CSSProperties = {
  color: "rgba(82,51,31,.82)", fontSize: "11px", fontWeight: 800,
  textShadow: "0 1px 0 rgba(255,255,255,.3)",
};

type HighlightInput = {
  lastMove?: string[];
  selected?: string;
  targets?: string[];
  check?: string;
};

export function squareHighlights({
  lastMove = [], selected, targets = [], check,
}: HighlightInput): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};
  for (const square of lastMove) {
    styles[square] = {
      backgroundColor: "rgba(212,166,93,.38)",
      boxShadow: "inset 0 0 0 2px rgba(255,225,174,.68)",
    };
  }
  if (selected) {
    styles[selected] = {
      ...(styles[selected] ?? {}),
      backgroundColor: "rgba(242,199,123,.48)",
      boxShadow: "inset 0 0 0 2px rgba(255,235,194,.95)",
    };
  }
  for (const square of targets) {
    styles[square] = {
      ...(styles[square] ?? {}),
      backgroundImage: "radial-gradient(circle at center, rgba(255,232,184,.9) 0 12%, transparent 13%)",
    };
  }
  if (check) {
    styles[check] = {
      backgroundColor: "rgba(190,64,48,.5)",
      boxShadow: "inset 0 0 0 2px rgba(255,153,126,.95)",
    };
  }
  return styles;
}
