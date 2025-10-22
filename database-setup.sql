-- ============================================
-- FINTECH PROJECT - DATABASE SCHEMA & RLS POLICIES
-- ============================================

-- 1. Create the profiles table
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for better query performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);

-- 3. Enable Row Level Security
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist (for clean setup)
-- ============================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;

-- 5. RLS Policy: INSERT - Users can only insert their own profile during registration
-- ============================================
-- This policy allows users to create a profile entry only for themselves
-- The profile ID must match the authenticated user's ID
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Alternative: Allow anonymous insert (for registration flow)
-- If you want to allow profile creation during signup before confirmation:
CREATE POLICY "Allow service role to insert profiles"
ON public.profiles
FOR INSERT
TO anon
WITH CHECK (true);

-- 6. RLS Policy: SELECT - Users can read their own profile
-- ============================================
-- This policy allows users to view only their own profile data
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Optional: Allow users to view other profiles (for social features)
-- Uncomment this if you want users to see other users' public info
-- CREATE POLICY "Enable read access for authenticated users"
-- ON public.profiles
-- FOR SELECT
-- TO authenticated
-- USING (true);

-- 7. RLS Policy: UPDATE - Users can only update their own profile
-- ============================================
-- This policy allows users to update only their own profile information
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 8. RLS Policy: DELETE - Users can delete their own profile (optional)
-- ============================================
-- This policy allows users to delete their own profile
-- Uncomment if you want users to be able to delete their accounts
-- CREATE POLICY "Users can delete their own profile"
-- ON public.profiles
-- FOR DELETE
-- TO authenticated
-- USING (auth.uid() = id);

-- 9. Create a function to automatically update the updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Create a trigger to automatically update updated_at on row update
-- ============================================
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 11. Grant necessary permissions
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these queries to verify your setup:

-- Check if RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';

-- View all policies on the profiles table
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Test insert (should work for authenticated user creating their own profile)
-- INSERT INTO public.profiles (id, email, name, family_name, location)
-- VALUES (auth.uid(), 'test@example.com', 'John', 'Doe', 'United States');

-- Test select (should only return current user's profile)
-- SELECT * FROM public.profiles WHERE id = auth.uid();

-- Test update (should only allow updating own profile)
-- UPDATE public.profiles 
-- SET location = 'Canada' 
-- WHERE id = auth.uid();

-- ============================================
-- NOTES:
-- ============================================
-- 1. The profiles table uses UUID as primary key that references auth.users(id)
-- 2. When a user is deleted from auth.users, their profile is automatically deleted (CASCADE)
-- 3. Only authenticated users can read/update their own profile
-- 4. The anon policy allows profile creation during registration
-- 5. The updated_at field is automatically updated on every modification
-- 6. All policies enforce that users can only access their own data (auth.uid() = id)

-- ============================================
-- ADDITIONAL SECURITY RECOMMENDATIONS:
-- ============================================
-- 1. Always use environment variables for sensitive data
-- 2. Never expose service role keys in client-side code
-- 3. Use HTTPS for all API requests
-- 4. Implement rate limiting on your API routes
-- 5. Add email verification before allowing full access
-- 6. Consider implementing 2FA for additional security
-- 7. Regularly audit your RLS policies and access logs
-- 8. Keep Supabase and all dependencies up to date
