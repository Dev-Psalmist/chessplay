-- ==========================================
-- CHESS PLAY
-- INITIAL DATABASE SCHEMA
-- ==========================================

-- 1. PLAYER PROFILES
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,

    -- Chess rating and competitive statistics
    rating INTEGER NOT NULL DEFAULT 1000,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,

    -- Separate reward-point system
    reward_points INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_rating CHECK (rating >= 0),
    CONSTRAINT valid_reward_points CHECK (reward_points >= 0),
    CONSTRAINT valid_statistics CHECK (
        games_played >= 0
        AND wins >= 0
        AND losses >= 0
        AND draws >= 0
    )
);

-- 2. CHESS GAMES
CREATE TABLE public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    white_player_id UUID REFERENCES public.profiles(id),
    black_player_id UUID REFERENCES public.profiles(id),

    mode TEXT NOT NULL CHECK (
        mode IN ('online', 'computer', 'tournament')
    ),

    status TEXT NOT NULL DEFAULT 'waiting' CHECK (
        status IN ('waiting', 'active', 'completed', 'abandoned')
    ),

    result TEXT CHECK (
        result IN (
            'white_win',
            'black_win',
            'draw',
            'abandoned'
        )
    ),

    winner_id UUID REFERENCES public.profiles(id),

    pgn TEXT,
    final_fen TEXT,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT different_players CHECK (
        white_player_id IS NULL
        OR black_player_id IS NULL
        OR white_player_id <> black_player_id
    )
);

-- 3. PLAYER RATING HISTORY
CREATE TABLE public.rating_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id UUID NOT NULL REFERENCES public.profiles(id),
    game_id UUID REFERENCES public.games(id),

    old_rating INTEGER NOT NULL,
    new_rating INTEGER NOT NULL,
    rating_change INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. REWARD POINT TRANSACTIONS
CREATE TABLE public.point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id UUID NOT NULL REFERENCES public.profiles(id),
    game_id UUID REFERENCES public.games(id),

    reason TEXT NOT NULL CHECK (
        reason IN (
            'match_win',
            'match_loss',
            'match_draw',
            'tournament_win',
            'tournament_reward',
            'adjustment'
        )
    ),

    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,

    transaction_key TEXT UNIQUE NOT NULL,
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TOURNAMENTS
CREATE TABLE public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,
    description TEXT,

    format TEXT NOT NULL DEFAULT 'swiss' CHECK (
        format IN ('swiss', 'single_elimination')
    ),

    status TEXT NOT NULL DEFAULT 'registration' CHECK (
        status IN (
            'registration',
            'upcoming',
            'in_progress',
            'completed',
            'cancelled'
        )
    ),

    min_players INTEGER NOT NULL DEFAULT 20,
    max_players INTEGER,

    winner_id UUID REFERENCES public.profiles(id),

    prize_points INTEGER NOT NULL DEFAULT 100,

    registration_closes_at TIMESTAMPTZ,
    starts_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_min_players CHECK (min_players >= 20),
    CONSTRAINT valid_max_players CHECK (
        max_players IS NULL OR max_players >= min_players
    ),
    CONSTRAINT valid_prize CHECK (prize_points >= 0)
);

-- 6. TOURNAMENT PARTICIPANTS
CREATE TABLE public.tournament_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tournament_id UUID NOT NULL
        REFERENCES public.tournaments(id) ON DELETE CASCADE,

    player_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'registered' CHECK (
        status IN (
            'registered',
            'active',
            'eliminated',
            'champion'
        )
    ),

    final_position INTEGER,
    points_awarded INTEGER NOT NULL DEFAULT 0,

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tournament_id, player_id)
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX idx_profiles_rating
ON public.profiles(rating DESC);

CREATE INDEX idx_profiles_reward_points
ON public.profiles(reward_points DESC);

CREATE INDEX idx_games_white_player
ON public.games(white_player_id);

CREATE INDEX idx_games_black_player
ON public.games(black_player_id);

CREATE INDEX idx_games_status
ON public.games(status);

CREATE INDEX idx_rating_history_player
ON public.rating_history(player_id);

CREATE INDEX idx_point_transactions_player
ON public.point_transactions(player_id);

CREATE INDEX idx_tournaments_status
ON public.tournaments(status);

CREATE INDEX idx_tournament_players_tournament
ON public.tournament_players(tournament_id);

-- ==========================================
-- AUTOMATIC PROFILE CREATION
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        username,
        display_name
    )
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(NEW.raw_user_meta_data ->> 'username', ''),
            'player_' || REPLACE(NEW.id::TEXT, '-', '')::TEXT
        ),
        COALESCE(
            NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
            'Chess Player'
        )
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_players ENABLE ROW LEVEL SECURITY;

-- Public leaderboard and player profiles
CREATE POLICY "Profiles are publicly readable"
ON public.profiles
FOR SELECT
USING (true);

-- Players can update their own public profile fields only
CREATE POLICY "Players update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE, DELETE
ON public.profiles FROM anon, authenticated;

GRANT UPDATE (display_name, avatar_url)
ON public.profiles TO authenticated;

-- Players can see games they participate in
CREATE POLICY "Players view their games"
ON public.games
FOR SELECT
TO authenticated
USING (
    white_player_id = (SELECT auth.uid())
    OR black_player_id = (SELECT auth.uid())
);

-- Players can view their rating history
CREATE POLICY "Players view their ratings"
ON public.rating_history
FOR SELECT
TO authenticated
USING (player_id = (SELECT auth.uid()));

-- Players can view their point transactions
CREATE POLICY "Players view their transactions"
ON public.point_transactions
FOR SELECT
TO authenticated
USING (player_id = (SELECT auth.uid()));

-- Tournament information is publicly readable
CREATE POLICY "Tournaments are publicly readable"
ON public.tournaments
FOR SELECT
USING (true);

CREATE POLICY "Tournament participants are readable"
ON public.tournament_players
FOR SELECT
USING (true);

-- No direct client-side writes to competitive records.
-- Trusted server-side operations will manage these.
REVOKE INSERT, UPDATE, DELETE
ON public.games,
   public.rating_history,
   public.point_transactions,
   public.tournaments,
   public.tournament_players
FROM anon, authenticated;

-- ==========================================
-- END OF INITIAL SCHEMA
-- ==========================================