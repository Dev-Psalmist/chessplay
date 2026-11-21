"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, Users, Swords, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type GameRoom = {
  id: string;
  invite_code: string;
  status: string;
  white_player_id: string;
  black_player_id: string | null;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(error.message);
  }

  if (typeof error === "string") {
    return error;
  }

  return fallback;
}

export default function MultiplayerPage() {
  const router = useRouter();

  const [inviteCode, setInviteCode] = useState("");
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  // Verify that the player is authenticated.
  useEffect(() => {
    async function checkUser() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      setUserId(data.user.id);
    }

    checkUser();
  }, [router]);

  // Listen for changes to the current game.
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`multiplayer-room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          const updatedGame = payload.new as GameRoom;

          setRoom((previous) =>
            previous
              ? { ...previous, ...updatedGame }
              : updatedGame
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  // Create a new multiplayer game.
  async function createGame() {
    if (!userId) {
      setMessage("Please wait while your account is verified.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc("create_online_game");

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      if (
        !result?.created_game_id ||
        !result?.created_invite_code
      ) {
        throw new Error(
          "The game was created, but its invitation details could not be loaded."
        );
      }

      setRoom({
        id: result.created_game_id,
        invite_code: result.created_invite_code,
        status: "waiting",
        white_player_id: userId,
        black_player_id: null,
      });
    } catch (error: unknown) {
      console.error("Create game error:", error);
      setMessage(
        getErrorMessage(error, "Unable to create a game.")
      );
    } finally {
      setLoading(false);
    }
  }

  // Join an existing game using its invitation code.
  async function joinGame(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const code = inviteCode.trim().toUpperCase();

    if (code.length !== 8) {
      setMessage("Please enter a valid 8-character invitation code.");
      return;
    }

    if (!userId) {
      setMessage("Please wait while your account is verified.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // Ask Supabase to join the game.
      const { data, error } = await supabase.rpc(
        "join_online_game",
        {
          p_invite_code: code,
        }
      );

      if (error) throw error;

      if (!data) {
        throw new Error("The game could not be found.");
      }

      // Retrieve the actual game details after joining.
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select(
          "id, invite_code, status, white_player_id, black_player_id"
        )
        .eq("id", data)
        .single();

      if (gameError) throw gameError;

      if (!game) {
        throw new Error(
          "You joined the game, but its details could not be retrieved."
        );
      }

      setRoom(game as GameRoom);
      setInviteCode("");
    } catch (error: unknown) {
      console.error("Supabase join error:", error);

      setMessage(
        getErrorMessage(error, "Unable to join this game.")
      );
    } finally {
      setLoading(false);
    }
  }

  // Copy the invitation code.
  async function copyInvitation() {
    if (!room) return;

    try {
      await navigator.clipboard.writeText(room.invite_code);

      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage(
        "Unable to copy the invitation code. Please copy it manually."
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#080d18] px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">

        <button
          onClick={() => router.push("/")}
          className="mb-8 flex items-center gap-2 text-sm text-gray-400 transition hover:text-white"
        >
          <ArrowLeft size={17} />
          Back to Home
        </button>

        <header className="mb-10 text-center">
          <div className="mb-4 text-5xl">♟</div>

          <h1 className="text-4xl font-bold tracking-tight">
            Online Multiplayer
          </h1>

          <p className="mt-3 text-gray-400">
            Challenge a friend. Every move counts.
          </p>
        </header>

        {!room ? (
          <div className="grid gap-6 md:grid-cols-2">

            {/* CREATE GAME */}
            <section className="rounded-2xl border border-white/10 bg-[#111a2b] p-7">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
                <Swords size={28} />
              </div>

              <h2 className="text-2xl font-bold">
                Create a Game
              </h2>

              <p className="mt-3 min-h-12 text-sm leading-6 text-gray-400">
                Start a new chess match and invite someone to play against you.
              </p>

              <button
                onClick={createGame}
                disabled={loading || !userId}
                className="mt-7 w-full rounded-xl bg-blue-600 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Please wait..." : "Create Game"}
              </button>
            </section>

            {/* JOIN GAME */}
            <section className="rounded-2xl border border-white/10 bg-[#111a2b] p-7">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Users size={28} />
              </div>

              <h2 className="text-2xl font-bold">
                Join a Game
              </h2>

              <p className="mt-3 min-h-12 text-sm leading-6 text-gray-400">
                Have an invitation code? Enter it below to join your friend's match.
              </p>

              <form onSubmit={joinGame} className="mt-7 space-y-4">
                <input
                  type="text"
                  maxLength={8}
                  value={inviteCode}
                  onChange={(e) =>
                    setInviteCode(e.target.value.toUpperCase())
                  }
                  placeholder="ENTER CODE"
                  className="w-full rounded-xl border border-white/10 bg-[#080d18] px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-white outline-none placeholder:text-gray-600 focus:border-emerald-500"
                />

                <button
                  type="submit"
                  disabled={loading || !userId}
                  className="w-full rounded-xl bg-emerald-600 py-3 font-semibold transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Joining..." : "Join Game"}
                </button>
              </form>
            </section>

          </div>
        ) : (
          <section className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#111a2b] p-8 text-center">

            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={34} />
            </div>

            <h2 className="text-2xl font-bold">
              {room.status === "active"
                ? "Opponent Connected!"
                : "Your Game Is Ready"}
            </h2>

            <p className="mt-3 text-gray-400">
              {room.status === "active"
                ? "Both players are connected. Your match is ready to begin."
                : "Share this invitation code with your opponent."}
            </p>

            <div className="mt-8 rounded-xl border border-white/10 bg-[#080d18] p-6">
              <p className="text-xs uppercase tracking-widest text-gray-500">
                Invitation Code
              </p>

              <p className="my-4 text-4xl font-bold tracking-[0.25em] text-blue-400">
                {room.invite_code}
              </p>

              <button
                type="button"
                onClick={copyInvitation}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500"
              >
                {copied ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <Copy size={17} />
                )}

                {copied ? "Copied!" : "Copy Code"}
              </button>
            </div>

            <div className="mt-6 rounded-xl bg-white/5 p-4 text-sm">
              <p className="text-gray-400">Match status</p>

              <p
                className={`mt-2 font-semibold ${
                  room.status === "active"
                    ? "text-emerald-400"
                    : "text-yellow-400"
                }`}
              >
                {room.status === "active"
                  ? "● Opponent joined"
                  : "● Waiting for opponent"}
              </p>
            </div>

            {/* ENTER MATCH */}
            {room.status === "active" && (
              <button
                type="button"
                onClick={() => router.push(`/multiplayer/${room.id}`)}
                className="mt-7 w-full rounded-xl bg-emerald-600 py-4 font-bold text-white transition hover:bg-emerald-500"
              >
                ♟ Enter Match
              </button>
            )}

            {/* RETURN TO LOBBY */}
            <button
              type="button"
              onClick={() => {
                setRoom(null);
                setInviteCode("");
                setMessage("");
                setCopied(false);
              }}
              className="mt-7 text-sm text-gray-400 hover:text-white"
            >
              Return to Multiplayer Lobby
            </button>

          </section>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-300">
            {message}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-gray-600">
          CHESS PLAY · THINK. MOVE. CONQUER.
        </p>

      </div>
    </main>
  );
}