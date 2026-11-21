"use client";

import { formatClock, isLowTime } from "@/lib/clock";

type ChessClockProps = {
  name: string;
  detail?: string;
  ms: number;
  daily?: boolean;
  active?: boolean;
  flagged?: boolean;
};

/** One player's clock card, chess.com style: name, time, turn indicator. */
export default function ChessClock({
  name,
  detail,
  ms,
  daily = false,
  active = false,
  flagged = false,
}: ChessClockProps) {
  const low = isLowTime(ms, daily);

  return (
    <div
      className={[
        "clock",
        active ? "is-active" : "",
        low ? "is-low" : "",
        flagged ? "is-flagged" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="clock-avatar" aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </div>

      <div className="min-w-0">
        <p className="clock-name">{name}</p>
        {detail ? <p className="clock-detail">{detail}</p> : null}
      </div>

      <div className="clock-time">
        {flagged ? "0:00" : formatClock(ms, daily)}
      </div>
    </div>
  );
}
