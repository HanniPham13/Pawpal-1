-- Run this in the Supabase SQL Editor to fix chat deletion

-- Add missing DELETE policy on user_conversations
DROP POLICY IF EXISTS "Users can delete their own conversation memberships" ON public.user_conversations;
CREATE POLICY "Users can delete their own conversation memberships"
    ON public.user_conversations FOR DELETE
    USING (user_id = auth.uid());
