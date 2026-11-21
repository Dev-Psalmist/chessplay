-- ChessPlay multiplayer schema and RPCs.
-- Additive and safe to re-run: preserves existing profiles, games and history.

begin;

-- Extend the existing games table without replacing existing records.
alter table public.games
  add column if not exists invite_code text,
  add column if not exists current_fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  add column if not exists draw_offer_by uuid references public.profiles(id);

create unique index if not exists games_invite_code_unique
  on public.games(invite_code)
  where invite_code is not null;

create index if not exists games_invite_code_lookup
  on public.games(invite_code)
  where status = 'waiting';

-- A durable, ordered move ledger. Clients can read it, but only trusted RPCs write it.
create table if not exists public.game_moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  ply integer not null check (ply > 0),
  player_id uuid not null references public.profiles(id),
  from_square text not null check (from_square ~ '^[a-h][1-8]$'),
  to_square text not null check (to_square ~ '^[a-h][1-8]$'),
  promotion text check (promotion is null or promotion in ('q', 'r', 'b', 'n')),
  san text not null,
  fen_after text not null,
  created_at timestamptz not null default now(),
  constraint game_moves_game_ply_unique unique (game_id, ply)
);

create index if not exists game_moves_game_order
  on public.game_moves(game_id, ply);

create table if not exists public.game_chat_messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists game_chat_messages_game_time
  on public.game_chat_messages(game_id, created_at);

create table if not exists public.rematch_requests (
  id uuid primary key default gen_random_uuid(),
  original_game_id uuid not null references public.games(id) on delete cascade,
  requester_id uuid not null references public.profiles(id),
  opponent_id uuid not null references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  new_game_id uuid references public.games(id),
  created_at timestamptz not null default now(),
  constraint rematch_distinct_players check (requester_id <> opponent_id),
  constraint rematch_new_game_state check (
    (status = 'accepted' and new_game_id is not null)
    or (status <> 'accepted' and new_game_id is null)
  )
);

create index if not exists rematch_requests_original_game
  on public.rematch_requests(original_game_id, created_at desc);

-- RLS: game participants can read move history and chat; chat writes are participant-only.
alter table public.game_moves enable row level security;
alter table public.game_chat_messages enable row level security;
alter table public.rematch_requests enable row level security;

drop policy if exists "Game participants read moves" on public.game_moves;
create policy "Game participants read moves"
on public.game_moves for select to authenticated
using (
  exists (
    select 1 from public.games g
    where g.id = game_moves.game_id
      and (g.white_player_id = (select auth.uid())
        or g.black_player_id = (select auth.uid()))
  )
);

drop policy if exists "Game participants read chat" on public.game_chat_messages;
create policy "Game participants read chat"
on public.game_chat_messages for select to authenticated
using (
  exists (
    select 1 from public.games g
    where g.id = game_chat_messages.game_id
      and (g.white_player_id = (select auth.uid())
        or g.black_player_id = (select auth.uid()))
  )
);

drop policy if exists "Game participants send chat" on public.game_chat_messages;
create policy "Game participants send chat"
on public.game_chat_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.games g
    where g.id = game_chat_messages.game_id
      and g.status = 'active'
      and (g.white_player_id = (select auth.uid())
        or g.black_player_id = (select auth.uid()))
  )
);

drop policy if exists "Game participants read rematches" on public.rematch_requests;
create policy "Game participants read rematches"
on public.rematch_requests for select to authenticated
using (
  requester_id = (select auth.uid())
  or opponent_id = (select auth.uid())
);

grant select on public.game_moves, public.game_chat_messages, public.rematch_requests to authenticated;
grant insert (game_id, sender_id, message) on public.game_chat_messages to authenticated;
revoke update, delete on public.game_moves, public.game_chat_messages, public.rematch_requests from anon, authenticated;
revoke insert, update, delete on public.game_moves, public.rematch_requests from anon, authenticated;

-- Invite-code generation is deliberately server-side.
create or replace function public.create_online_game()
returns table(created_game_id uuid, created_invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := auth.uid();
  v_code text;
  v_game_id uuid;
begin
  if v_player_id is null then
    raise exception 'You must be logged in to create a game.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_player_id) then
    raise exception 'Your player profile is not ready. Please sign in again.';
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (
      select 1 from public.games g where g.invite_code = v_code
    );
  end loop;

  insert into public.games (
    white_player_id, mode, status, invite_code, current_fen, started_at
  )
  values (
    v_player_id, 'online', 'waiting', v_code,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    null
  )
  returning id into v_game_id;

  return query select v_game_id, v_code;
end;
$$;

create or replace function public.join_online_game(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := auth.uid();
  v_game public.games%rowtype;
begin
  if v_player_id is null then
    raise exception 'You must be logged in to join a game.';
  end if;

  if length(btrim(coalesce(p_invite_code, ''))) <> 8 then
    raise exception 'Enter a valid 8-character invitation code.';
  end if;

  select * into v_game
  from public.games g
  where g.invite_code = upper(btrim(p_invite_code))
    and g.mode = 'online'
  for update;

  if not found then
    raise exception 'No game was found with that invitation code.';
  end if;

  if v_game.white_player_id = v_player_id
     or v_game.black_player_id = v_player_id then
    return v_game.id;
  end if;

  if v_game.status <> 'waiting' or v_game.black_player_id is not null then
    raise exception 'This game is no longer available.';
  end if;

  update public.games
  set black_player_id = v_player_id,
      status = 'active',
      started_at = now()
  where id = v_game.id;

  return v_game.id;
end;
$$;

-- The API validates chess legality with chess.js. This RPC makes persistence atomic
-- and rejects stale clients, wrong players, duplicate plies and out-of-order moves.
create or replace function public.commit_chess_move(
  p_game_id uuid,
  p_player_id uuid,
  p_expected_fen text,
  p_from_square text,
  p_to_square text,
  p_promotion text,
  p_san text,
  p_fen_after text,
  p_pgn text,
  p_ply integer,
  p_result text,
  p_winner_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_move_count integer;
begin
  if p_player_id is null then
    raise exception 'A valid player is required.';
  end if;

  select * into v_game
  from public.games g
  where g.id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found.';
  end if;

  if v_game.status <> 'active' then
    raise exception 'This game is not active.';
  end if;

  if p_player_id not in (v_game.white_player_id, v_game.black_player_id) then
    raise exception 'You are not a player in this game.';
  end if;

  if v_game.current_fen is distinct from p_expected_fen then
    raise exception 'The board changed. Refresh the game and try again.';
  end if;

  select count(*)::integer into v_move_count
  from public.game_moves m
  where m.game_id = p_game_id;

  if p_ply <> v_move_count + 1 then
    raise exception 'Move order conflict. Refresh the game and try again.';
  end if;

  if ((p_ply % 2 = 1) and p_player_id <> v_game.white_player_id)
     or ((p_ply % 2 = 0) and p_player_id <> v_game.black_player_id) then
    raise exception 'It is not your turn.';
  end if;

  if p_from_square !~ '^[a-h][1-8]$'
     or p_to_square !~ '^[a-h][1-8]$'
     or (p_promotion is not null and p_promotion not in ('q', 'r', 'b', 'n')) then
    raise exception 'Invalid move data.';
  end if;

  if p_result is not null and p_result not in ('white_win', 'black_win', 'draw') then
    raise exception 'Invalid game result.';
  end if;

  if p_result in ('white_win', 'black_win')
     and p_winner_id is distinct from case
       when p_result = 'white_win' then v_game.white_player_id
       else v_game.black_player_id
     end then
    raise exception 'The winner does not match the game result.';
  end if;

  if p_result = 'draw' and p_winner_id is not null then
    raise exception 'A drawn game cannot have a winner.';
  end if;

  insert into public.game_moves (
    game_id, ply, player_id, from_square, to_square,
    promotion, san, fen_after
  )
  values (
    p_game_id, p_ply, p_player_id, p_from_square, p_to_square,
    p_promotion, p_san, p_fen_after
  );

  update public.games
  set current_fen = p_fen_after,
      pgn = p_pgn,
      final_fen = case when p_result is not null then p_fen_after else final_fen end,
      result = p_result,
      winner_id = p_winner_id,
      status = case when p_result is not null then 'completed' else 'active' end,
      completed_at = case when p_result is not null then now() else null end
  where id = p_game_id;
end;
$$;

create or replace function public.handle_chess_game_action(
  p_game_id uuid,
  p_player_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_winner_id uuid;
  v_result text;
begin
  if p_action not in ('resign', 'offer_draw', 'accept_draw', 'decline_draw') then
    raise exception 'Invalid game action.';
  end if;

  select * into v_game
  from public.games g
  where g.id = p_game_id
  for update;

  if not found or v_game.status <> 'active' then
    raise exception 'This game is not active.';
  end if;

  if p_player_id not in (v_game.white_player_id, v_game.black_player_id) then
    raise exception 'You are not a player in this game.';
  end if;

  if p_action = 'resign' then
    v_winner_id := case
      when p_player_id = v_game.white_player_id then v_game.black_player_id
      else v_game.white_player_id
    end;
    v_result := case
      when v_winner_id = v_game.white_player_id then 'white_win'
      else 'black_win'
    end;

    update public.games
    set status = 'completed', result = v_result, winner_id = v_winner_id,
        completed_at = now(), draw_offer_by = null
    where id = p_game_id;

  elsif p_action = 'offer_draw' then
    if v_game.draw_offer_by is not null then
      raise exception 'A draw offer is already pending.';
    end if;
    update public.games set draw_offer_by = p_player_id where id = p_game_id;

  elsif p_action = 'accept_draw' then
    if v_game.draw_offer_by is null or v_game.draw_offer_by = p_player_id then
      raise exception 'There is no draw offer from your opponent.';
    end if;
    update public.games
    set status = 'completed', result = 'draw', winner_id = null,
        completed_at = now(), draw_offer_by = null
    where id = p_game_id;

  elsif p_action = 'decline_draw' then
    if v_game.draw_offer_by is null or v_game.draw_offer_by = p_player_id then
      raise exception 'There is no draw offer from your opponent.';
    end if;
    update public.games set draw_offer_by = null where id = p_game_id;
  end if;
end;
$$;

create or replace function public.request_chess_rematch(
  p_game_id uuid,
  p_player_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_request_id uuid;
  v_opponent_id uuid;
begin
  select * into v_game
  from public.games g
  where g.id = p_game_id
  for update;

  if not found or v_game.status <> 'completed' then
    raise exception 'A rematch can only be requested after a game is completed.';
  end if;

  if p_player_id = v_game.white_player_id then
    v_opponent_id := v_game.black_player_id;
  elsif p_player_id = v_game.black_player_id then
    v_opponent_id := v_game.white_player_id;
  else
    raise exception 'You are not a player in this game.';
  end if;

  if v_opponent_id is null then
    raise exception 'There is no opponent to rematch.';
  end if;

  if exists (
    select 1 from public.rematch_requests r
    where r.original_game_id = p_game_id and r.status = 'pending'
  ) then
    raise exception 'A rematch request is already pending.';
  end if;

  insert into public.rematch_requests (
    original_game_id, requester_id, opponent_id
  )
  values (p_game_id, p_player_id, v_opponent_id)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.respond_chess_rematch(
  p_request_id uuid,
  p_player_id uuid,
  p_decision text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.rematch_requests%rowtype;
  v_original_game public.games%rowtype;
  v_new_game_id uuid;
  v_code text;
begin
  if p_decision not in ('accept', 'decline') then
    raise exception 'Invalid rematch decision.';
  end if;

  select * into v_request
  from public.rematch_requests r
  where r.id = p_request_id
  for update;

  if not found or v_request.status <> 'pending' then
    raise exception 'This rematch request is no longer pending.';
  end if;

  if p_player_id <> v_request.opponent_id then
    raise exception 'Only the invited opponent can respond.';
  end if;

  if p_decision = 'decline' then
    update public.rematch_requests
    set status = 'declined'
    where id = p_request_id;
    return null;
  end if;

  select * into v_original_game
  from public.games g
  where g.id = v_request.original_game_id;

  if not found then
    raise exception 'The original game could not be found.';
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (
      select 1 from public.games g where g.invite_code = v_code
    );
  end loop;

  insert into public.games (
    white_player_id, black_player_id, mode, status,
    invite_code, current_fen, started_at
  )
  values (
    v_original_game.black_player_id,
    v_original_game.white_player_id,
    'online',
    'active',
    v_code,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    now()
  )
  returning id into v_new_game_id;

  update public.rematch_requests
  set status = 'accepted', new_game_id = v_new_game_id
  where id = p_request_id;

  return v_new_game_id;
end;
$$;

-- Browser lobby RPCs require an authenticated session. API routes use the service role
-- after verifying the caller's access token and pass the verified user id explicitly.
revoke all on function public.create_online_game() from public, anon;
revoke all on function public.join_online_game(text) from public, anon;
revoke all on function public.commit_chess_move(uuid, uuid, text, text, text, text, text, text, text, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.handle_chess_game_action(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.request_chess_rematch(uuid, uuid) from public, anon, authenticated;
revoke all on function public.respond_chess_rematch(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.create_online_game() to authenticated;
grant execute on function public.join_online_game(text) to authenticated;
grant execute on function public.commit_chess_move(uuid, uuid, text, text, text, text, text, text, text, integer, text, uuid) to service_role;
grant execute on function public.handle_chess_game_action(uuid, uuid, text) to service_role;
grant execute on function public.request_chess_rematch(uuid, uuid) to service_role;
grant execute on function public.respond_chess_rematch(uuid, uuid, text) to service_role;

-- Enable Supabase Realtime for the tables subscribed to by the client.
do $$
declare
  v_table text;
begin
  foreach v_table in array array['games', 'game_moves', 'game_chat_messages', 'rematch_requests']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;

alter table public.games replica identity full;
alter table public.game_moves replica identity full;
alter table public.game_chat_messages replica identity full;
alter table public.rematch_requests replica identity full;

commit;
