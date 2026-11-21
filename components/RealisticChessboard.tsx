"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { Chessboard } from "react-chessboard";
import { renderChessPieceSprites, type PieceSpriteMap } from "@/lib/realistic-chess-pieces";

type BoardOptions = NonNullable<ComponentProps<typeof Chessboard>["options"]>;

type Props = {
  options: BoardOptions;
};

/**
 * Keeps react-chessboard's native drag/drop and animations, while replacing
 * its flat SVG pieces with transparent renders of real Three.js geometry.
 */
export default function RealisticChessboard({ options }: Props) {
  const [sprites, setSprites] = useState<PieceSpriteMap>({});

  useEffect(() => {
    let mounted = true;

    try {
      const rendered = renderChessPieceSprites();
      if (mounted) setSprites(rendered);
    } catch (error) {
      // WebGL can be unavailable on older browsers; preserve the default set.
      console.warn("3D chess pieces could not be rendered in this browser.", error);
    }

    return () => {
      mounted = false;
    };
  }, []);

  const pieces = useMemo(() => {
    if (Object.keys(sprites).length !== 12) return undefined;

    const renderer = (code: string) => () => (
      <img
        src={sprites[code]}
        alt=""
        draggable={false}
        className="chess-piece-3d"
      />
    );

    return {
      wP: renderer("wP"),
      wN: renderer("wN"),
      wB: renderer("wB"),
      wR: renderer("wR"),
      wQ: renderer("wQ"),
      wK: renderer("wK"),
      bP: renderer("bP"),
      bN: renderer("bN"),
      bB: renderer("bB"),
      bR: renderer("bR"),
      bQ: renderer("bQ"),
      bK: renderer("bK"),
    };
  }, [sprites]);

  return <Chessboard options={{ ...options, ...(pieces ? { pieces } : {}) }} />;
}
