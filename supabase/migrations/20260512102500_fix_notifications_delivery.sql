ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'is_read'
  ) THEN
    UPDATE public.notifications
    SET read = COALESCE(read, is_read, FALSE);
  ELSE
    UPDATE public.notifications
    SET read = COALESCE(read, FALSE);
  END IF;
END $$;

UPDATE public.notifications
SET read = FALSE
WHERE read IS NULL;

ALTER TABLE public.notifications
ALTER COLUMN read SET DEFAULT FALSE;

ALTER TABLE public.notifications
ALTER COLUMN read SET NOT NULL;

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
