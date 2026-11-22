"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";
import { Award, Sparkles } from "lucide-react";

type PlayerProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  reward_points: number;
  xp: number;
  bullet_rating: number;
  blitz_rating: number;
  rapid_rating: number;
};

type EarnedAchievement = { achievement_code: string; earned_at: string; achievements: { name: string; description: string; icon: string } | null };

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [achievements, setAchievements] = useState<EarnedAchievement[]>([]);

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user }, error: authError } =
          await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select(
            "username, display_name, avatar_url, rating, games_played, wins, losses, draws, reward_points, xp, bullet_rating, blitz_rating, rapid_rating"
          )
          .eq("id", user.id)
          .single();

        if (error) throw error;

        setProfile(data);

        const { data: earned } = await supabase
          .from("player_achievements")
          .select("achievement_code, earned_at, achievements(name, description, icon)")
          .eq("player_id", user.id)
          .order("earned_at", { ascending: false });
        setAchievements((earned ?? []) as unknown as EarnedAchievement[]);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load player profile."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-white">
        Loading your player profile...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--bg)] px-4 text-white">
        <h1 className="text-2xl font-bold">Profile unavailable</h1>
        <p className="text-[color:var(--muted)]">{message}</p>
        <button
          onClick={() => router.push("/login")}
          className="rounded-lg bg-blue-600 px-6 py-3"
        >
          Return to Login
        </button>
      </main>
    );
  }

  const stats = [
    { label: "Games Played", value: profile.games_played },
    { label: "Victories", value: profile.wins },
    { label: "Defeats", value: profile.losses },
    { label: "Draws", value: profile.draws },
    { label: "ChessPlay XP", value: profile.xp },
    { label: "Reward Points", value: profile.reward_points },
  ];

  return (
    <main className="min-h-screen bg-[var(--bg)] px-5 py-12 text-white">

      <div className="mx-auto max-w-4xl">
        <AppNav />

        <header className="mb-10 flex items-center justify-between">
          <h1 className="text-3xl font-bold">♟ Chess Play</h1>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
          >
            Logout
          </button>
        </header>

        <section className="rounded-2xl border border-white/10 bg-[#111a2b] p-8">

          <div className="flex flex-col items-center text-center">

            <div className="mb-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-4xl font-bold">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Player avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                "♟"
              )}
            </div>

            <h2 className="text-3xl font-bold">
              {profile.display_name || profile.username}
            </h2>

            <p className="mt-2 text-[color:var(--muted)]">
              @{profile.username}
            </p>

            <div className="mt-6 rounded-xl bg-blue-600/10 px-10 py-5">
              <p className="text-sm text-[color:var(--muted)]">
                Chess Rating
              </p>

              <p className="mt-1 text-5xl font-bold text-[color:var(--accent-2)]">
                {profile.rating}
              </p>

              <p className="mt-1 text-xs text-[color:var(--muted)]">
                ELO
              </p>
            </div>

            <div className="mt-6 w-full max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Ranked Arena Ratings
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: "Bullet", value: profile.bullet_rating },
                  { label: "Blitz", value: profile.blitz_rating },
                  { label: "Rapid", value: profile.rapid_rating },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/5 p-4">
                    <p className="text-sm text-[color:var(--muted)]">{item.label}</p>
                    <p className="mt-1 text-3xl font-bold text-[color:var(--gold)]">{item.value}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--muted)]">ELO</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="mt-10">
            <h3 className="mb-5 text-xl font-semibold">
              Player Statistics
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">

              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/10 bg-[var(--bg)] p-5"
                >
                  <p className="text-sm text-[color:var(--muted)]">
                    {stat.label}
                  </p>

                  <p className="mt-2 text-3xl font-bold">
                    {stat.value}
                  </p>
                </div>
              ))}

            </div>
          </div>

        </section>

        <div className="mt-8 text-center text-sm text-[color:var(--muted)]">
          Your chess journey starts here.
        </div>

      </div>
    </main>
  );
}
