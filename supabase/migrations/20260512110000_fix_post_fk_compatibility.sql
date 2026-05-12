DO $$
DECLARE
  notifications_post_fk TEXT;
  conversations_post_fk TEXT;
BEGIN
  -- notifications.post_id -> prefer public.posts(id), fallback public.post(id)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'post_id'
  ) THEN
    SELECT tc.constraint_name
    INTO notifications_post_fk
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.constraint_schema = kcu.constraint_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'notifications'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'post_id'
    LIMIT 1;

    IF notifications_post_fk IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.notifications DROP CONSTRAINT %I',
        notifications_post_fk
      );
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'posts'
    ) THEN
      ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'post'
    ) THEN
      ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES public.post(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- conversations.post_id -> prefer public.posts(id), fallback public.post(id)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'post_id'
  ) THEN
    SELECT tc.constraint_name
    INTO conversations_post_fk
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.constraint_schema = kcu.constraint_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'conversations'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'post_id'
    LIMIT 1;

    IF conversations_post_fk IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.conversations DROP CONSTRAINT %I',
        conversations_post_fk
      );
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'posts'
    ) THEN
      ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE SET NULL;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'post'
    ) THEN
      ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES public.post(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
