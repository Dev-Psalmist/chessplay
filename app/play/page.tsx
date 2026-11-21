"use client";

import { useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";

type Difficulty = "Beginner" | "Easy" | "Intermediate" | "Advanced" | "Expert";

const DIFFICULTY_SETTINGS: Record<
  Difficulty,
  { skill: number; depth: number }
> = {
  Beginner: { skill: 0, depth: 5 },
  Easy: { skill: 3, depth: 7 },
  Intermediate: { skill: 7, depth: 10 },
  Advanced: { skill: 13, depth: 13 },
  Expert: { skill: 20, depth: 15 },
};

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
  const workerRef = useRef<Worker | null>(null);
  const thinkingRef = useRef(false);
  const ignoreNextBestMoveRef = useRef(false);

  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState("White to move");
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState<Difficulty>("Intermediate");
  const [engineReady, setEngineReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [engineError, setEngineError] = useState("");

  // Keep the board and move history synchronized with chess.js.
  function updateGameDisplay() {
    setFen(gameRef.current.fen());
    setHistory(gameRef.current.history());
    setStatus(getGameStatus(gameRef.current));
  }

  // Start the Stockfish engine in a separate browser thread.
  useEffect(() => {
    let active = true;

    const worker = new Worker(
      "/engine/stockfish-19-lite-single.js"
    );

    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<string>) => {
      if (!active) return;

      const message = String(event.data).trim();

      if (message === "uciok") {
        worker.postMessage("isready");
        return;
      }

      if (message === "readyok") {
        setEngineReady(true);
        setEngineError("");
        return;
      }

      if (message.startsWith("bestmove")) {
        if (ignoreNextBestMoveRef.current) {
          ignoreNextBestMoveRef.current = false;
          return;
        }

        const match = message.match(
          /^bestmove\s+([a-h][1-8])([a-h][1-8])([qrbn])?/
        );

        if (match) {
          try {
            gameRef.current.move({
              from: match[1] as Square,
              to: match[2] as Square,
              promotion: match[3] || "q",
            });

            updateGameDisplay();
          } catch {
            setEngineError("The computer returned an invalid move.");
          }
        }

        thinkingRef.current = false;
        setIsThinking(false);

        if (gameRef.current.isGameOver()) {
          setStatus(getGameStatus(gameRef.current));
        } else {
          setStatus(getGameStatus(gameRef.current));
        }
      }
    };

    worker.onerror = () => {
      if (!active) return;

      setEngineError(
        "Stockfish could not start. Please refresh the page and try again."
      );
      setEngineReady(false);
      thinkingRef.current = false;
      setIsThinking(false);
    };

    worker.postMessage("uci");

    return () => {
      active = false;
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Ask Stockfish to calculate its response.
  function requestComputerMove(position: string) {
    const worker = workerRef.current;

    if (!worker || !engineReady) {
      setEngineError("The chess engine is not ready yet.");
      return;
    }

    const settings = DIFFICULTY_SETTINGS[difficulty];

    thinkingRef.current = true;
    setIsThinking(true);
    setStatus("Stockfish is thinking...");

    worker.postMessage(`setoption name Skill Level value ${settings.skill}`);
    worker.postMessage(`position fen ${position}`);
    worker.postMessage(`go depth ${settings.depth}`);
  }

  // Handle a player's move.
  function handlePieceDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) {
    if (
      !targetSquare ||
      !engineReady ||
      thinkingRef.current ||
      gameRef.current.isGameOver() ||
      gameRef.current.turn() !== "w"
    ) {
      return false;
    }

    try {
      const move = gameRef.current.move({
        from: sourceSquare as Square,
        to: targetSquare as Square,
        promotion: "q",
      });

      if (!move) return false;

      updateGameDisplay();

      if (!gameRef.current.isGameOver()) {
        requestComputerMove(gameRef.current.fen());
      }

      return true;
    } catch {
      return false;
    }
  }

  // Undo the player's move and the computer's reply.
  function undoMove() {
    if (thinkingRef.current) return;

    if (history.length === 0) return;

    gameRef.current.undo();

    if (gameRef.current.history().length > 0) {
      gameRef.current.undo();
    }

    updateGameDisplay();
    setEngineError("");
  }

  // Stop the current game and return to the starting position.
  function resetGame() {
    const worker = workerRef.current;

    if (thinkingRef.current && worker) {
      ignoreNextBestMoveRef.current = true;
      worker.postMessage("stop");
    }

    thinkingRef.current = false;
    setIsThinking(false);

    gameRef.current.reset();

    setFen(gameRef.current.fen());
    setHistory([]);
    setStatus("White to move");
    setOrientation("white");
    setEngineError("");

    if (worker && engineReady) {
      worker.postMessage("ucinewgame");
      worker.postMessage("isready");
    }
  }

  const movePairs = [];

  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      number: i / 2 + 1,
      white: history[i],
      black: history[i + 1] || "",
    });
  }

  const gameFinished = gameRef.current.isGameOver();

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
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-500">
                  Playing as
                </p>

                <p className="mt-1 font-semibold">White · You</p>
                <p className="text-xs text-gray-500">Black · Stockfish AI</p>
              </div>

              <div className="rounded-full bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
                {isThinking ? "🤖 Stockfish is thinking..." : status}
              </div>
            </div>

            <div className="mx-auto w-full max-w-[620px]">
              <Chessboard
                options={{
                  id: "chess-play-board",
                  position: fen,
                  boardOrientation: orientation,
                  onPieceDrop: handlePieceDrop,
                  allowDragging:
                    engineReady &&
                    !isThinking &&
                    !gameFinished &&
                    gameRef.current.turn() === "w",
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

            {!engineReady && !engineError && (
              <div className="mt-4 rounded-lg bg-amber-500/10 p-3 text-center text-sm text-amber-300">
                Preparing your Stockfish opponent...
              </div>
            )}

            {engineError && (
              <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
                {engineError}
              </div>
            )}

            <div className="mt-6 grid grid-cols-3 gap-3">
              <button
                onClick={undoMove}
                disabled={history.length === 0 || isThinking}
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
              <h2 className="mb-5 text-xl font-bold">Game Information</h2>

              <div className="space-y-4">
                <div className="rounded-xl bg-[#090d16] p-4">
                  <p className="text-sm text-gray-400">AI Difficulty</p>

                  <select
                    value={difficulty}
                    onChange={(event) =>
                      setDifficulty(event.target.value as Difficulty)
                    }
                    disabled={isThinking}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-3 text-white outline-none focus:border-amber-500 disabled:opacity-50"
                  >
                    {Object.keys(DIFFICULTY_SETTINGS).map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>

                  <p className="mt-2 text-xs text-gray-500">
                    Choose how challenging your opponent should be.
                  </p>
                </div>

                <div className="rounded-xl bg-[#090d16] p-4">
                  <p className="text-sm text-gray-400">Current Turn</p>

                  <p className="mt-1 text-lg font-semibold">
                    {gameRef.current.turn() === "w" ? "♔ White" : "♚ Black"}
                  </p>
                </div>

                <div className="rounded-xl bg-[#090d16] p-4">
                  <p className="text-sm text-gray-400">Total Moves</p>

                  <p className="mt-1 text-2xl font-bold">{history.length}</p>
                </div>

                <div className="rounded-xl bg-[#090d16] p-4">
                  <p className="text-sm text-gray-400">Game Status</p>

                  <p className="mt-1 font-semibold text-emerald-400">
                    {gameFinished
                      ? "Finished"
                      : isThinking
                        ? "Computer thinking"
                        : "In Progress"}
                  </p>
                </div>

                <div className="rounded-xl bg-[#090d16] p-4">
                  <p className="text-sm text-gray-400">Computer Opponent</p>

                  <p className="mt-1 font-semibold">
                    {engineReady ? "♟ Stockfish 19 · Online" : "Loading engine..."}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
              <h2 className="mb-4 text-xl font-bold">Move History</h2>

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
                      <span className="text-gray-500">{move.number}.</span>
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