-- Creación de trivias con IA.
--
-- Cada llamada al modelo cuesta dinero, así que solo los creadores pueden
-- hacerlas, hay un tope diario por persona y queda registro de lo que gastó
-- cada una. La función `generate-trivia` pide permiso con `ai_call_begin` antes
-- de llamar al modelo y anota el consumo con `ai_call_finish` al terminar.

CREATE TABLE public.ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,            -- 'questions' (escribir preguntas) o 'video' (ver un video)
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd NUMERIC(10, 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_calls_user_recent ON public.ai_calls (user_id, created_at DESC);

-- Cada quien ve su propio consumo; nadie escribe en la tabla directamente
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_calls FROM anon, authenticated;
GRANT SELECT ON public.ai_calls TO authenticated;

CREATE POLICY ai_calls_own_select ON public.ai_calls
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Pide permiso para una llamada al modelo. Falla si quien llama no es creador o
-- si ya gastó sus llamadas del día (una trivia de 30 preguntas usa 3 o 4).
CREATE FUNCTION public.ai_call_begin(p_action TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para usar la IA' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_user AND role = 'creador') THEN
    RAISE EXCEPTION 'Solo los creadores pueden crear trivias con IA' USING ERRCODE = '42501';
  END IF;

  IF (SELECT count(*) FROM public.ai_calls WHERE user_id = v_user AND created_at > now() - INTERVAL '24 hours') >= 60 THEN
    RAISE EXCEPTION 'Llegaste al límite de uso de la IA por hoy. Vuelve a intentarlo mañana.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ai_calls (user_id, action) VALUES (v_user, p_action) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Anota qué modelo se usó y cuánto consumió la llamada
CREATE FUNCTION public.ai_call_finish(
  p_id UUID,
  p_model TEXT,
  p_prompt_tokens INTEGER,
  p_completion_tokens INTEGER,
  p_cost_usd NUMERIC
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ai_calls
  SET model = p_model, prompt_tokens = p_prompt_tokens, completion_tokens = p_completion_tokens, cost_usd = p_cost_usd
  WHERE id = p_id AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.ai_call_begin(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ai_call_finish(UUID, TEXT, INTEGER, INTEGER, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_call_begin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_call_finish(UUID, TEXT, INTEGER, INTEGER, NUMERIC) TO authenticated;
