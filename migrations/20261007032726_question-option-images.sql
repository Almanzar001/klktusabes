-- Respuestas con imagen (por ejemplo, las figuras de un test de CI).
--
-- Una entrada por respuesta, en el mismo orden que `options`: null si esa
-- respuesta es solo texto, o {"url": ..., "key": ...} con la URL para mostrarla
-- y la clave para borrarla del bucket `question-media`. El texto de una
-- respuesta que tiene imagen puede quedar vacío.

ALTER TABLE public.questions
  ADD COLUMN option_images JSONB;
