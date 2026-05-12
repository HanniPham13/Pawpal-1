-- Recreate functions to avoid parameter-name conflicts on existing signatures
DROP FUNCTION IF EXISTS public.get_user_display_name(UUID);
DROP FUNCTION IF EXISTS public.get_user_name(UUID);
DROP FUNCTION IF EXISTS public.get_user_email(UUID);

CREATE OR REPLACE FUNCTION public.get_user_name(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  resolved_name TEXT;
BEGIN
  SELECT NULLIF(TRIM(p.full_name), '')
  INTO resolved_name
  FROM public.profiles p
  WHERE p.id = user_id;

  IF resolved_name IS NOT NULL THEN
    RETURN resolved_name;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'full_name'
  ) THEN
    EXECUTE '
      SELECT NULLIF(TRIM(full_name), '''')
      FROM public.users
      WHERE user_id = $1
      LIMIT 1
    '
    INTO resolved_name
    USING user_id;

    IF resolved_name IS NOT NULL THEN
      RETURN resolved_name;
    END IF;
  END IF;

  SELECT
    COALESCE(
      NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(SPLIT_PART(u.email, '@', 1)), ''),
      NULLIF(TRIM(u.email), '')
    )
  INTO resolved_name
  FROM auth.users u
  WHERE u.id = user_id;

  RETURN COALESCE(resolved_name, 'User');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_display_name(user_uuid UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.get_user_name(user_uuid);
$$;

CREATE OR REPLACE FUNCTION public.get_user_email(user_id UUID)
RETURNS TABLE (email TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.email
  FROM auth.users u
  WHERE u.id = user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_name(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO anon, authenticated, service_role;
