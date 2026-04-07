-- Resolve auth.users ids by email for edge-function cleanup (service_role only).
-- listUsers pagination in the cleanup function can miss accounts in larger projects.

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
