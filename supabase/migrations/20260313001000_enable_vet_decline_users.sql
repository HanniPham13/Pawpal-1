-- Allow vets/admins to decline pending user accounts and save decline reason.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS declined BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS declined_reason TEXT;

DROP POLICY IF EXISTS "Enable vet decline users" ON public.users;
CREATE POLICY "Enable vet decline users"
ON public.users FOR UPDATE
USING (
  role = 'user'
  AND COALESCE(verified, false) = false
  AND COALESCE(declined, false) = false
  AND EXISTS (
    SELECT 1
    FROM public.users reviewer
    WHERE reviewer.user_id = auth.uid()
      AND reviewer.role IN ('vet', 'admin')
  )
)
WITH CHECK (
  role = 'user'
  AND COALESCE(verified, false) = false
  AND COALESCE(declined, false) = true
  AND EXISTS (
    SELECT 1
    FROM public.users reviewer
    WHERE reviewer.user_id = auth.uid()
      AND reviewer.role IN ('vet', 'admin')
  )
);

COMMIT;
