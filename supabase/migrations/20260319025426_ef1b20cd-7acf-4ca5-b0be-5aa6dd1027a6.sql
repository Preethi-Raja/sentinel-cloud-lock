
-- Drop the overly permissive policy
DROP POLICY "Allow registration insert" ON public.profiles;

-- Create a more restrictive policy: users can only insert their own profile
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
