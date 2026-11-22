"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crown, LoaderCircle, Swords, Timer, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type RatingType = "bullet" | "blitz" | "rapid";
type Ratings = { bullet_rating: number; blitz_rating: number; rapid_rating: number };

const FORMATS: {
  type: RatingType;
  title: string;
  description: string;
  controls: { value: string; label: string }[];
}[] = [
  { type: "bullet", title: "Bullet", description: "Fast decisions. Faster tactics.", controls: [{ value: "1", label: "1 + 0" }] },
  { type: "blitz", title: "Blitz", description: "The competitive sweet spot.", controls: [{ value: "3", label: "3 + 0" }, { value: "5", label: "5 + 0" }] },
  { type: "rapid", title: "Rapid", description: "More time to build your plan.", controls: [{ value: "10", label: "10 + 0" }, { value: "15", label: "15 + 0" }] },
];

export default function RankedArenaPage() {
  const router = useRouter();
  const [ratingType, setRatingType] = useState<RatingType>("blitz");
  const [timeControl, setTimeControl] = useState("5");
  const [ratings, setRatings] = useState<Ratings>({ bullet_rating: 1000, blitz_rating: 1000, rapid_rating: 1000 });
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestBusyRef = useRef(false);
  const activeRef = useRef(false);

  const clearSearchInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadPlayer() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("bullet_rating, blitz_rating, rapid_rating")
        .eq("id", user.id)
        .maybeSingle();
      if (mounted && data) setRatings(data as Ratings);
    }
    void loadPlayer();
    return () => {
      mounted = false;
      activeRef.current = false;
      clearSearchInterval();
    };
  }, [router, clearSearchInterval]);

  useEffect(() => {
    const selected = FORMATS.find((format) => format.type === ratingType);
    if (selected && !selected.controls.some((control) => control.value === timeControl)) {
      setTimeControl(selected.controls[0].value);
    }
  }, [ratingType, timeControl]);

  const pollForMatch = useCallback(async () => {
    if (!activeRef.current || requestBusyRef.current) return;
    requestBusyRef.current = true;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");

      const response = await fetch("/api/ranked/matchmake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "find", ratingType, timeControl }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Matchmaking is temporarily unavailable.");

      if (result.matched && result.gameId) {
        activeRef.current = false;
        clearSearchInterval();
        setSearching(false);
        setMessage("Opponent found! Opening your rated match...");
        router.push(`/multiplayer/${result.gameId}`);
      }
    } catch (error) {
      activeRef.current = false;
      clearSearchInterval();
      setSearching(false);
      setMessage(error instanceof Error ? error.message : "Unable to find a match.");
    } finally {
      requestBusyRef.current = false;
    }
  }, [clearSearchInterval, ratingType, router, timeControl]);

  async function startSearch() {
    if (searching) return;
    setMessage("");
    setSeconds(0);
    setSearching(true);
    activeRef.current = true;
    await pollForMatch();
    if (activeRef.current) {
      intervalRef.current = setInterval(() => {
        setSeconds((value) => value + 2);
        void pollForMatch();
      }, 2000);
    }
  }

  async function cancelSearch() {
    activeRef.current = false;
    clearSearchInterval();
    setSearching(false);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      await fetch("/api/ranked/matchmake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "cancel" }),
      });
    }
    setMessage("Matchmaking cancelled.");
  }

  const selectedFormat = FORMATS.find((format) => format.type === ratingType)!;
  const currentRating = ratings[`${ratingType}_rating` as keyof Ratings];

  return (
    <main className="min-h-screen bg-[var(--bg)] px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-[color:var(--muted)] hover:text-white">
          <ArrowLeft size={17} /> Back to ChessPlay
        </Link>

        <header className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 text-[color:var(--gold)]">
            <Crown size={32} />
          </div>
          <p className="eyebrow">Competitive matchmaking</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Ranked Arena</h1>
          <p className="mx-auto mt-4 max-w-xl text-[color:var(--muted)]">
            Get paired with a player near your skill level. Every completed match changes your rating.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-[var(--panel)] p-6 sm:p-8">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/5 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Your {ratingType} rating</p>
              <p className="mt-1 text-3xl font-black text-[color:var(--gold)]">{currentRating}</p>
            </div>
            <div className="rounded-xl bg-black/20 px-4 py-3 text-sm text-[color:var(--muted)]">
              <span className="block font-semibold text-white">1,000 starting rating</span>
              Separate ratings for each format
            </div>
          </div>

          <h2 className="mb-4 text-lg font-bold">Choose your format</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {FORMATS.map((format) => (
              <button
                key={format.type}
                type="button"
                disabled={searching}
                onClick={() => setRatingType(format.type)}
                className={`rounded-2xl border p-5 text-left transition disabled:opacity-50 ${ratingType === format.type ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10" : "border-white/10 bg-black/10 hover:border-white/25"}`}
              >
                <span className="text-lg font-bold">{format.title}</span>
                <span className="mt-2 block text-xs text-[color:var(--muted)]">{format.description}</span>
              </button>
            ))}
          </div>

          <h2 className="mb-4 mt-8 text-lg font-bold">Time control</h2>
          <div className="flex flex-wrap gap-3">
            {selectedFormat.controls.map((control) => (
              <button
                key={control.value}
                type="button"
                disabled={searching}
                onClick={() => setTimeControl(control.value)}
                className={`rounded-xl border px-5 py-3 text-sm font-bold transition disabled:opacity-50 ${timeControl === control.value ? "border-[color:var(--gold)] bg-[color:var(--gold)] text-black" : "border-white/10 bg-black/10 text-white hover:bg-white/10"}`}
              >
                {control.label} <span className="ml-1 text-xs font-normal opacity-70">min</span>
              </button>
            ))}
          </div>

          {searching ? (
            <div className="mt-9 rounded-2xl border border-blue-400/20 bg-blue-500/5 p-6 text-center">
              <LoaderCircle className="mx-auto animate-spin text-[color:var(--accent-2)]" size={34} />
              <h3 className="mt-4 text-xl font-bold">Finding your opponent</h3>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Searching the {ratingType} pool near rating {currentRating}.
              </p>
              <p className="mt-4 font-mono text-2xl">{Math.floor(seconds / 60).toString().padStart(2, "0")}:{(seconds % 60).toString().padStart(2, "0")}</p>
              <button onClick={cancelSearch} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold hover:bg-white/10">
                <X size={16} /> Cancel search
              </button>
            </div>
          ) : (
            <button onClick={startSearch} className="mt-9 flex w-full items-center justify-center gap-3 rounded-xl bg-[color:var(--gold)] px-6 py-4 font-black text-black transition hover:-translate-y-0.5 hover:brightness-105">
              <Swords size={20} /> Find Ranked Match
            </button>
          )}

          {message && <p className="mt-5 rounded-xl bg-white/5 p-4 text-center text-sm text-[color:var(--muted)]">{message}</p>}
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["Skill-based", "Opponents are paired by rating, with the search range widening over time."],
            ["Rated games", "Your rating changes after a decisive result or a draw."],
            ["Fair play", "Moves and results are validated by ChessPlay's game server."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-[var(--panel)] p-5">
              <Timer size={19} className="text-[color:var(--gold)]" />
              <h3 className="mt-3 font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
