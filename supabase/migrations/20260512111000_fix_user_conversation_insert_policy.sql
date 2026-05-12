DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_conversations'
  ) THEN
    ALTER TABLE public.user_conversations ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can insert conversation memberships" ON public.user_conversations;
    CREATE POLICY "Users can insert conversation memberships"
      ON public.user_conversations
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;
