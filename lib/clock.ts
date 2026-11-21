export type TimeControl = {
  id: string;
  label: string;
  short: string;
  baseMs: number;
  incrementMs: number;
  daily: boolean;
};

const MIN = 60_000;
const DAY = 86_400_000;

export const TIME_CONTROLS: TimeControl[] = [
  { id: "10", label: "10 minutes", short: "10 min", baseMs: 10 * MIN, incrementMs: 0, daily: false },
  { id: "15", label: "15 minutes", short: "15 min", baseMs: 15 * MIN, incrementMs: 0, daily: false },
  { id: "25", label: "25 minutes", short: "25 min", baseMs: 25 * MIN, incrementMs: 0, daily: false },
  { id: "3d", label: "3 days per move", short: "3 days", baseMs: 3 * DAY, incrementMs: 0, daily: true },
];

export const DEFAULT_TIME_CONTROL = "10";

export function getTimeControl(id: string | null | undefined): TimeControl {
  return TIME_CONTROLS.find((t) => t.id === id) ?? TIME_CONTROLS[0];
}

/** mm:ss under an hour, h:mm:ss above it, and a day counter for daily games. */
export function formatClock(ms: number, daily = false): string {
  const clamped = Math.max(0, ms);

  if (daily) {
    const days = Math.floor(clamped / DAY);
    const hours = Math.floor((clamped % DAY) / 3_600_000);
    const minutes = Math.floor((clamped % 3_600_000) / MIN);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;

    return `${minutes}m`;
  }

  const totalSeconds = Math.ceil(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Anything at or below this is treated as time pressure for the UI. */
export function isLowTime(ms: number, daily = false): boolean {
  return daily ? ms <= 6 * 3_600_000 : ms <= 20_000;
}
