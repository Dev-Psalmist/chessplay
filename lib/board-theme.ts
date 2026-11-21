import type { CSSProperties } from "react";

/**
 * One board theme for the whole app.
 * The squares are the only flat colour in the UI; everything else is
 * the midnight navy / periwinkle system from globals.css.
 */

export const BOARD_LIGHT = "#c6cfea";
export const BOARD_DARK = "#48537c";

export const boardFrameStyle: CSSProperties = {
  borderRadius: 10,
  overflow: "hidden",
  boxShadow:
    "0 30px 70px -34px rgba(0,0,0,.9), inset 0 0 0 1px rgba(255,255,255,.06)",
};

export const lightSquareStyle: CSSProperties = {
  backgroundColor: BOARD_LIGHT,
  backgroundImage:
    "linear-gradient(158deg, rgba(255,255,255,.55), rgba(255,255,255,0) 55%, rgba(6,10,22,.10))",
};

export const darkSquareStyle: CSSProperties = {
  backgroundColor: BOARD_DARK,
  backgroundImage:
    "linear-gradient(158deg, rgba(255,255,255,.10), rgba(6,10,22,.28))",
};

export const dropSquareStyle: CSSProperties = {
  boxShadow: "inset 0 0 0 3px rgba(124,139,242,.85)",
  backgroundColor: "rgba(124,139,242,.16)",
};

export const draggingPieceStyle: CSSProperties = {
  transform: "scale(1.06)",
  filter: "drop-shadow(0 14px 20px rgba(0,0,0,.55))",
};

export const draggingPieceGhostStyle: CSSProperties = {
  opacity: 0.24,
};

export const darkNotationStyle: CSSProperties = {
  color: "rgba(198,207,234,.75)",
  fontSize: "11px",
  fontWeight: 700,
};

export const lightNotationStyle: CSSProperties = {
  color: "rgba(72,83,124,.75)",
  fontSize: "11px",
  fontWeight: 700,
};

type HighlightInput = {
  /** squares touched by the last move, e.g. ["e2", "e4"] */
  lastMove?: string[];
  /** the square the player picked up */
  selected?: string;
  /** legal destinations for the selected piece */
  targets?: string[];
  /** king square when in check */
  check?: string;
};

/** Per-square overlay styles: last move, selection, legal targets, check. */
export function squareHighlights({
  lastMove = [],
  selected,
  targets = [],
  check,
}: HighlightInput): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};

  for (const square of lastMove) {
    styles[square] = {
      backgroundColor: "rgba(124,139,242,.30)",
      boxShadow: "inset 0 0 0 2px rgba(185,194,255,.55)",
    };
  }

  if (selected) {
    styles[selected] = {
      ...(styles[selected] ?? {}),
      backgroundColor: "rgba(230,194,136,.35)",
      boxShadow: "inset 0 0 0 2px rgba(244,220,180,.8)",
    };
  }

  for (const square of targets) {
    styles[square] = {
      ...(styles[square] ?? {}),
      backgroundImage:
        "radial-gradient(circle at center, rgba(185,194,255,.75) 0 12%, transparent 13%)",
    };
  }

  if (check) {
    styles[check] = {
      backgroundColor: "rgba(240,118,108,.42)",
      boxShadow: "inset 0 0 0 2px rgba(255,150,140,.85)",
    };
  }

  return styles;
}
