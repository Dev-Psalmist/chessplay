-- 0004: Ranked Arena, separate ratings and atomic Elo settlement.
-- Additive only: existing friend-invite and practice games remain unrated.

begin;

alter table public.profiles
  add column if not exists bullet_rating integer not null default 1000,
  add column if not exists blitz_rating integer not null default 1000,
  add column if not exists rapid_rating integer not null default 1000;

alter table public.profiles
  drop constraint if exists profiles_bullet_rating_check,
  drop constraint if exists profiles_blitz_rating_check,
  drop constraint if exists profiles_rapid_rating_check;

alter table public.profiles
  add constraint profiles_bullet_rating_check check (bullet_rating >= 0),
  add constraint profiles_blitz_rating_check check (blitz_rating >= 0),
  add constraint profiles_rapid_rating_check check (rapid_rating >= 0);

alter table public.games
  add column if not exists is_ranked boolean not null default false,
  add column if not exists rating_type text,
  add column if not exists rating_applied_at timestamptz;

alter table public.games
  drop constraint if exists games_rating_type_check;

alter table public.games
  add constraint games_rating_type_check
  check (rating_type is null or rating_type in ('bullet', 'blitz', 'rapid'));

alter table public.rating_history
  add column if not exists rating_type text not null default 'classic';

alter table public.rating_history
  drop constraint if exists rating_history_rating_type_check;

alter table public.rating_history
  add constraint rating_history_rating_type_check
  check (rating_type in ('classic', 'bullet', 'blitz', 'rapid'));

create table if not exists public.matchmaking_queue (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  rating_type text not null check (rating_type in ('bullet', 'blitz', 'rapid')),
  time_control text not null check (time_control in ('1', '3', '5', '10', '15')),
  rating_snapshot integer not null check (rating_snapshot >= 0),
  status text not null default 'waiting' check (status in ('waiting', 'matched')),
  matched_game_id uuid references public.games(id) on delete set null,
  queued_at timestamptz not null default now(),
  constraint matchmaking_queue_match_state check (
    (status = 'waiting' and matched_game_id is null)
    or (status = 'matched' and matched_game_id is not null)
  )
);

create index if not exists matchmaking_queue_search
  on public.matchmaking_queue(rating_type, time_control, status, queued_at);

alter table public.matchmaking_queue enable row level security;
revoke all on public.matchmaking_queue from anon, authenticated;
grant all on public.matchmaking_queue to service_role;

-- Called only by the authenticated server API after validating the user's token.
-- The queue and pairing happen in one database transaction to prevent double matches.
create or replace function public.find_ranked_match(
  p_player_id uuid,
  p_rating_type text,
  p_time_control text
)
returns table(matched_game_id uuid, is_matched boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rating integer;
  v_existing public.matchmaking_queue%rowtype;
  v_opponent public.matchmaking_queue%rowtype;
  v_game_id uuid;
  v_base_ms integer;
  v_white_id uuid;
  v_black_id uuid;
begin
  if p_player_id is null
     or p_rating_type is null
     or p_time_control is null
     or p_rating_type not in ('bullet', 'blitz', 'rapid')
     or p_time_control not in ('1', '3', '5', '10', '15') then
    raise exception 'Invalid ranked matchmaking request.';
  end if;

  if (p_rating_type = 'bullet' and p_time_control <> '1')
     or (p_rating_type = 'blitz' and p_time_control not in ('3', '5'))
     or (p_rating_type = 'rapid' and p_time_control not in ('10', '15')) then
    raise exception 'The selected time control does not match this rating pool.';
  end if;

  -- Remove abandoned searches so an offline player is never paired later.
  delete from public.matchmaking_queue q
  where q.status = 'waiting'
    and q.queued_at < now() - interval '90 seconds';

  select * into v_existing
  from public.matchmaking_queue q
  where q.player_id = p_player_id
  for update;

  if found and v_existing.status = 'matched' and v_existing.matched_game_id is not null then
    delete from public.matchmaking_queue q where q.player_id = p_player_id;
    return query select v_existing.matched_game_id, true;
    return;
  end if;

  select
    case p_rating_type
      when 'bullet' then p.bullet_rating
      when 'blitz' then p.blitz_rating
      else p.rapid_rating
    end
  into v_rating
  from public.profiles p
  where p.id = p_player_id;

  if v_rating is null then
    raise exception 'Player profile not found.';
  end if;

  if exists (
    select 1
    from public.games g
    where g.status = 'active'
      and p_player_id in (g.white_player_id, g.black_player_id)
  ) then
    raise exception 'Finish your current game before entering Ranked Arena.';
  end if;

  insert into public.matchmaking_queue as current_queue (
    player_id, rating_type, time_control, rating_snapshot, status, matched_game_id, queued_at
  )
  values (p_player_id, p_rating_type, p_time_control, v_rating, 'waiting', null, now())
  on conflict (player_id) do update
    set rating_type = excluded.rating_type,
        time_control = excluded.time_control,
        rating_snapshot = excluded.rating_snapshot,
        status = 'waiting',
        matched_game_id = null,
        queued_at = case
          when current_queue.rating_type = excluded.rating_type
           and current_queue.time_control = excluded.time_control
          then current_queue.queued_at
          else now()
        end;

  select * into v_opponent
  from public.matchmaking_queue q
  where q.player_id <> p_player_id
    and q.status = 'waiting'
    and q.rating_type = p_rating_type
    and q.time_control = p_time_control
    and abs(q.rating_snapshot - v_rating) <= (
      100 + least(500, greatest(0, floor(extract(epoch from (now() - q.queued_at)) / 10)::integer * 50))
    )
  order by abs(q.rating_snapshot - v_rating), q.queued_at
  limit 1
  for update skip locked;

  if not found then
    return query select null::uuid, false;
    return;
  end if;

  v_base_ms := p_time_control::integer * 60 * 1000;

  if random() < 0.5 then
    v_white_id := p_player_id;
    v_black_id := v_opponent.player_id;
  else
    v_white_id := v_opponent.player_id;
    v_black_id := p_player_id;
  end if;

  insert into public.games (
    white_player_id, black_player_id, mode, status, current_fen,
    started_at, time_control, base_time_ms, increment_ms,
    white_time_ms, black_time_ms, last_move_at, is_ranked, rating_type
  )
  values (
    v_white_id, v_black_id, 'online', 'active',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    now(), p_time_control, v_base_ms, 0,
    v_base_ms, v_base_ms, now(), true, p_rating_type
  )
  returning id into v_game_id;

  update public.matchmaking_queue q
  set status = 'matched', matched_game_id = v_game_id
  where q.player_id in (p_player_id, v_opponent.player_id);

  -- The searching player receives the match immediately. The waiting opponent
  -- retrieves the same game on their next poll.
  delete from public.matchmaking_queue q where q.player_id = p_player_id;

  return query select v_game_id, true;
end;
$$;

revoke all on function public.find_ranked_match(uuid, text, text) from public, anon, authenticated;
grant execute on function public.find_ranked_match(uuid, text, text) to service_role;

create or replace function public.cancel_ranked_match(p_player_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.matchmaking_queue q
  where q.player_id = p_player_id and q.status = 'waiting';
$$;

revoke all on function public.cancel_ranked_match(uuid) from public, anon, authenticated;
grant execute on function public.cancel_ranked_match(uuid) to service_role;

-- Settle each ranked result once. K=32 gives new players room to move quickly.
-- The server checks the authoritative stored clock before accepting a late move.
create or replace function public.claim_game_timeout(
  p_game_id uuid,
  p_player_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_game public.games%rowtype;
  v_turn text;
  v_remaining integer;
  v_elapsed integer;
  v_winner uuid;
  v_result text;
begin
  select * into v_game
  from public.games g
  where g.id = p_game_id
  for update;

  if not found or v_game.status <> 'active' then
    return false;
  end if;

  if p_player_id not in (v_game.white_player_id, v_game.black_player_id) then
    raise exception 'You are not a player in this game.';
  end if;

  if v_game.white_time_ms is null or v_game.black_time_ms is null then
    return false;
  end if;

  v_turn := split_part(v_game.current_fen, ' ', 2);
  v_elapsed := greatest(
    0,
    floor(extract(epoch from (now() - coalesce(v_game.last_move_at, v_game.started_at, now()))) * 1000)::integer
  );

  if v_turn = 'w' then
    v_remaining := v_game.white_time_ms;
    v_winner := v_game.black_player_id;
    v_result := 'black_win';
  else
    v_remaining := v_game.black_time_ms;
    v_winner := v_game.white_player_id;
    v_result := 'white_win';
  end if;

  if v_remaining > v_elapsed then
    return false;
  end if;

  update public.games
  set status = 'completed',
      result = v_result,
      winner_id = v_winner,
      completed_at = now(),
      white_time_ms = case when v_turn = 'w' then 0 else white_time_ms end,
      black_time_ms = case when v_turn = 'b' then 0 else black_time_ms end
  where id = p_game_id;

  return true;
end;
$body$;

revoke all on function public.claim_game_timeout(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_game_timeout(uuid, uuid) to service_role;

create or replace function public.apply_ranked_game_result(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_white_old integer;
  v_black_old integer;
  v_white_new integer;
  v_black_new integer;
  v_white_score numeric;
  v_expected numeric;
begin
  select * into v_game
  from public.games g
  where g.id = p_game_id
  for update;

  if not found
     or v_game.status <> 'completed'
     or not v_game.is_ranked
     or v_game.rating_applied_at is not null
     or v_game.rating_type is null
     or v_game.result not in ('white_win', 'black_win', 'draw') then
    return;
  end if;

  if v_game.rating_type = 'bullet' then
    select bullet_rating into v_white_old from public.profiles where id = v_game.white_player_id;
    select bullet_rating into v_black_old from public.profiles where id = v_game.black_player_id;
  elsif v_game.rating_type = 'blitz' then
    select blitz_rating into v_white_old from public.profiles where id = v_game.white_player_id;
    select blitz_rating into v_black_old from public.profiles where id = v_game.black_player_id;
  else
    select rapid_rating into v_white_old from public.profiles where id = v_game.white_player_id;
    select rapid_rating into v_black_old from public.profiles where id = v_game.black_player_id;
  end if;

  if v_white_old is null or v_black_old is null then
    raise exception 'Player ratings are unavailable.';
  end if;

  v_white_score := case v_game.result
    when 'white_win' then 1
    when 'black_win' then 0
    else 0.5
  end;

  v_expected := 1 / (1 + power(10::numeric, (v_black_old - v_white_old)::numeric / 400));
  v_white_new := greatest(0, round(v_white_old + 32 * (v_white_score - v_expected))::integer);
  v_black_new := greatest(0, round(v_black_old + 32 * ((1 - v_white_score) - (1 - v_expected)))::integer);

  if v_game.rating_type = 'bullet' then
    update public.profiles set bullet_rating = v_white_new where id = v_game.white_player_id;
    update public.profiles set bullet_rating = v_black_new where id = v_game.black_player_id;
  elsif v_game.rating_type = 'blitz' then
    update public.profiles set blitz_rating = v_white_new where id = v_game.white_player_id;
    update public.profiles set blitz_rating = v_black_new where id = v_game.black_player_id;
  else
    update public.profiles set rapid_rating = v_white_new where id = v_game.white_player_id;
    update public.profiles set rapid_rating = v_black_new where id = v_game.black_player_id;
  end if;

  update public.profiles
  set games_played = games_played + 1,
      wins = wins + case when v_game.result = 'white_win' then 1 else 0 end,
      losses = losses + case when v_game.result = 'black_win' then 1 else 0 end,
      draws = draws + case when v_game.result = 'draw' then 1 else 0 end
  where id = v_game.white_player_id;

  update public.profiles
  set games_played = games_played + 1,
      wins = wins + case when v_game.result = 'black_win' then 1 else 0 end,
      losses = losses + case when v_game.result = 'white_win' then 1 else 0 end,
      draws = draws + case when v_game.result = 'draw' then 1 else 0 end
  where id = v_game.black_player_id;

  insert into public.rating_history (player_id, game_id, old_rating, new_rating, rating_change, rating_type)
  values
    (v_game.white_player_id, v_game.id, v_white_old, v_white_new, v_white_new - v_white_old, v_game.rating_type),
    (v_game.black_player_id, v_game.id, v_black_old, v_black_new, v_black_new - v_black_old, v_game.rating_type);

  update public.games set rating_applied_at = now() where id = v_game.id;
end;
$$;

revoke all on function public.apply_ranked_game_result(uuid) from public, anon, authenticated;
grant execute on function public.apply_ranked_game_result(uuid) to service_role;

create or replace function public.settle_ranked_game_after_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    perform public.apply_ranked_game_result(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists settle_ranked_game_after_completion on public.games;
create trigger settle_ranked_game_after_completion
after update of status on public.games
for each row execute function public.settle_ranked_game_after_completion();

commit;
