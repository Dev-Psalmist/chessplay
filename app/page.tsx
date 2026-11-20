"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PlayerProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  reward_points: number;
};

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw new Error(`Authentication error: ${authError.message}`);
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          throw new Error(
            `Profile database error: ${error.message} (Code: ${error.code})`
          );
        }

        if (!data) {
          throw new Error(
            "Your account exists, but no matching player profile was found."
          );
        }

        if (active) {
          setProfile(data as PlayerProfile);
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "An unexpected error occurred."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080d18] text-white">
        Loading your player profile...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#080d18] px-5 text-white">
        <h1 className="text-3xl font-bold">Profile unavailable</h1>

        <div className="max-w-lg rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-center text-red-300">
          {message}
        </div>

        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
        >
          Try Again
        </button>

        <button
          onClick={() => router.push("/login")}
          className="text-sm text-gray-400 hover:text-white"
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
    { label: "Reward Points", value: profile.reward_points },
  ];

  return (
    <main className="min-h-screen bg-[#080d18] px-5 py-12 text-white">
      <div className="mx-auto max-w-4xl">

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

            <p className="mt-2 text-gray-400">
              @{profile.username}
            </p>

            <div className="mt-6 rounded-xl bg-blue-600/10 px-10 py-5">
              <p className="text-sm text-gray-400">
                Chess Rating
              </p>

              <p className="mt-1 text-5xl font-bold text-blue-400">
                {profile.rating}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                ELO
              </p>
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
                  className="rounded-xl border border-white/10 bg-[#080d18] p-5"
                >
                  <p className="text-sm text-gray-400">
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

        <div className="mt-8 text-center text-sm text-gray-500">
          Your chess journey starts here.
        </div>

      </div>
    </main>
  );
}