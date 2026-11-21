"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isMuted, toggleMuted } from "@/lib/sound";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/play", label: "Play" },
  { href: "/puzzles", label: "Puzzles" },
  { href: "/multiplayer", label: "Multiplayer" },
  { href: "/profile", label: "Profile" },
];

export default function AppNav() {
  const pathname = usePathname();
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#070a14]/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/chessplay-mark.png"
            alt=""
            width={30}
            height={30}
            className="rounded-md"
          />
          <span className="text-[15px] font-black tracking-tight">
            CHESS<span className="text-[color:var(--gold)]">PLAY</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-white/8 text-white"
                    : "text-[color:var(--muted)] hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setMutedState(toggleMuted())}
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-[color:var(--muted)] transition hover:text-white"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </nav>

      <div className="flex items-center gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {LINKS.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition ${
                active
                  ? "bg-white/8 text-white"
                  : "text-[color:var(--muted)] hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
