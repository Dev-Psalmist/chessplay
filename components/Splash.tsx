"use client";

import { useEffect, useState } from "react";

/**
 * First-paint splash: the CHESPLAY mark on a sheet of 3D glass.
 * Shows once per browser session so it never gets in the way of a
 * returning player, and disappears on click or after the animation.
 */
export default function Splash() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let seen = false;

    try {
      seen = window.sessionStorage.getItem("chessplay:splash") === "seen";
      window.sessionStorage.setItem("chessplay:splash", "seen");
    } catch {
      seen = false;
    }

    if (seen) return;

    setMounted(true);

    const timer = window.setTimeout(() => setDismissed(true), 2750);

    return () => window.clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={`splash${dismissed ? " is-dismissed" : ""}`}
      role="presentation"
      onClick={() => setDismissed(true)}
      onKeyDown={() => setDismissed(true)}
    >
      <div className="splash-inner">
        <div className="splash-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/chessplay-logo.png"
            alt="Chess Play"
            width={230}
            height={158}
          />
        </div>

        <div className="splash-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
