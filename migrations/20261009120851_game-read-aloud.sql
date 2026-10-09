-- Trivias que la app lee en voz alta, pensadas para niños que aún no leen: al
-- abrirse cada pregunta se leen su texto y sus respuestas con la voz del dispositivo.

ALTER TABLE public.games
  ADD COLUMN read_aloud BOOLEAN NOT NULL DEFAULT false;
