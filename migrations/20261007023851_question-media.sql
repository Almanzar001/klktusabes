-- Imagen y sonido por pregunta.
--
-- Los archivos van al bucket público `question-media` de Storage (se crea con
-- `npx @insforge/cli storage create-bucket question-media`); en la base de datos
-- solo se guardan la URL para mostrarlos y la clave para poder borrarlos.

ALTER TABLE public.questions
  ADD COLUMN image_key TEXT,
  ADD COLUMN audio_url TEXT,
  ADD COLUMN audio_key TEXT;

-- Permisos del bucket. La app sube los archivos ya comprimidos (imágenes de unos
-- cientos de KB, audio de menos de 1 MB); el tope de 2 MB y la lista de formatos
-- evitan que se llene el almacenamiento saltándose esa compresión.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Solo los creadores suben archivos, y quedan a su nombre
CREATE POLICY question_media_creator_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket = 'question-media'
    AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
    AND size <= 2 * 1024 * 1024
    AND mime_type IN ('image/webp', 'image/jpeg', 'image/png', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav')
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id::text = (SELECT auth.jwt() ->> 'sub')
        AND user_profiles.role = 'creador'
    )
  );

-- Cada creador ve y borra sus propios archivos. La lectura pública de los
-- archivos no pasa por aquí: el bucket es público y se sirven por su URL.
CREATE POLICY question_media_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket = 'question-media'
    AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY question_media_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket = 'question-media'
    AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
  );

GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;
