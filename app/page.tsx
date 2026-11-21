"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();

  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser();

      setLoggedIn(!!user);
      setLoading(false);
    }

    checkSession();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setLoggedIn(false);
    router.refresh();
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--bg)] text-white">

      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7">

        <Link href="/" className="text-2xl font-black tracking-tight">
          ♟ CHESS<span className="text-[color:var(--gold)]">PLAY</span>
        </Link>

        <div className="flex items-center gap-3">

          {!loading && loggedIn ? (
            <>
              <Link
                href="/puzzles"
                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
              >
                Puzzles
              </Link>

              <Link
                href="/profile"
                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
              >
                My Profile
              </Link>

              <button
                onClick={handleLogout}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
              >
                Logout
              </button>
            </>
          ) : !loading ? (
            <Link
              href="/login"
              className="rounded-lg bg-[color:var(--gold)] px-5 py-2 font-semibold text-black hover:opacity-90"
            >
              Sign In
            </Link>
          ) : null}

        </div>
      </nav>

      <section className="relative mx-auto flex max-w-7xl flex-col items-center px-6 pb-24 pt-20 text-center">

        <div className="absolute left-1/2 top-10 -z-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[color:var(--gold)]/10 blur-[120px]" />

        <div className="relative z-10">

          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/10 px-5 py-2 text-sm text-[color:var(--gold)]">
            ♟ THINK. MOVE. CONQUER.
          </div>

          <h1 className="mx-auto max-w-4xl text-5xl font-black leading-tight tracking-tight sm:text-7xl">
            Every Match.
            <br />
            Every Move.
            <br />
            <span className="text-[color:var(--gold)]">Every Victory.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[color:var(--muted)]">
            Welcome to ChessPlay, where strategy meets intelligence.
            Challenge yourself against powerful AI opponents and
            sharpen your skills one move at a time.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">

            <Link
              href="/play"
              className="rounded-xl bg-[color:var(--gold)] px-9 py-4 font-bold text-black transition hover:-translate-y-1 hover:opacity-90"
            >
              Play Chess Now →
            </Link>

            <Link
              href={loggedIn ? "/profile" : "/login"}
              className="rounded-xl border border-white/15 px-9 py-4 font-semibold transition hover:bg-white/10"
            >
              {loggedIn ? "My Player Profile" : "Create Account"}
            </Link>

          </div>

        </div>

        <div className="relative mt-20 grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3">

          <div className="rounded-2xl border border-white/10 bg-[var(--panel)]/80 p-7">
            <div className="text-4xl">♟</div>
            <h2 className="mt-4 text-lg font-bold">AI Opponents</h2>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
              Challenge Stockfish and choose your preferred difficulty.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[var(--panel)]/80 p-7">
            <div className="text-4xl">♛</div>
            <h2 className="mt-4 text-lg font-bold">Player Profiles</h2>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
              Track your chess rating, victories and playing statistics.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[var(--panel)]/80 p-7">
            <div className="text-4xl">🏆</div>
            <h2 className="mt-4 text-lg font-bold">Your Journey</h2>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
              Develop your strategy and become a stronger chess player.
            </p>
          </div>

        </div>

      </section>

      <footer className="border-t border-white/5 px-6 py-8 text-center text-sm text-[color:var(--muted)]">
        © 2026 ChessPlay. Think Ahead. Play Smart.
      </footer>

    </main>
  );
}