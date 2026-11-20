"use client";

import { useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";

function getGameStatus(game: Chess) {
  if (game.isCheckmate()) {
    return `Checkmate! ${game.turn() === "w" ? "Black" : "White"} wins!`;
  }

  if (game.isStalemate()) return "Draw by stalemate!";
  if (game.isThreefoldRepetition()) return "Draw by repetition!";
  if (game.isInsufficientMaterial()) return "Draw by insufficient material!";
  if (game.isDraw()) return "Game drawn!";

  return game.isCheck()
    ? `${game.turn() === "w" ? "White" : "Black"} is in check!`
    : `${game.turn() === "w" ? "White" : "Black"} to move`;
}

export default function PlayPage() {
  const gameRef = useRef(new Chess());

  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState("White to move");
  const [orientation, setOrientation] = useState<"white" | "black">("white");

  function handlePieceDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) {
    if (!targetSquare || gameRef.current.isGameOver()) {
      return false;
    }

    try {
      const move = gameRef.current.move({
        from: sourceSquare as Square,
        to: targetSquare as Square,
        promotion: "q",
      });

      if (!move) return false;

      setFen(gameRef.current.fen());
      setHistory(gameRef.current.history());
      setStatus(getGameStatus(gameRef.current));

      return true;
    } catch {
      return false;
    }
  }

  function undoMove() {
    const move = gameRef.current.undo();

    if (!move) return;

    setFen(gameRef.current.fen());
    setHistory(gameRef.current.history());
    setStatus(getGameStatus(gameRef.current));
  }

  function resetGame() {
    gameRef.current.reset();

    setFen(gameRef.current.fen());
    setHistory([]);
    setStatus("White to move");
    setOrientation("white");
  }

  const movePairs = [];

  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      number: i / 2 + 1,
      white: history[i],
      black: history[i + 1] || "",
    });
  }

  return (
    <main className="min-h-screen bg-[#090d16] px-4 py-8 text-white">

      <div className="mx-auto max-w-7xl">

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">

          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              ♟ CHESS PLAY
            </h1>

            <p className="mt-1 text-sm text-gray-400">
              Every move matters.
            </p>
          </div>

          <a
            href="/profile"
            className="rounded-lg border border-white/10 px-5 py-2 hover:bg-white/10"
          >
            Player Profile
          </a>

        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">

          {/* CHESSBOARD */}

          <section className="rounded-2xl border border-white/10 bg-[#111827] p-4 sm:p-6">

            <div className="mb-5 flex items-center justify-between">

              <div>
                <p className="text-xs uppercase tracking-widest text-gray-500">
                  Playing as
                </p>

                <p className="mt-1 font-semibold">
                  {orientation === "white" ? "White" : "Black"}
                </p>
              </div>

              <div className="rounded-full bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
                {status}
              </div>

            </div>

            <div className="mx-auto w-full max-w-[620px]">

              <Chessboard
                options={{
                  id: "chess-play-board",
                  position: fen,
                  boardOrientation: orientation,
                  onPieceDrop: handlePieceDrop,
                  allowDragging: !gameRef.current.isGameOver(),
                  showNotation: true,
                  boardStyle: {
                    borderRadius: "10px",
                    overflow: "hidden",
                  },
                  darkSquareStyle: {
                    backgroundColor: "#779556",
                  },
                  lightSquareStyle: {
                    backgroundColor: "#ebecd0",
                  },
                  animationDurationInMs: 180,
                }}
              />

            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">

              <button
                onClick={undoMove}
                disabled={history.length === 0}
                className="rounded-lg border border-white/10 py-3 text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↶ Undo
              </button>

              <button
                onClick={() =>
                  setOrientation(
                    orientation === "white" ? "black" : "white"
                  )
                }
                className="rounded-lg border border-white/10 py-3 text-sm transition hover:bg-white/10"
              >
                ⇅ Flip Board
              </button>

              <button
                onClick={resetGame}
                className="rounded-lg bg-amber-500 py-3 text-sm font-semibold text-black transition hover:bg-amber-400"
              >
                New Game
              </button>

            </div>

          </section>

          {/* GAME INFORMATION */}

          <aside className="space-y-6">

            <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">

              <h2 className="mb-5 text-xl font-bold">
                Game Information
              </h2>

              <div className="space-y-4">

                <div className="rounded-xl bg-[#090d16] p-4">
                  <p className="text-sm text-gray-400">
                    Current Turn
                  </p>

                  <p className="mt-1 text-lg font-semibold">
                    {gameRef.current.turn() === "w" ? "♔ White" : "♚ Black"}
                  </p>
                </div>

                <div className="rounded-xl bg-[#090d16] p-4">
                  <p className="text-sm text-gray-400">
                    Total Moves
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {history.length}
                  </p>
                </div>

                <div className="rounded-xl bg-[#090d16] p-4">
                  <p className="text-sm text-gray-400">
                    Game Status
                  </p>

                  <p className="mt-1 font-semibold text-emerald-400">
                    {gameRef.current.isGameOver() ? "Finished" : "In Progress"}
                  </p>
                </div>

              </div>

            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">

              <h2 className="mb-4 text-xl font-bold">
                Move History
              </h2>

              {movePairs.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  Your moves will appear here.
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto">

                  <div className="grid grid-cols-3 border-b border-white/10 pb-3 text-xs font-semibold text-gray-500">
                    <span>MOVE</span>
                    <span>WHITE</span>
                    <span>BLACK</span>
                  </div>

                  {movePairs.map((move) => (
                    <div
                      key={move.number}
                      className="grid grid-cols-3 border-b border-white/5 py-3 text-sm"
                    >
                      <span className="text-gray-500">
                        {move.number}.
                      </span>

                      <span>{move.white}</span>

                      <span>{move.black}</span>
                    </div>
                  ))}

                </div>
              )}

            </section>

          </aside>

        </div>

        <footer className="mt-10 text-center text-sm text-gray-600">
          Chess Play · Think Ahead. Play Smart.
        </footer>

      </div>

    </main>
  );
}
