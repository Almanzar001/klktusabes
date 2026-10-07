-- Flujo de partida multijugador con la base de datos como única fuente de verdad.
--
-- La fila de rooms marca la fase de la partida:
--   waiting       sala de espera
--   playing       pregunta abierta (current_question_index, question_started_at)
--   show_results  respuesta correcta y marcador de la pregunta
--   finished      podio final
-- Los clientes pintan lo que diga esa fila (les llega por el evento room_changed)
-- y las respuestas se puntúan aquí, con el reloj del servidor.

ALTER TABLE public.rooms ADD COLUMN question_started_at TIMESTAMPTZ;

-- Hora del servidor, para que todos los dispositivos cuenten el mismo tiempo
CREATE OR REPLACE FUNCTION public.server_now()
RETURNS timestamptz
LANGUAGE sql
AS $function$
  SELECT clock_timestamp();
$function$;

-- Puntuación tipo Kahoot: hasta 1000 puntos por respuesta correcta; se pierde
-- hasta la mitad según lo que se tarde en responder. Incorrecta = 0.
CREATE OR REPLACE FUNCTION public.kahoot_points(is_correct boolean, time_ms integer, limit_ms integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN NOT is_correct THEN 0
    WHEN time_ms <= 500 THEN 1000
    ELSE GREATEST(500, round(1000 * (1 - (time_ms::numeric / limit_ms) / 2)))::integer
  END;
$function$;

-- Al abrir una pregunta se sella la hora de inicio con el reloj del servidor.
-- Se dejan unos segundos para mostrar la pregunta antes de habilitar las respuestas.
CREATE OR REPLACE FUNCTION public.stamp_question_start()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'playing'
     AND (OLD.status IS DISTINCT FROM 'playing'
          OR NEW.current_question_index IS DISTINCT FROM OLD.current_question_index) THEN
    NEW.question_started_at := clock_timestamp() + INTERVAL '4 seconds';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER rooms_stamp_question_start
BEFORE UPDATE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.stamp_question_start();

-- Valida y puntúa cada respuesta en el servidor: el cliente solo envía la opción
-- elegida. El tiempo de respuesta, si es correcta y los puntos se calculan aquí,
-- y se suman al marcador del jugador.
CREATE OR REPLACE FUNCTION public.score_player_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_game_id uuid;
  v_question public.questions%ROWTYPE;
  v_limit_ms integer;
  v_elapsed_ms integer;
BEGIN
  SELECT gs.game_id INTO v_game_id
  FROM public.game_sessions gs
  WHERE gs.id = NEW.session_id;

  SELECT r.* INTO v_room
  FROM public.rooms r
  JOIN public.game_sessions gs ON gs.room_id = r.id
  WHERE gs.id = NEW.session_id;

  IF v_room.id IS NULL OR v_room.status <> 'playing' OR v_room.question_started_at IS NULL THEN
    RAISE EXCEPTION 'La pregunta no está abierta';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = NEW.player_id AND p.room_id = v_room.id
  ) THEN
    RAISE EXCEPTION 'El jugador no pertenece a esta sala';
  END IF;

  SELECT q.* INTO v_question
  FROM public.questions q
  WHERE q.game_id = v_game_id
  ORDER BY q.order_number
  OFFSET v_room.current_question_index
  LIMIT 1;

  IF v_question.id IS NULL OR v_question.id <> NEW.question_id THEN
    RAISE EXCEPTION 'Esa pregunta ya no está activa';
  END IF;

  v_limit_ms := COALESCE(v_question.time_limit, 30) * 1000;
  v_elapsed_ms := floor(extract(epoch FROM (clock_timestamp() - v_room.question_started_at)) * 1000);

  IF v_elapsed_ms < 0 THEN
    RAISE EXCEPTION 'La pregunta todavía no empieza';
  END IF;

  -- margen para la latencia de red del último segundo
  IF v_elapsed_ms > v_limit_ms + 2000 THEN
    RAISE EXCEPTION 'Se acabó el tiempo';
  END IF;

  NEW.time_to_answer := GREATEST(1, LEAST(v_elapsed_ms, v_limit_ms));
  NEW.is_correct := (NEW.answer = v_question.correct_answer);
  NEW.points_earned := public.kahoot_points(NEW.is_correct, NEW.time_to_answer, v_limit_ms);
  NEW.answered_at := now();

  UPDATE public.players
  SET score = COALESCE(score, 0) + NEW.points_earned
  WHERE id = NEW.player_id;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER player_answers_score
BEFORE INSERT ON public.player_answers
FOR EACH ROW EXECUTE FUNCTION public.score_player_answer();
