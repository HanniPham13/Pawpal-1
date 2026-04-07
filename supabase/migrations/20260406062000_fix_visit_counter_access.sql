BEGIN;

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

COMMIT;
