-- El creador de un juego puede ver y borrar los archivos de la carpeta de su
-- juego (`<id del juego>/...`) aunque no los haya subido él. Hace falta para las
-- imágenes cargadas con la llave de administrador, que quedan sin dueño, y para
-- que al borrar una pregunta no queden archivos sueltos de otro creador.

CREATE POLICY question_media_game_creator_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket = 'question-media'
    AND EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id::text = (storage.foldername(key))[1]
        AND games.created_by_user::text = (SELECT auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY question_media_game_creator_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket = 'question-media'
    AND EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id::text = (storage.foldername(key))[1]
        AND games.created_by_user::text = (SELECT auth.jwt() ->> 'sub')
    )
  );
