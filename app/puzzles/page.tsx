"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  Lightbulb,
  Lock,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import AppNav from "@/components/AppNav";
import { LEVELS, TOTAL_PUZZLES, type Puzzle } from "@/lib/puzzles";
import {
  boardFrameStyle,
  darkNotationStyle,
  darkSquareStyle,
  draggingPieceGhostStyle,
  draggingPieceStyle,
  dropSquareStyle,
  lightNotationStyle,
  lightSquareStyle,
  squareHighlights,
} from "@/lib/board-theme";
import { initSounds, playSound } from "@/lib/sound";

const STORAGE_KEY = "chessplay:puzzle-progress";

type Progress = {
  solved: Record<string, string[]>;
};

function loadProgress(): Progress {
  if (typeof window === "undefined") return { solved: {} };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { solved: {} };
    const parsed = JSON.parse(raw) as Progress;
    return { solved: parsed.solved ?? {} };
  } catch {
    return { solved: {} };
  }
}

function saveProgress(progress: Progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* private mode: progress just will not persist */
  }
}

export default function PuzzlesPage() {
  const [progress, setProgress] = useState<Progress>({ solved: {} });
  const [activeLevel, setActiveLevel] = useState(1);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [game, setGame] = useState(() => new Chess());
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"solving" | "correct" | "wrong">("solving");
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    initSounds();
    const stored = loadProgress();
    setProgress(stored);

    const firstUnfinished =
      LEVELS.find(
        (level) => (stored.solved[String(level.id)] ?? []).length < level.puzzles.length,
      )?.id ?? LEVELS.length;

    setActiveLevel(firstUnfinished);
  }, []);

  const level = LEVELS.find((item) => item.id === activeLevel) ?? LEVELS[0];
  const puzzle: Puzzle = level.puzzles[Math.min(puzzleIndex, level.puzzles.length - 1)];
  const solvedInLevel = progress.solved[String(level.id)] ?? [];
  const levelComplete = solvedInLevel.length >= level.puzzles.length;
  const totalSolved = Object.values(progress.solved).reduce(
    (sum, ids) => sum + ids.length,
    0,
  );

  const xpEarned = useMemo(
    () =>
      LEVELS.reduce((sum, item) => {
        const solved = (progress.solved[String(item.id)] ?? []).length;
        return solved === item.puzzles.length ? sum + item.xp : sum;
      }, 0),
    [progress],
  );

  const resetPuzzle = useCallback(
    (nextPuzzle: Puzzle) => {
      setGame(new Chess(nextPuzzle.fen));
      setSelected(null);
      setStatus("solving");
      setAttempts(0);
      setShowHint(false);
    },
    [],
  );

  useEffect(() => {
    resetPuzzle(puzzle);
  }, [puzzle, resetPuzzle]);

  const legalTargets: string[] = useMemo(() => {
    if (!selected) return [];
    return game
      .moves({ square: selected as Square, verbose: true })
      .map((move) => move.to as string);
  }, [game, selected]);

  const highlights = useMemo(
    () =>
      squareHighlights({
        selected: selected ?? undefined,
        targets: legalTargets,
        check: game.isCheck() ? findKing(game, game.turn()) : undefined,
      }),
    [selected, legalTargets, game],
  );

  function attempt(from: string, to: string) {
    if (status === "correct") return;

    const probe = new Chess(game.fen());

    let move;
    try {
      move = probe.move({ from: from as Square, to: to as Square, promotion: "q" });
    } catch {
      playSound("illegal");
      setStatus("wrong");
      setAttempts((value) => value + 1);
      return;
    }

    const uci = `${move.from}${move.to}${move.promotion ?? ""}`;

    if (uci === puzzle.solution) {
      playSound(move.captured ? "capture" : "promote");
      setGame(probe);
      setStatus("correct");
      setSelected(null);

      setProgress((current) => {
        const existing = current.solved[String(level.id)] ?? [];
        if (existing.includes(puzzle.id)) return current;

        const next: Progress = {
          solved: {
            ...current.solved,
            [String(level.id)]: [...existing, puzzle.id],
          },
        };

        saveProgress(next);
        return next;
      });

      return;
    }

    playSound("illegal");
    setStatus("wrong");
    setAttempts((value) => value + 1);
    setSelected(null);
  }

  function handleDrop(source: string, target: string) {
    attempt(source, target);
  }

  function handleSquareClick(square: string) {
    if (status === "correct") return;

    const piece = game.get(square as Square);

    if (selected && square !== selected) {
      const isTarget = legalTargets.includes(square);

      if (isTarget) {
        attempt(selected, square);
        return;
      }

      if (piece && piece.color === "w") {
        setSelected(square);
        return;
      }

      setSelected(null);
      return;
    }

    if (piece && piece.color === "w") {
      setSelected(square === selected ? null : square);
      return;
    }

    setSelected(null);
  }

  function nextPuzzle() {
    if (puzzleIndex + 1 < level.puzzles.length) {
      setPuzzleIndex(puzzleIndex + 1);
      return;
    }

    const nextLevel = LEVELS.find((item) => item.id === level.id + 1);
    if (nextLevel) {
      setActiveLevel(nextLevel.id);
      setPuzzleIndex(0);
    }
  }

  function openLevel(levelId: number) {
    const unlocked =
      levelId === 1 ||
      (progress.solved[String(levelId - 1)] ?? []).length >=
        (LEVELS.find((item) => item.id === levelId - 1)?.puzzles.length ?? 99);

    if (!unlocked) return;

    setActiveLevel(levelId);
    const solved = progress.solved[String(levelId)] ?? [];
    const nextIndex = LEVELS.find((item) => item.id === levelId)?.puzzles.findIndex(
      (item) => !solved.includes(item.id),
    );

    setPuzzleIndex(nextIndex && nextIndex > 0 ? nextIndex : 0);
  }

  return (
    <main className="min-h-screen">
      <AppNav />

      <div className="mx-auto max-w-7xl px-5 py-10">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Puzzles &amp; levels</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              Solve your way <span className="gold-text">up the ladder</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[color:var(--muted)]">
              Eighteen verified mates across six levels. Clear every puzzle in a
              level to unlock the next one. No engine, no timer, no mercy.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="panel px-5 py-4">
              <p className="eyebrow">Solved</p>
              <p className="mt-1 text-2xl font-black">
                {totalSolved}
                <span className="text-sm font-semibold text-[color:var(--muted)]">
                  {" "}
                  / {TOTAL_PUZZLES}
                </span>
              </p>
            </div>
            <div className="panel px-5 py-4">
              <p className="eyebrow">XP</p>
              <p className="mt-1 text-2xl font-black text-[color:var(--gold)]">{xpEarned}</p>
            </div>
          </div>
        </header>

        <div className="mt-8 progress-track">
          <div
            className="progress-fill"
            style={{ width: `${Math.round((totalSolved / TOTAL_PUZZLES) * 100)}%` }}
          />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  Level {level.id} · {level.name}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{level.blurb}</p>
              </div>

              <div className="flex items-center gap-2">
                {level.puzzles.map((item, index) => {
                  const done = solvedInLevel.includes(item.id);
                  const current = index === puzzleIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPuzzleIndex(index)}
                      className={`grid h-9 w-9 place-items-center rounded-lg border text-xs font-bold transition ${
                        done
                          ? "border-[color:var(--good)]/40 bg-[color:var(--good)]/15 text-[color:var(--good)]"
                          : current
                            ? "border-[color:var(--accent)]/60 bg-[color:var(--accent)]/15 text-white"
                            : "border-white/10 text-[color:var(--muted)] hover:text-white"
                      }`}
                    >
                      {done ? <CheckCircle2 size={14} /> : index + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="board-shell mt-5">
              <Chessboard
                options={{
                  id: `puzzle-${puzzle.id}`,
                  position: game.fen(),
                  boardOrientation: "white",
                  onPieceDrop: ({ sourceSquare, targetSquare }) => {
                    if (!targetSquare) return false;
                    handleDrop(sourceSquare, targetSquare);
                    return true;
                  },
                  onSquareClick: ({ square }) => handleSquareClick(square),
                  allowDragging: status !== "correct",
                  animationDurationInMs: 180,
                  showNotation: true,
                  boardStyle: boardFrameStyle,
                  darkSquareStyle,
                  lightSquareStyle,
                  dropSquareStyle,
                  draggingPieceStyle,
                  draggingPieceGhostStyle,
                  darkSquareNotationStyle: darkNotationStyle,
                  lightSquareNotationStyle: lightNotationStyle,
                  squareStyles: highlights,
                }}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => resetPuzzle(puzzle)}
                className="btn btn-ghost"
              >
                <RotateCcw size={15} /> Reset
              </button>

              <button
                type="button"
                onClick={() => setShowHint(true)}
                disabled={showHint}
                className="btn btn-ghost disabled:opacity-50"
              >
                <Lightbulb size={15} /> Hint
              </button>

              <span className="chip">{puzzle.prompt}</span>

              {status === "wrong" && (
                <span className="chip" style={{ borderColor: "rgba(240,118,108,.4)", color: "#ffb4ad" }}>
                  Not quite. Try another move.
                </span>
              )}
            </div>

            {showHint && status !== "correct" && (
              <p className="mt-3 text-sm text-[color:var(--accent-light)]">
                {puzzle.hint}
                {attempts >= 2 ? ` Mate is on ${puzzle.san.slice(-3, -1)}.` : ""}
              </p>
            )}
          </section>

          <aside className="space-y-4">
            <div className="panel p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">This level</h3>
                <span className="chip chip-accent">
                  {solvedInLevel.length}/{level.puzzles.length}
                </span>
              </div>

              <div className="mt-3 progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.round((solvedInLevel.length / level.puzzles.length) * 100)}%`,
                  }}
                />
              </div>

              {status === "correct" ? (
                <div className="mt-5 rounded-xl border border-[color:var(--good)]/35 bg-[color:var(--good)]/10 p-4">
                  <p className="flex items-center gap-2 font-bold text-[color:var(--good)]">
                    <Sparkles size={16} /> {puzzle.san} — solved
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {levelComplete
                      ? "Level complete. The next one is open."
                      : "That is the mate. Keep going."}
                  </p>

                  <button type="button" onClick={nextPuzzle} className="btn btn-primary mt-4 w-full">
                    {levelComplete ? "Next level" : "Next puzzle"} <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-[color:var(--muted)]">
                  Drag a white piece, or tap it and then tap its destination. The
                  puzzle is graded the moment you let go.
                </p>
              )}
            </div>

            <div className="panel p-5">
              <h3 className="font-bold">Levels</h3>

              <div className="mt-4 space-y-2">
                {LEVELS.map((item) => {
                  const solved = (progress.solved[String(item.id)] ?? []).length;
                  const complete = solved >= item.puzzles.length;
                  const unlocked =
                    item.id === 1 ||
                    (progress.solved[String(item.id - 1)] ?? []).length >=
                      (LEVELS.find((prev) => prev.id === item.id - 1)?.puzzles.length ?? 99);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openLevel(item.id)}
                      disabled={!unlocked}
                      className={`level-card flex w-full items-center gap-3 !p-3 text-left ${
                        !unlocked ? "is-locked" : ""
                      } ${item.id === activeLevel ? "is-current" : ""}`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-xs font-bold ${
                          complete
                            ? "border-[color:var(--gold)]/45 bg-[color:var(--gold)]/15 text-[color:var(--gold)]"
                            : "border-white/10 text-[color:var(--muted)]"
                        }`}
                      >
                        {complete ? <Crown size={15} /> : !unlocked ? <Lock size={13} /> : item.id}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{item.name}</span>
                        <span className="block text-xs text-[color:var(--muted)]">
                          {solved}/{item.puzzles.length} solved · {item.xp} XP
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Link href="/play" className="btn btn-ghost w-full">
              Take it to the board <ArrowRight size={15} />
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

function findKing(game: Chess, color: "w" | "b"): string | undefined {
  const board = game.board();

  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.type === "k" && cell.color === color) {
        return cell.square;
      }
    }
  }

  return undefined;
}
