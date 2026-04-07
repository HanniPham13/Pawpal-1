-- When a user is declined, log the reason.
-- The edge function handles the actual cleanup (profiles, users, auth.users).

-- 1) Keep a decline log so we can still show the reason after deletion.
CREATE TABLE IF NOT EXISTS public.decline_log (
  id bigserial PRIMARY KEY,
  user_id uuid,
  email text NOT NULL,
  reason text,
  declined_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decline_log_email_declined_at
  ON public.decline_log (lower(email), declined_at DESC);

-- Disable RLS on decline_log to allow inserts from authenticated users
ALTER TABLE public.decline_log DISABLE ROW LEVEL SECURITY;

-- 2) RPC used by the frontend to show the decline reason even after deletion.
CREATE OR REPLACE FUNCTION public.get_decline_reason(email_input text)
RETURNS TABLE (user_id uuid, reason text, declined_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT dl.user_id, dl.reason, dl.declined_at
  FROM public.decline_log dl
  WHERE lower(dl.email) = lower(trim(email_input))
  ORDER BY dl.declined_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_decline_reason(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_decline_reason(text) TO anon, authenticated;

-- 3) Trigger function to log declined users.
--    The edge function "decline-user-cleanup" handles actual deletion of
--    profiles, users, and auth.users via the admin API.
CREATE OR REPLACE FUNCTION public.handle_declined_user_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only act on transitions to declined=true.
  IF (COALESCE(OLD.declined, false) = false) AND (COALESCE(NEW.declined, false) = true) THEN
    INSERT INTO public.decline_log (user_id, email, reason, declined_at)
    VALUES (NEW.user_id, NEW.email, NEW.declined_reason, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_declined_cleanup ON public.users;
CREATE TRIGGER trg_users_declined_cleanup
AFTER UPDATE OF declined ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_declined_user_cleanup();

