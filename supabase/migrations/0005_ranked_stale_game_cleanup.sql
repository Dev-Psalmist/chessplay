-- 0005: Prevent expired or abandoned games from permanently blocking Ranked Arena.
-- Live timed games still block matchmaking. Expired timed games are adjudicated
-- through the existing timeout function so ranked ratings settle normally.
-- Untimed legacy games are abandoned only after 30 minutes of inactivity.

begin;

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
  v_active_game record;
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

  -- First adjudicate any active timed game belonging to this player.
  -- claim_game_timeout changes the game only when the side to move's clock
  -- has actually expired; otherwise the game remains active and blocks queueing.
  for v_active_game in
    select g.id
    from public.games g
    where g.status = 'active'
      and p_player_id in (g.white_player_id, g.black_player_id)
      and g.white_time_ms is not null
      and g.black_time_ms is not null
    for update
  loop
    perform public.claim_game_timeout(v_active_game.id, p_player_id);
  end loop;

  -- Legacy/untimed games have no authoritative clock to adjudicate. If they
  -- have had no activity for 30 minutes, close them as abandoned, not as wins.
  update public.games g
  set status = 'abandoned',
      result = 'abandoned',
      completed_at = coalesce(g.completed_at, now())
  where g.status = 'active'
    and p_player_id in (g.white_player_id, g.black_player_id)
    and (g.white_time_ms is null or g.black_time_ms is null)
    and coalesce(g.last_move_at, g.started_at, g.created_at)
        < now() - interval '30 minutes';

  -- A genuinely active game still prevents a second simultaneous game.
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

commit;
