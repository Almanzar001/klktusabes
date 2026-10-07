-- Realtime para las salas multijugador.
-- En Supabase la app usaba postgres_changes (publicación supabase_realtime) y
-- canales broadcast. En InsForge los cambios de tablas se publican con triggers
-- hacia canales, y los clientes publican eventos al mismo canal.
--
--   room:<room_id>       players_changed | room_changed | game_session_changed
--                        + eventos de cliente: game_state_sync, player_answer
--   session:<session_id> answers_changed

INSERT INTO realtime.channels (pattern, description, enabled)
VALUES
  ('room:%', 'Sala multijugador: cambios de jugadores, sala, sesión y sincronización del juego', true),
  ('session:%', 'Respuestas de jugadores de una sesión de juego', true)
ON CONFLICT (pattern) DO UPDATE
SET description = EXCLUDED.description,
    enabled = EXCLUDED.enabled;

-- Publica el cambio de una fila con la misma forma que postgres_changes
-- ({ eventType, new, old }). Argumentos del trigger:
--   TG_ARGV[0] prefijo del canal, TG_ARGV[1] columna con el id, TG_ARGV[2] nombre del evento
CREATE OR REPLACE FUNCTION public.publish_table_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  new_row jsonb;
  old_row jsonb;
  channel_key text;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    new_row := to_jsonb(NEW);
  END IF;
  IF TG_OP <> 'INSERT' THEN
    old_row := to_jsonb(OLD);
  END IF;

  channel_key := COALESCE(new_row, old_row)->>TG_ARGV[1];
  IF channel_key IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM realtime.publish(
    TG_ARGV[0] || ':' || channel_key,
    TG_ARGV[2],
    jsonb_build_object(
      'eventType', TG_OP,
      'table', TG_TABLE_NAME,
      'new', new_row,
      'old', old_row
    )
  );

  RETURN NULL;
END;
$function$;

CREATE TRIGGER players_realtime
AFTER INSERT OR UPDATE OR DELETE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.publish_table_change('room', 'room_id', 'players_changed');

CREATE TRIGGER rooms_realtime
AFTER UPDATE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.publish_table_change('room', 'id', 'room_changed');

CREATE TRIGGER game_sessions_realtime
AFTER INSERT OR UPDATE OR DELETE ON public.game_sessions
FOR EACH ROW EXECUTE FUNCTION public.publish_table_change('room', 'room_id', 'game_session_changed');

CREATE TRIGGER player_answers_realtime
AFTER INSERT OR UPDATE OR DELETE ON public.player_answers
FOR EACH ROW EXECUTE FUNCTION public.publish_table_change('session', 'session_id', 'answers_changed');
