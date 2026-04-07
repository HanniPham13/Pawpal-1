-- Apply missing migrations for Pawpal
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/xnskynghatlhxplxcmal/sql

-- Migration 1: get_auth_user_ids_by_email function
CREATE OR REPLACE FUNCTION public.get_auth_user_ids_by_email(target_email text)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT array_agg(u.id)
      FROM auth.users u
      WHERE lower(u.email::text) = lower(trim(target_email))
    ),
    ARRAY[]::uuid[]
  );
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_ids_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_ids_by_email(text) TO service_role;

-- Migration 2: Decline log table and cleanup functions
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

-- RPC used by the frontend to show the decline reason even after deletion
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

-- Trigger function to log declined users
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

-- Migration 3: Visit counter table and functions
CREATE TABLE IF NOT EXISTS public.visit_counter (
  id boolean PRIMARY KEY DEFAULT true,
  count bigint NOT NULL DEFAULT 0
);

-- Disable RLS on visit_counter to allow the SECURITY DEFINER functions to work
ALTER TABLE public.visit_counter DISABLE ROW LEVEL SECURITY;

INSERT INTO public.visit_counter (id, count)
VALUES (true, 0)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.increment_visit_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_count bigint;
BEGIN
  INSERT INTO public.visit_counter (id, count)
  VALUES (true, 0)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.visit_counter
  SET count = count + 1
  WHERE id = true
  RETURNING count INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_visit_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT vc.count FROM public.visit_counter vc WHERE vc.id = true),
    0::bigint
  );
$$;

REVOKE ALL ON FUNCTION public.increment_visit_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_visit_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_visit_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_visit_count() TO anon, authenticated;
