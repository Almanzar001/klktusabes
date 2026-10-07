-- players.avatar era VARCHAR(10), pero los avatares SVG de la app se identifican
-- con nombres de hasta 15 caracteres ('yellow-sunshine', 'emerald-forest', ...).
-- Con esos avatares, crear o unirse a una sala fallaba con
-- "value too long for type character varying(10)".
ALTER TABLE public.players ALTER COLUMN avatar TYPE VARCHAR(50);
