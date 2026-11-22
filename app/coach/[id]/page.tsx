"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chess } from "chess.js";
import AppNav from "@/components/AppNav";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, BrainCircuit, LoaderCircle, Sparkles } from "lucide-react";

type MoveReview = {
  ply: number;
  san: string;
  color: "w" | "b";
  evaluation: number;
  change: number;
  label: "Brilliant" | "Good" | "Inaccuracy" | "Mistake" | "Blunder";
  explanation: string;
};

type EngineScore = { whiteScore: number; bestMove: string };

function scoreFromInfo(message: string, fen: string): number | null {
  const cp = message.match(/\bscore cp (-?\d+)/);
  const mate = message.match(/\bscore mate (-?\d+)/);
  let score: number | null = null;
  if (cp) score = Number(cp[1]) / 100;
  if (mate) score = Math.sign(Number(mate[1]) || 1) * 100;
  if (score === null) return null;
  return fen.split(" ")[1] === "b" ? -score : score;
}

function classifyMove(color: "w" | "b", change: number) {
  const loss = color === "w" ? -change : change;
  if (loss <= -1.2) return { label: "Brilliant" as const, explanation: "You improved your position significantly. This move created a strong advantage." };
  if (loss <= 0.35) return { label: "Good" as const, explanation: "This move kept the position stable or improved your chances." };
  if (loss <= 0.8) return { label: "Inaccuracy" as const, explanation: "This move gave your opponent a little more room. Look for a move that improves your pieces or protects key squares." };
  if (loss <= 1.5) return { label: "Mistake" as const, explanation: "The position became noticeably worse. Before moving, check what your opponent can capture or threaten." };
  return { label: "Blunder" as const, explanation: "This move caused a major evaluation swing. Check for hanging pieces, checks and immediate tactical threats before choosing a move." };
}

export default function ChessCoachPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const gameId = params.id;
  const [game, setGame] = useState<{ pgn: string | null; result: string | null; white_player_id: string; black_player_id: string | null } | null>(null);
  const [reviews, setReviews] = useState<MoveReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadGame() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data, error: queryError } = await supabase
        .from("games")
        .select("pgn, result, white_player_id, black_player_id, status")
        .eq("id", gameId)
        .maybeSingle();
      if (!mounted) return;
      if (queryError || !data || (data.white_player_id !== user.id && data.black_player_id !== user.id)) {
        setError("We could not load this game. Only its players can review it.");
      } else if (data.status !== "completed" || !data.pgn) {
        setError("The AI Coach is available after a completed game with a saved move history.");
      } else {
        setGame(data);
      }
      setLoading(false);
    }
    void loadGame();
    return () => { mounted = false; };
  }, [gameId, router]);

  const analyze = useCallback(async () => {
    if (!game?.pgn || analyzing) return;
    setAnalyzing(true);
    setError("");
    setReviews([]);
    setProgress(0);

    let worker: Worker | null = null;
    try {
      const replay = new Chess();
      replay.loadPgn(game.pgn);
      const moves = replay.history({ verbose: true });
      if (!moves.length) throw new Error("This game does not contain any moves to analyze.");

      const positions: { fen: string; san: string; color: "w" | "b"; ply: number }[] = [];
      const positionBuilder = new Chess();
      for (const move of moves.slice(0, 80)) {
        const color = positionBuilder.turn();
        positionBuilder.move(move);
        positions.push({ fen: positionBuilder.fen(), san: move.san, color, ply: positions.length + 1 });
      }

      worker = new Worker("/engine/stockfish-19-lite-single.js");
      const engine = worker;
      const evaluate = (fen: string) => new Promise<EngineScore>((resolve, reject) => {
        let latestScore = 0;
        const timeout = window.setTimeout(() => {
          engine.onmessage = null;
          reject(new Error("Stockfish took too long to respond. Please try again."));
        }, 20000);
        engine.onmessage = (event: MessageEvent<string>) => {
          const message = String(event.data).trim();
          if (message.startsWith("info ")) {
            const score = scoreFromInfo(message, fen);
            if (score !== null) latestScore = score;
          }
          if (message.startsWith("bestmove")) {
            window.clearTimeout(timeout);
            const bestMove = message.split(/\s+/)[1] ?? "";
            resolve({ whiteScore: latestScore, bestMove });
          }
        };
        engine.postMessage(`position fen ${fen}`);
        engine.postMessage("go depth 10");
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Stockfish did not initialise.")), 15000);
        engine.onmessage = (event: MessageEvent<string>) => {
          const message = String(event.data).trim();
          if (message === "uciok") engine.postMessage("isready");
          if (message === "readyok") { window.clearTimeout(timeout); resolve(); }
        };
        engine.postMessage("uci");
      });

      const results: MoveReview[] = [];
      let previousScore = 0;
      for (let index = 0; index < positions.length; index += 1) {
        const position = positions[index];
        const evaluation = await evaluate(position.fen);
        const change = evaluation.whiteScore - previousScore;
        const classification = classifyMove(position.color, change);
        results.push({
          ply: position.ply,
          san: position.san,
          color: position.color,
          evaluation: evaluation.whiteScore,
          change,
          label: classification.label,
          explanation: classification.explanation,
        });
        previousScore = evaluation.whiteScore;
        setProgress(Math.round(((index + 1) / positions.length) * 100));
        setReviews([...results]);
      }
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed.");
    } finally {
      worker?.terminate();
      setAnalyzing(false);
    }
  }, [game, analyzing]);

  const summary = useMemo(() => ({
    brilliant: reviews.filter((move) => move.label === "Brilliant").length,
    good: reviews.filter((move) => move.label === "Good").length,
    inaccuracies: reviews.filter((move) => move.label === "Inaccuracy").length,
    mistakes: reviews.filter((move) => move.label === "Mistake").length,
    blunders: reviews.filter((move) => move.label === "Blunder").length,
  }), [reviews]);

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-white">Loading game review...</main>;

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 pb-16 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <AppNav />
        <button onClick={() => router.push(`/multiplayer/${gameId}`)} className="mt-7 inline-flex items-center gap-2 text-sm text-[color:var(--muted)] hover:text-white"><ArrowLeft size={16} /> Back to match</button>
        <header className="py-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/25 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)]"><BrainCircuit size={17} /> Stockfish-powered analysis</div>
          <h1 className="text-4xl font-black sm:text-5xl">AI Chess Coach</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">Review your game move by move. ChessPlay runs Stockfish in your browser to estimate each position and highlight moments worth learning from. Analysis is generated on this device.</p>
        </header>

        {error && <div className="mb-5 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

        <section className="rounded-3xl border border-white/10 bg-[var(--panel)] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Game review</h2>
              <p className="mt-1 text-xs text-[color:var(--muted)]">Up to 80 half-moves · Stockfish depth 10</p>
            </div>
            <button onClick={analyze} disabled={!game || analyzing} className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--gold)] px-5 py-3 font-bold text-black disabled:opacity-50">
              {analyzing ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />}
              {analyzing ? "Analyzing..." : reviews.length ? "Analyze again" : "Analyze my game"}
            </button>
          </div>

          {analyzing && <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs text-[color:var(--muted)]"><span>Analyzing positions</span><span>{progress}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[color:var(--gold)] transition-all" style={{ width: `${progress}%` }} /></div>
          </div>}

          {reviews.length > 0 && <>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Brilliant", summary.brilliant],
                ["Good", summary.good],
                ["Inaccuracies", summary.inaccuracies],
                ["Mistakes", summary.mistakes],
                ["Blunders", summary.blunders],
              ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-xs text-[color:var(--muted)]">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}
            </div>
            <div className="mt-7 space-y-3">
              {reviews.map((move) => <article key={move.ply} className="rounded-xl border border-white/10 bg-black/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{Math.ceil(move.ply / 2)}{move.color === "w" ? "." : "..."} {move.san} <span className="ml-2 text-xs font-normal text-[color:var(--muted)]">{move.color === "w" ? "White" : "Black"}</span></p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${move.label === "Blunder" ? "bg-red-500/15 text-red-300" : move.label === "Mistake" ? "bg-orange-500/15 text-orange-300" : move.label === "Inaccuracy" ? "bg-yellow-500/15 text-yellow-200" : move.label === "Brilliant" ? "bg-purple-500/15 text-purple-200" : "bg-emerald-500/15 text-emerald-300"}`}>{move.label}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{move.explanation}</p>
                <p className="mt-2 text-xs text-[color:var(--muted)]">Position evaluation: {move.evaluation > 0 ? "+" : ""}{move.evaluation.toFixed(2)} pawns</p>
              </article>)}
            </div>
          </>}
          {!reviews.length && !analyzing && <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-10 text-center">
            <BrainCircuit size={35} className="mx-auto text-[color:var(--gold)]" />
            <p className="mt-4 font-semibold">Your coach is ready</p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">Run the analysis to see move classifications and explanations.</p>
          </div>}
        </section>
        <p className="mt-5 text-center text-xs leading-5 text-[color:var(--muted)]">Engine evaluations are estimates, not guarantees. Use the feedback as a learning guide and review critical positions on the board.</p>
      </div>
    </main>
  );
}
