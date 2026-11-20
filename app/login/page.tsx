"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          router.push("/");
        } else {
          setMessage("Registration successful! Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#080d18] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111a2b] p-8 shadow-2xl">

        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            ♟ Chess Play
          </h1>

          <p className="mt-3 text-gray-400">
            {isSignup
              ? "Create your player account"
              : "Welcome back, champion."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {isSignup && (
            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Username
              </label>

              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="w-full rounded-lg border border-white/10 bg-[#080d18] p-3 outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Email address
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@example.com"
              className="w-full rounded-lg border border-white/10 bg-[#080d18] p-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Password
            </label>

            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-lg border border-white/10 bg-[#080d18] p-3 outline-none focus:border-blue-500"
            />
          </div>

          {message && (
            <p className="rounded-lg bg-blue-500/10 p-3 text-sm text-blue-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : isSignup
                ? "Create Account"
                : "Login"}
          </button>

        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          {isSignup
            ? "Already have an account?"
            : "New to Chess Play?"}

          <button
            onClick={() => {
              setIsSignup(!isSignup);
              setMessage("");
            }}
            className="ml-2 font-semibold text-blue-400 hover:text-blue-300"
          >
            {isSignup ? "Login" : "Register"}
          </button>
        </div>

      </div>
    </main>
  );
}
