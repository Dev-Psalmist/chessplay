-- 0003: clocks for online games (10, 15, 25 minutes and 3 days per move)
-- Additive only: existing games keep working, clocks simply start NULL.

alter table public.games
  add column if not exists time_control text,
  add column if not exists base_time_ms integer,
  add column if not exists increment_ms integer not null default 0,
  add column if not exists white_time_ms integer,
  add column if not exists black_time_ms integer,
  add column if not exists last_move_at timestamptz;

-- A game only counts down once it is active.
update public.games
   set last_move_at = coalesce(last_move_at, started_at)
 where status = 'active'
   and last_move_at is null;

create or replace function public.set_game_clock(p_game_id uuid, p_time_control text)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_base integer;
begin
  v_base := case p_time_control
    when '10' then 10 * 60 * 1000
    when '15' then 15 * 60 * 1000
    when '25' then 25 * 60 * 1000
    when '3d' then 3 * 24 * 60 * 60 * 1000
    else null
  end;

  if v_base is null then
    raise exception 'unknown time control %', p_time_control;
  end if;

  update public.games
     set time_control = p_time_control,
         base_time_ms = v_base,
         white_time_ms = v_base,
         black_time_ms = v_base,
         last_move_at = coalesce(started_at, now())
   where id = p_game_id
     and status in ('waiting', 'active')
     and (white_player_id = auth.uid() or black_player_id = auth.uid())
  returning * into v_game;

  if v_game.id is null then
    raise exception 'game not found or not yours';
  end if;

  return v_game;
end;
$$;

grant execute on function public.set_game_clock(uuid, text) to authenticated;
