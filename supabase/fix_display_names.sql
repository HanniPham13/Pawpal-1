-- ============================================
-- DEBUG: Run this in the Supabase SQL Editor
-- Copy/paste the results back so we can diagnose the "Unknown" name issue
-- ============================================

-- Check what columns the users table actually has
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public' ORDER BY ordinal_position;

-- Check what columns the profiles table has
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' AND table_schema = 'public' ORDER BY ordinal_position;

-- Check all users and their full_name values
SELECT user_id, full_name, email FROM public.users LIMIT 10;

-- Check all profiles and their full_name values
SELECT id, full_name FROM public.profiles LIMIT 10;

-- Check RLS policies on users table
SELECT policyname, permissive, cmd, qual FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public';

-- Check RLS policies on profiles table
SELECT policyname, permissive, cmd, qual FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public';

-- Check conversations current state
SELECT id, title, adopter_name, owner_name, pet_name FROM conversations LIMIT 10;

-- Check RLS policies on user_conversations table (for delete issue)
SELECT policyname, permissive, cmd, qual FROM pg_policies WHERE tablename = 'user_conversations' AND schemaname = 'public';
