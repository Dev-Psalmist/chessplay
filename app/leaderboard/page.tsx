"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { supabase } from "@/lib/supabase";
import { Crown, Medal, Search, Trophy } from "lucide-react";

type Category = "bullet" | "blitz" | "rapid" | "xp";
type Player = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bullet_rating: number;
  blitz_rating: number;
  rapid_rating: number;
  xp: number;
};

const CATEGORIES: { id: Category; label: string; column: keyof Player; note: string }[] = [
  { id: "bullet", label: "Bullet", column: "bullet_rating", note: "1 + 0 ranked games" },
  { id: "blitz", label: "Blitz", column: "blitz_rating", note: "3 + 0 and 5 + 0 ranked games" },
  { id: "rapid", label: "Rapid", column: "rapid_rating", note: "10 + 0 and 15 + 0 ranked games" },
  { id: "xp", label: "ChessPlay XP", column: "xp", note: "Progress earned from completed online games" },
];

export default function LeaderboardPage() {
  const [category, setCategory] = useState<Category>("blitz");
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      const selected = CATEGORIES.find((item) => item.id === category)!;
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bullet_rating, blitz_rating, rapid_rating, xp")
        .order(selected.column, { ascending: false })
        .order("username", { ascending: true })
        .limit(100);

      if (!mounted) return;
      if (queryError) {
        setError(queryError.message);
        setPlayers([]);
      } else {
        setPlayers((data ?? []) as Player[]);
      }
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, [category]);

  const visiblePlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return players;
    return players.filter((player) =>
      (player.display_name || player.username).toLowerCase().includes(term)
      || player.username.toLowerCase().includes(term)
    );
  }, [players, search]);

  const selected = CATEGORIES.find((item) => item.id === category)!;
  const score = (player: Player) => Number(player[selected.column] ?? 0);

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 pb-16 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <AppNav />
        <header className="py-12 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-[color:var(--gold)]/25 bg-[color:var(--gold)]/10 text-[color:var(--gold)]">
            <Trophy size={31} />
          </div>
          <p className="eyebrow">The ChessPlay standings</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">Player Leaderboard</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[color:var(--muted)]">
            See who is leading the arena. Rankings are separated by time control, with a dedicated table for ChessPlay XP.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-[var(--panel)] p-4 sm:p-7">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                onClick={() => setCategory(item.id)}
                className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${category === item.id ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10 text-[color:var(--gold)]" : "border-white/10 text-[color:var(--muted)] hover:bg-white/5"}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold">{selected.label} Rankings</h2>
              <p className="mt-1 text-xs text-[color:var(--muted)]">{selected.note} · Top 100 players</p>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2">
              <Search size={16} className="text-[color:var(--muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a player"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--muted)] sm:w-52"
              />
            </label>
          </div>

          {error && <p className="mt-5 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">Could not load standings: {error}</p>}

          {loading ? (
            <div className="py-20 text-center text-sm text-[color:var(--muted)]">Loading the standings...</div>
          ) : !visiblePlayers.length ? (
            <div className="py-20 text-center text-sm text-[color:var(--muted)]">No players match this search yet.</div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-[64px_minmax(0,1fr)_110px] border-b border-white/10 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  <span>Rank</span><span>Player</span><span className="text-right">{category === "xp" ? "XP" : "Rating"}</span>
                </div>
                {visiblePlayers.map((player) => {
                  const rank = players.findIndex((item) => item.id === player.id) + 1;
                  return (
                    <div key={player.id} className="grid grid-cols-[64px_minmax(0,1fr)_110px] items-center border-b border-white/5 px-4 py-4 transition hover:bg-white/[0.03]">
                      <div className="flex items-center gap-1 font-bold">
                        {rank === 1 ? <Crown size={18} className="text-[color:var(--gold)]" /> : rank <= 3 ? <Medal size={17} className="text-[color:var(--gold)]" /> : <span className="pl-1 text-sm text-[color:var(--muted)]">#{rank}</span>}
                      </div>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-lg font-bold">
                          {player.avatar_url ? <img src={player.avatar_url} alt="" className="h-full w-full object-cover" /> : (player.display_name || player.username).slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{player.display_name || player.username}</p>
                          <p className="truncate text-xs text-[color:var(--muted)]">@{player.username}</p>
                        </div>
                      </div>
                      <p className="text-right text-lg font-black text-[color:var(--gold)]">{score(player).toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-[color:var(--muted)]">
          <Link href="/ranked" className="hover:text-white">Enter Ranked Arena →</Link>
          <Link href="/profile" className="hover:text-white">View your profile →</Link>
        </div>
      </div>
    </main>
  );
}
