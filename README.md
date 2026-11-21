# CHESS PLAY

Play chess, solve puzzles, climb levels and beat the clock. Next.js 16 (App Router),
Supabase for auth + multiplayer state, chess.js for rules and Stockfish 19 (WASM) for
the computer opponent.

## What's in the app

- **Play** (`/play`): engine games with a browser-side Stockfish worker, five difficulty
  levels, undo, board flip and a live clock.
- **Puzzles** (`/puzzles`): 18 mate-in-one puzzles across six levels. Clearing every
  puzzle in a level unlocks the next one. Progress is saved in the browser.
- **Multiplayer** (`/multiplayer`): invite-code games with lobby, draw offers, resign,
  rematch and in-game chat.
- **Profile** (`/profile`): record and stats for signed-in players.

## Clocks

Local games run on 10, 15 or 25 minutes, or 3 days per move. The clock is authoritative
on the client for engine games and ticks down for the side on the move; a dead clock ends
the game.

Online clocks need the additive migration in `supabase/migrations/0003_game_clocks.sql`.
Run it in the Supabase SQL editor, then call `set_game_clock(game_id, '10' | '15' | '25' | '3d')`
when a game is created.

## Sound

Move, capture, castle, promotion, check, illegal and game-over sounds live in
`public/sounds`. They are synthesised, so there are no licensing strings attached, and
the mute toggle is in the top navigation.

## Design

One palette everywhere: midnight navy `#070a14`, panels `#0e1424`, periwinkle accent
`#7c8bf2`, ice `#b9c2ff`, warm wood gold `#e6c288`. Board squares are `#c6cfea` /
`#48537c`. Tokens are defined once in `app/globals.css`.

## Local development

```bash
npm install
npm run dev
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

## Deploy

Linked to Vercel: pushing to `main` builds and deploys automatically.
