-- Migration: Fix adoption_requests RLS policies and users table permissions
-- Root cause: "admins view adoption requests" policy queries public.users table,
-- but the users table RLS blocks the subquery, causing "permission denied for table users"
-- which cascades into "new row violates row-level security policy for table adoption_requests"

-- =============================================================================
-- STEP 1: Create a SECURITY DEFINER function to check admin/vet role
-- This bypasses RLS on the users table when called from within policies
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_or_vet(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = check_user_id
      AND role IN ('admin', 'vet')
  );
END;
$$;

-- =============================================================================
-- STEP 2: Grant SELECT on users table to authenticated role (belt and suspenders)
-- =============================================================================
GRANT SELECT ON public.users TO authenticated;

-- =============================================================================
-- STEP 3: Ensure adoption_requests table has correct columns
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'adoption_requests') THEN
    ALTER TABLE public.adoption_requests ADD COLUMN IF NOT EXISTS adoption_reason TEXT;
    ALTER TABLE public.adoption_requests ADD COLUMN IF NOT EXISTS pet_name TEXT;
    ALTER TABLE public.adoption_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- =============================================================================
-- STEP 4: Fix FK on post_id to reference the correct table
-- =============================================================================
DO $$
DECLARE
  posts_table TEXT;
  fk_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'posts') THEN
    posts_table := 'posts';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'post') THEN
    posts_table := 'post';
  ELSE
    RAISE NOTICE 'Neither posts nor post table found, skipping FK fix';
    RETURN;
  END IF;

  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'adoption_requests'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'post_id';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.adoption_requests DROP CONSTRAINT %I', fk_name);
  END IF;

  -- Delete orphaned adoption_requests whose post_id no longer exists
  EXECUTE format('DELETE FROM public.adoption_requests WHERE post_id NOT IN (SELECT id FROM public.%I)', posts_table);

  EXECUTE format('ALTER TABLE public.adoption_requests
    ADD CONSTRAINT adoption_requests_post_id_fkey
    FOREIGN KEY (post_id) REFERENCES public.%I(id) ON DELETE CASCADE', posts_table);
END $$;

-- =============================================================================
-- STEP 5: Drop ALL existing conflicting policies on adoption_requests
-- =============================================================================
DROP POLICY IF EXISTS "Users can create adoption requests" ON adoption_requests;
DROP POLICY IF EXISTS "Requesters can view their own requests" ON adoption_requests;
DROP POLICY IF EXISTS "Post owners can view adoption requests for their posts" ON adoption_requests;
DROP POLICY IF EXISTS "Post owners can update adoption requests" ON adoption_requests;
DROP POLICY IF EXISTS "Users can update their adoption requests" ON adoption_requests;
DROP POLICY IF EXISTS "Users can delete their pending adoption requests" ON adoption_requests;
-- THIS IS THE PROBLEMATIC POLICY that queries users table and causes the error:
DROP POLICY IF EXISTS "admins view adoption requests" ON adoption_requests;
DROP POLICY IF EXISTS "Enable admin access to adoption_requests" ON adoption_requests;

-- =============================================================================
-- STEP 6: Recreate clean RLS policies using the SECURITY DEFINER function
-- =============================================================================
ALTER TABLE public.adoption_requests ENABLE ROW LEVEL SECURITY;

-- INSERT: any authenticated user can create adoption requests
CREATE POLICY "Users can create adoption requests"
  ON adoption_requests FOR INSERT TO authenticated
  WITH CHECK (true);

-- SELECT: requester, owner, or admin/vet can view
CREATE POLICY "Users can view adoption requests"
  ON adoption_requests FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR owner_id = auth.uid()
    OR public.is_admin_or_vet(auth.uid())
  );

-- UPDATE: owner or admin/vet can update
CREATE POLICY "Owners can update adoption requests"
  ON adoption_requests FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_admin_or_vet(auth.uid())
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.is_admin_or_vet(auth.uid())
  );

-- DELETE: requester can delete their own pending requests
CREATE POLICY "Users can delete their pending adoption requests"
  ON adoption_requests FOR DELETE TO authenticated
  USING (requester_id = auth.uid() AND status = 'pending');

-- =============================================================================
-- STEP 7: Grant table-level permissions
-- =============================================================================
GRANT ALL ON public.adoption_requests TO authenticated;

-- =============================================================================
-- STEP 8: Fix adoption_applications table similarly (if it exists)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'adoption_applications') THEN
    EXECUTE 'DROP POLICY IF EXISTS "admins view adoption applications" ON adoption_applications';
    EXECUTE '
      CREATE POLICY "Users can view adoption applications"
        ON adoption_applications FOR SELECT TO authenticated
        USING (
          applicant_id = auth.uid()
          OR public.is_admin_or_vet(auth.uid())
        )';
  END IF;
END $$;

-- =============================================================================
-- STEP 9: Create reliable name lookup function (reads from auth.users metadata)
-- This is the single source of truth for user display names
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_display_name(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_name TEXT;
BEGIN
  -- Try profiles table first
  SELECT full_name INTO display_name
  FROM public.profiles
  WHERE id = target_user_id;

  IF display_name IS NOT NULL AND display_name != '' THEN
    RETURN display_name;
  END IF;

  -- Try users table
  SELECT full_name INTO display_name
  FROM public.users
  WHERE user_id = target_user_id;

  IF display_name IS NOT NULL AND display_name != '' THEN
    RETURN display_name;
  END IF;

  -- Fallback to auth.users metadata
  SELECT COALESCE(
    raw_user_meta_data->>'full_name',
    email
  ) INTO display_name
  FROM auth.users
  WHERE id = target_user_id;

  RETURN COALESCE(display_name, 'User');
END;
$$;
