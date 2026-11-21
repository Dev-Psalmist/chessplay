"use client";

/**
 * Tiny sound engine for the board.
 *
 * Sounds are preloaded once, cloned per play so fast move sequences never
 * cut each other off, and muted state lives in localStorage so the choice
 * survives a refresh.
 */

export type SoundName =
  | "move"
  | "capture"
  | "castle"
  | "promote"
  | "check"
  | "illegal"
  | "game-end";

const FILES: Record<SoundName, string> = {
  move: "/sounds/move.wav",
  capture: "/sounds/capture.wav",
  castle: "/sounds/castle.wav",
  promote: "/sounds/promote.wav",
  check: "/sounds/check.wav",
  illegal: "/sounds/illegal.wav",
  "game-end": "/sounds/game-end.wav",
};

const STORAGE_KEY = "chessplay:sound";

const cache = new Map<SoundName, HTMLAudioElement>();
let started = false;
let muted = false;

function readPreference() {
  if (typeof window === "undefined") return;
  try {
    muted = window.localStorage.getItem(STORAGE_KEY) === "off";
  } catch {
    muted = false;
  }
}

/** Preload every sound. Safe to call more than once. */
export function initSounds() {
  if (typeof window === "undefined" || started) return;

  readPreference();

  (Object.keys(FILES) as SoundName[]).forEach((name) => {
    const audio = new Audio(FILES[name]);
    audio.preload = "auto";
    audio.volume = 0.6;
    cache.set(name, audio);
  });

  started = true;
}

export function isMuted() {
  if (!started) readPreference();
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "off" : "on");
    } catch {
      /* storage can be blocked; the in-memory flag still works */
    }
  }
}

export function toggleMuted() {
  setMuted(!isMuted());
  return isMuted();
}

/** Play a sound. Never throws, never blocks a move. */
export function playSound(name: SoundName) {
  if (typeof window === "undefined") return;
  if (!started) initSounds();
  if (muted) return;

  const base = cache.get(name);
  if (!base) return;

  try {
    const node = base.cloneNode(true) as HTMLAudioElement;
    node.volume = base.volume;
    const played = node.play();
    if (played && typeof played.catch === "function") {
      played.catch(() => {
        /* autoplay policy before the first gesture — ignore */
      });
    }
  } catch {
    /* audio is a nicety, never a failure */
  }
}

/**
 * Pick the right sound for a move that has just been applied to a
 * chess.js instance.
 */
export function soundForMove(flags: {
  capture?: boolean;
  castle?: boolean;
  promotion?: boolean;
  check?: boolean;
}): SoundName {
  if (flags.check) return "check";
  if (flags.promotion) return "promote";
  if (flags.castle) return "castle";
  if (flags.capture) return "capture";
  return "move";
}
