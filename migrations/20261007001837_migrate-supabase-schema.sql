-- Esquema de KLKTUSABES migrado desde Supabase (proyecto jpqecnckfnjritudlzzb).
-- Reproduce tablas, restricciones, índices, funciones, vistas, triggers y RLS
-- tal como estaban en el origen. Los datos se cargan aparte.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

CREATE TABLE public.user_profiles (
  id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'participante',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_profiles_role_check CHECK (role IN ('participante', 'creador'))
);

CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_user UUID,
  CONSTRAINT games_pkey PRIMARY KEY (id),
  CONSTRAINT games_created_by_user_fkey FOREIGN KEY (created_by_user) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL,
  text TEXT NOT NULL,
  options JSON NOT NULL,
  correct_answer INTEGER NOT NULL,
  time_limit INTEGER DEFAULT 30,
  order_number INTEGER NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE,
  CONSTRAINT questions_game_id_order_number_key UNIQUE (game_id, order_number),
  CONSTRAINT questions_correct_answer_check CHECK (correct_answer >= 0 AND correct_answer <= 3),
  CONSTRAINT questions_time_limit_check CHECK (time_limit >= 5 AND time_limit <= 120)
);

CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting',
  max_players INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by_user UUID,
  current_question_index INTEGER DEFAULT 0,
  CONSTRAINT rooms_pkey PRIMARY KEY (id),
  CONSTRAINT rooms_code_key UNIQUE (code),
  CONSTRAINT rooms_created_by_user_fkey FOREIGN KEY (created_by_user) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT rooms_max_players_check CHECK (max_players >= 2 AND max_players <= 50),
  CONSTRAINT rooms_status_check CHECK (status IN ('waiting', 'playing', 'show_results', 'finished'))
);

CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar VARCHAR(10) NOT NULL,
  score INTEGER DEFAULT 0,
  is_host BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE,
  CONSTRAINT players_room_id_name_key UNIQUE (room_id, name)
);

CREATE TABLE public.game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  room_id UUID,
  game_id UUID NOT NULL,
  current_question INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  CONSTRAINT game_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT game_sessions_room_id_key UNIQUE (room_id),
  CONSTRAINT game_sessions_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE,
  CONSTRAINT game_sessions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE
);

CREATE TABLE public.player_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL,
  question_id UUID NOT NULL,
  session_id UUID NOT NULL,
  answer INTEGER NOT NULL,
  time_to_answer INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT player_answers_pkey PRIMARY KEY (id),
  CONSTRAINT player_answers_player_id_question_id_session_id_key UNIQUE (player_id, question_id, session_id),
  CONSTRAINT player_answers_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE,
  CONSTRAINT player_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE,
  CONSTRAINT player_answers_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  CONSTRAINT player_answers_answer_check CHECK (answer >= 0 AND answer <= 3),
  CONSTRAINT player_answers_time_to_answer_check CHECK (time_to_answer > 0)
);

CREATE TABLE public.qr_game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  access_code VARCHAR(10) NOT NULL,
  game_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by_user UUID,
  max_participants INTEGER DEFAULT 50,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  CONSTRAINT qr_game_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT qr_game_sessions_access_code_key UNIQUE (access_code),
  CONSTRAINT qr_game_sessions_created_by_user_fkey FOREIGN KEY (created_by_user) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT qr_game_sessions_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE
);

CREATE TABLE public.qr_session_results (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  qr_session_id UUID NOT NULL,
  player_name VARCHAR(100) NOT NULL,
  total_score INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  avg_time NUMERIC(10,2) DEFAULT 0,
  game_data JSONB,
  completed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT qr_session_results_pkey PRIMARY KEY (id),
  CONSTRAINT unique_player_per_session UNIQUE (qr_session_id, player_name),
  CONSTRAINT qr_session_results_qr_session_id_fkey FOREIGN KEY (qr_session_id) REFERENCES public.qr_game_sessions(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

CREATE INDEX idx_game_sessions_game_id ON public.game_sessions USING btree (game_id);
CREATE INDEX idx_game_sessions_room_id ON public.game_sessions USING btree (room_id);
CREATE INDEX idx_games_created_at ON public.games USING btree (created_at DESC);
CREATE INDEX idx_games_created_by ON public.games USING btree (created_by_user);
CREATE INDEX idx_player_answers_player ON public.player_answers USING btree (player_id);
CREATE INDEX idx_player_answers_question ON public.player_answers USING btree (question_id);
CREATE INDEX idx_player_answers_session ON public.player_answers USING btree (session_id);
CREATE INDEX idx_players_is_host ON public.players USING btree (is_host) WHERE (is_host = true);
CREATE INDEX idx_players_room_id ON public.players USING btree (room_id);
CREATE INDEX idx_qr_sessions_active ON public.qr_game_sessions USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_qr_sessions_code ON public.qr_game_sessions USING btree (access_code);
CREATE INDEX idx_qr_sessions_created_by ON public.qr_game_sessions USING btree (created_by_user);
CREATE INDEX idx_qr_sessions_expires_at ON public.qr_game_sessions USING btree (expires_at);
CREATE INDEX idx_qr_results_leaderboard ON public.qr_session_results USING btree (qr_session_id, total_score DESC, avg_time);
CREATE INDEX idx_qr_session_results_completed ON public.qr_session_results USING btree (completed_at);
CREATE INDEX idx_qr_session_results_score ON public.qr_session_results USING btree (qr_session_id, total_score DESC);
CREATE INDEX idx_qr_session_results_session_id ON public.qr_session_results USING btree (qr_session_id);
CREATE INDEX idx_questions_game_id ON public.questions USING btree (game_id);
CREATE INDEX idx_questions_order ON public.questions USING btree (game_id, order_number);
CREATE INDEX idx_rooms_code ON public.rooms USING btree (code);
CREATE INDEX idx_rooms_created_at ON public.rooms USING btree (created_at DESC);
CREATE INDEX idx_rooms_question_sync ON public.rooms USING btree (id, current_question_index, created_at);
CREATE INDEX idx_rooms_status ON public.rooms USING btree (status);
CREATE INDEX idx_user_profiles_email ON public.user_profiles USING btree (email);
CREATE INDEX idx_user_profiles_role ON public.user_profiles USING btree (role);

-- ---------------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.calculate_points(is_correct boolean, time_to_answer integer)
RETURNS integer
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT is_correct THEN
    RETURN 0;
  END IF;

  -- Fórmula: 1000 puntos base dividido por (tiempo en segundos + 1)
  -- Máximo 1000 puntos, mínimo 50 puntos para respuestas correctas
  RETURN GREATEST(50, LEAST(1000, ROUND(1000.0 / (time_to_answer / 1000.0 + 1))));
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_unique_qr_code()
RETURNS character varying
LANGUAGE plpgsql
AS $function$
DECLARE
  new_code VARCHAR(10);
  code_exists BOOLEAN;
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INTEGER;
BEGIN
  LOOP
    new_code := '';

    -- Generar código de 10 caracteres
    FOR i IN 1..10 LOOP
      new_code := new_code || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
    END LOOP;

    -- Verificar si ya existe
    SELECT EXISTS(SELECT 1 FROM public.qr_game_sessions WHERE access_code = new_code) INTO code_exists;

    -- Si no existe, salir del loop
    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN new_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_unique_room_code()
RETURNS character varying
LANGUAGE plpgsql
AS $function$
DECLARE
  new_code VARCHAR(6);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generar código de 6 dígitos
    new_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

    -- Verificar si ya existe
    SELECT EXISTS(SELECT 1 FROM public.rooms WHERE code = new_code) INTO code_exists;

    -- Si no existe, salir del loop
    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN new_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- En Supabase leía NEW.raw_user_meta_data; en InsForge los metadatos de
-- registro/OAuth viven en auth.users.profile (name, avatar_url).
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.profile->>'full_name', NEW.profile->>'name'),
    NEW.profile->>'avatar_url',
    'participante'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER update_games_updated_at
BEFORE UPDATE ON public.games
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------

CREATE VIEW public.game_stats AS
SELECT g.id,
    g.title,
    g.description,
    count(q.id) AS total_questions,
    COALESCE(sum(q.time_limit), 0::bigint) AS total_time_seconds,
    g.created_at,
    up.full_name AS creator_name
   FROM public.games g
     LEFT JOIN public.questions q ON g.id = q.game_id
     LEFT JOIN public.user_profiles up ON g.created_by_user = up.id
  GROUP BY g.id, g.title, g.description, g.created_at, up.full_name;

CREATE VIEW public.room_stats AS
SELECT r.id,
    r.name,
    r.code,
    r.status,
    count(p.id) AS player_count,
    r.max_players,
    r.created_at
   FROM public.rooms r
     LEFT JOIN public.players p ON r.id = p.room_id
  GROUP BY r.id, r.name, r.code, r.status, r.max_players, r.created_at;

CREATE VIEW public.qr_session_stats AS
SELECT qgs.id AS session_id,
    qgs.title,
    qgs.access_code,
    qgs.is_active,
    COALESCE(qgs.max_participants, 50) AS max_participants,
    count(qsr.id) AS total_players,
    COALESCE(max(qsr.total_score), 0) AS best_score,
    COALESCE(round(avg(qsr.total_score::numeric), 0), 0::numeric) AS avg_score,
    COALESCE(round(avg(qsr.total_correct::numeric / NULLIF(qsr.total_questions, 0)::numeric * 100::numeric), 1), 0::numeric) AS avg_accuracy,
    qgs.created_at,
    COALESCE(qgs.expires_at, qgs.created_at + '24:00:00'::interval) AS expires_at
   FROM public.qr_game_sessions qgs
     LEFT JOIN public.qr_session_results qsr ON qgs.id = qsr.qr_session_id
  GROUP BY qgs.id, qgs.title, qgs.access_code, qgs.is_active, qgs.max_participants, qgs.created_at, qgs.expires_at;

-- ---------------------------------------------------------------------------
-- Row Level Security (mismas políticas que en el origen)
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_session_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Anyone can read games" ON public.games
  FOR SELECT USING (true);

CREATE POLICY "Creators can insert games" ON public.games
  FOR INSERT WITH CHECK (
    auth.uid() = created_by_user
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'creador'
    )
  );

CREATE POLICY "Creators can update their own games" ON public.games
  FOR UPDATE USING (auth.uid() = created_by_user);

CREATE POLICY "Anyone can read questions" ON public.questions
  FOR SELECT USING (true);

CREATE POLICY "Game creators can manage questions" ON public.questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = questions.game_id AND games.created_by_user = auth.uid()
    )
  );

CREATE POLICY "todo" ON public.questions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can access rooms" ON public.rooms
  FOR ALL USING (true);

CREATE POLICY "Anyone can access players" ON public.players
  FOR ALL USING (true);

CREATE POLICY "Anyone can access game sessions" ON public.game_sessions
  FOR ALL USING (true);

CREATE POLICY "Anyone can access player answers" ON public.player_answers
  FOR ALL USING (true);

CREATE POLICY "Anyone can read active QR sessions" ON public.qr_game_sessions
  FOR SELECT USING (is_active = true);

CREATE POLICY "Creators can manage their QR sessions" ON public.qr_game_sessions
  FOR ALL USING (
    auth.uid() = created_by_user
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'creador'
    )
  );

CREATE POLICY "Public can read QR session results" ON public.qr_session_results
  FOR SELECT USING (true);

CREATE POLICY "Insert only in active sessions" ON public.qr_session_results
  FOR INSERT WITH CHECK (
    player_name IS NOT NULL
    AND TRIM(BOTH FROM player_name) <> ''
    AND length(TRIM(BOTH FROM player_name)) >= 2
    AND EXISTS (
      SELECT 1 FROM public.qr_game_sessions
      WHERE qr_game_sessions.id = qr_session_results.qr_session_id
        AND qr_game_sessions.is_active = true
        AND (qr_game_sessions.expires_at IS NULL OR qr_game_sessions.expires_at > now())
    )
  );

CREATE POLICY "Users can update own QR results" ON public.qr_session_results
  FOR UPDATE USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Privilegios (las políticas RLS deciden las filas; esto habilita la operación)
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.user_profiles,
  public.games,
  public.questions,
  public.rooms,
  public.players,
  public.game_sessions,
  public.player_answers,
  public.qr_game_sessions,
  public.qr_session_results
TO anon, authenticated;

GRANT SELECT ON public.game_stats, public.room_stats, public.qr_session_stats TO anon, authenticated;
