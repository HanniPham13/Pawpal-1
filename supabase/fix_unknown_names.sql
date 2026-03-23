-- Fix existing "Unknown" full_name values in the users table
-- Replace them with the email prefix (part before @)
UPDATE users
SET full_name = split_part(email, '@', 1)
WHERE (full_name = 'Unknown' OR full_name = 'Unknown User' OR full_name = 'Other User' OR full_name IS NULL)
  AND email IS NOT NULL AND email != '';

-- Fix conversation titles that are "Unknown"
UPDATE conversations
SET title = NULL
WHERE title IN ('Unknown', 'Unknown User', 'Other User');

-- Fix adopter_name / owner_name that are "Unknown"
UPDATE conversations
SET adopter_name = NULL
WHERE adopter_name IN ('Unknown', 'Unknown User', 'Other User');

UPDATE conversations
SET owner_name = NULL
WHERE owner_name IN ('Unknown', 'Unknown User', 'Other User');

-- Fix profiles table if full_name is "Unknown"
UPDATE profiles
SET full_name = (
  SELECT split_part(u.email, '@', 1)
  FROM users u
  WHERE u.user_id = profiles.id
  AND u.email IS NOT NULL AND u.email != ''
)
WHERE full_name = 'Unknown' OR full_name = 'Unknown User';
