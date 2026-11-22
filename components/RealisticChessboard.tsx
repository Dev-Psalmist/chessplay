"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { renderChessPieceSprites, type PieceSpriteMap } from "@/lib/realistic-chess-pieces";

type BoardOptions = NonNullable<ComponentProps<typeof Chessboard>["options"]>;

type Props = {
  options: BoardOptions;
};

/**
 * Native react-chessboard interactions with custom Three.js-rendered
 * Staunton pieces and subtle legal-move dots when a player selects a piece.
 */
export default function RealisticChessboard({ options }: Props) {
  const [sprites, setSprites] = useState<PieceSpriteMap>({});
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    try {
      const rendered = renderChessPieceSprites();
      if (mounted) setSprites(rendered);
    } catch (error) {
      console.warn("3D chess pieces could not be rendered in this browser.", error);
    }
    return () => {
      mounted = false;
    };
  }, []);

  // A new position invalidates any old selection and its move hints.
  useEffect(() => {
    setSelectedSquare(null);
    setLegalTargets([]);
  }, [options.position]);

  const selectSquare = useCallback(
    (squareName: string) => {
      if (!options.allowDragging || typeof options.position !== "string") {
        setSelectedSquare(null);
        setLegalTargets([]);
        return;
      }

      try {
        const chess = new Chess(options.position);
        const square = squareName as Square;
        const clickedPiece = chess.get(square);

        if (clickedPiece && clickedPiece.color === chess.turn()) {
          const moves = chess.moves({ square, verbose: true });
          setSelectedSquare(square);
          setLegalTargets(moves.map((move) => move.to));
          return;
        }

        if (selectedSquare && legalTargets.includes(square)) {
          setSelectedSquare(null);
          setLegalTargets([]);
          return;
        }

        setSelectedSquare(null);
        setLegalTargets([]);
      } catch {
        setSelectedSquare(null);
        setLegalTargets([]);
      }
    },
    [legalTargets, options.allowDragging, options.position, selectedSquare]
  );

  const handleSquareClick = useCallback(
    (args: Parameters<NonNullable<BoardOptions["onSquareClick"]>>[0]) => {
      options.onSquareClick?.(args);
      selectSquare(args.square);
    },
    [options.onSquareClick, selectSquare]
  );

  const handlePieceClick = useCallback(
    (args: Parameters<NonNullable<BoardOptions["onPieceClick"]>>[0]) => {
      options.onPieceClick?.(args);
      selectSquare(args.square);
    },
    [options.onPieceClick, selectSquare]
  );

  const squareStyles = useMemo(() => {
    const styles = { ...(options.squareStyles ?? {}) };

    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        boxShadow: "inset 0 0 0 3px rgba(224, 181, 105, 0.9)",
      };
    }

    if (typeof options.position === "string" && legalTargets.length) {
      const chess = new Chess(options.position);

      for (const target of legalTargets) {
        const occupied = chess.get(target as Square);
        styles[target] = {
          ...styles[target],
          backgroundImage: occupied
            ? "radial-gradient(transparent 52%, rgba(25, 30, 38, 0.48) 55%, rgba(25, 30, 38, 0.48) 65%, transparent 68%)"
            : "radial-gradient(circle, rgba(25, 30, 38, 0.42) 19%, transparent 22%)",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "100% 100%",
        };
      }
    }

    return styles;
  }, [legalTargets, options.position, options.squareStyles, selectedSquare]);

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
      wP: renderer("wP"), wN: renderer("wN"), wB: renderer("wB"),
      wR: renderer("wR"), wQ: renderer("wQ"), wK: renderer("wK"),
      bP: renderer("bP"), bN: renderer("bN"), bB: renderer("bB"),
      bR: renderer("bR"), bQ: renderer("bQ"), bK: renderer("bK"),
    };
  }, [sprites]);

  return (
    <div className="board-shell">
      <Chessboard
        options={{
          ...options,
          squareStyles,
          onSquareClick: handleSquareClick,
          onPieceClick: handlePieceClick,
          ...(pieces ? { pieces } : {}),
        }}
      />
    </div>
  );
}
