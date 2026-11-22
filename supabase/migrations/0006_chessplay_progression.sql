-- 0006: ChessPlay progression, XP and achievements.
-- XP is awarded by a database trigger only after a real completed online game.
-- Unique transaction keys make retries and duplicate trigger calls harmless.

begin;

alter table public.profiles
  add column if not exists xp integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_xp_nonnegative;

alter table public.profiles
  add constraint profiles_xp_nonnegative check (xp >= 0);

create index if not exists idx_profiles_bullet_rating
  on public.profiles(bullet_rating desc);
create index if not exists idx_profiles_blitz_rating
  on public.profiles(blitz_rating desc);
create index if not exists idx_profiles_rapid_rating
  on public.profiles(rapid_rating desc);
create index if not exists idx_profiles_xp
  on public.profiles(xp desc);

create table if not exists public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  amount integer not null check (amount > 0),
  reason text not null check (reason in ('game_win', 'game_draw', 'game_loss')),
  transaction_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_xp_transactions_player
  on public.xp_transactions(player_id, created_at desc);

create table if not exists public.achievements (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.player_achievements (
  player_id uuid not null references public.profiles(id) on delete cascade,
  achievement_code text not null references public.achievements(code) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (player_id, achievement_code)
);

insert into public.achievements (code, name, description, icon)
values
  ('first_game', 'First Steps', 'Complete your first online game.', '♟'),
  ('first_win', 'First Victory', 'Win your first online game.', '🏆'),
  ('ten_games', 'Getting Serious', 'Complete 10 online games.', '⚔️'),
  ('fifty_games', 'Chess Regular', 'Complete 50 online games.', '🔥'),
  ('ten_wins', 'Double Digits', 'Win 10 online games.', '👑'),
  ('rating_1200', 'Rising Talent', 'Reach 1,200 in any ranked format.', '⭐')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon;

alter table public.xp_transactions enable row level security;
alter table public.achievements enable row level security;
alter table public.player_achievements enable row level security;

drop policy if exists "Players read their XP transactions" on public.xp_transactions;
create policy "Players read their XP transactions"
  on public.xp_transactions for select to authenticated
  using (player_id = (select auth.uid()));

drop policy if exists "Achievements are publicly readable" on public.achievements;
create policy "Achievements are publicly readable"
  on public.achievements for select
  using (true);

drop policy if exists "Player achievements are publicly readable" on public.player_achievements;
create policy "Player achievements are publicly readable"
  on public.player_achievements for select
  using (true);

grant select on public.xp_transactions to authenticated;
grant select on public.achievements, public.player_achievements to anon, authenticated;
revoke insert, update, delete on public.xp_transactions, public.achievements, public.player_achievements
  from anon, authenticated;

create or replace function public.award_chessplay_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid;
  v_amount integer;
  v_reason text;
  v_game_count integer;
  v_win_count integer;
begin
  if new.status <> 'completed'
     or old.status is not distinct from new.status
     or new.mode <> 'online'
     or new.result not in ('white_win', 'black_win', 'draw')
     or new.white_player_id is null
     or new.black_player_id is null then
    return new;
  end if;

  foreach v_player_id in array array[new.white_player_id, new.black_player_id]
  loop
    if new.result = 'draw' then
      v_amount := 25;
      v_reason := 'game_draw';
    elsif new.winner_id = v_player_id then
      v_amount := 50;
      v_reason := 'game_win';
    else
      v_amount := 15;
      v_reason := 'game_loss';
    end if;

    insert into public.xp_transactions (player_id, game_id, amount, reason, transaction_key)
    values (
      v_player_id,
      new.id,
      v_amount,
      v_reason,
      'game:' || new.id::text || ':player:' || v_player_id::text
    )
    on conflict (transaction_key) do nothing;

    if found then
      update public.profiles
      set xp = xp + v_amount
      where id = v_player_id;
    end if;

    select count(*)::integer
    into v_game_count
    from public.games g
    where g.status = 'completed'
      and g.mode = 'online'
      and g.result in ('white_win', 'black_win', 'draw')
      and v_player_id in (g.white_player_id, g.black_player_id);

    select count(*)::integer
    into v_win_count
    from public.games g
    where g.status = 'completed'
      and g.mode = 'online'
      and g.winner_id = v_player_id;

    insert into public.player_achievements (player_id, achievement_code)
    select v_player_id, a.code
    from public.achievements a
    where
      (a.code = 'first_game' and v_game_count >= 1)
      or (a.code = 'first_win' and v_win_count >= 1)
      or (a.code = 'ten_games' and v_game_count >= 10)
      or (a.code = 'fifty_games' and v_game_count >= 50)
      or (a.code = 'ten_wins' and v_win_count >= 10)
      or (
        a.code = 'rating_1200'
        and exists (
          select 1 from public.profiles p
          where p.id = v_player_id
            and greatest(p.bullet_rating, p.blitz_rating, p.rapid_rating) >= 1200
        )
      )
    on conflict (player_id, achievement_code) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists award_chessplay_progress_after_completion on public.games;
create trigger award_chessplay_progress_after_completion
  after update of status on public.games
  for each row execute function public.award_chessplay_progress();

-- Ranked ratings are settled by a separate game trigger. Watch profile ratings
-- too, so the 1,200 milestone is granted immediately after an Elo update.
create or replace function public.award_rating_milestone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if greatest(new.bullet_rating, new.blitz_rating, new.rapid_rating) >= 1200 then
    insert into public.player_achievements (player_id, achievement_code)
    values (new.id, 'rating_1200')
    on conflict (player_id, achievement_code) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists award_rating_milestone_after_profile_update on public.profiles;
create trigger award_rating_milestone_after_profile_update
  after update of bullet_rating, blitz_rating, rapid_rating on public.profiles
  for each row execute function public.award_rating_milestone();

-- Backfill milestones for players who already meet the conditions.
insert into public.player_achievements (player_id, achievement_code)
select p.id, 'rating_1200'
from public.profiles p
where greatest(p.bullet_rating, p.blitz_rating, p.rapid_rating) >= 1200
on conflict (player_id, achievement_code) do nothing;

commit;
