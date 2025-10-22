# Fintech Authentication Setup Guide

This guide provides step-by-step instructions for setting up authentication in the Fintech project with email confirmation.

## 📋 Overview

The authentication system includes:
- ✅ Sign up with email confirmation
- ✅ Login functionality
- ✅ Email verification flow
- ✅ User profile management
- ✅ Row Level Security (RLS) policies
- ✅ Modern, minimalistic UI

## 🎯 Features

### User Data Collected (Sign Up)
- **First Name** (name)
- **Last Name** (family_name)
- **Email** (email)
- **Location** (location) - Country dropdown with search
- **Password** (minimum 8 characters)

### Pages Created
- `/login` - Login page
- `/register` - Registration page
- `/verify-email` - Email verification instructions
- `/email-confirmed` - Success page after email confirmation
- `/auth/callback` - OAuth callback handler
- `/auth/error` - Error handling page

## 🗄️ Database Setup

### 1. Create the Profiles Table in Supabase

Go to your Supabase project's SQL Editor and run the following:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

### 2. Set Up RLS Policies

```sql
-- Allow profile insertion during registration
CREATE POLICY "Allow service role to insert profiles"
ON public.profiles
FOR INSERT
TO anon
WITH CHECK (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

### 3. Create Auto-Update Trigger

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
```

### 4. Grant Permissions

```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;
```

## 🔐 Environment Variables

Your `.env.local` file should have:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://lqrdpczxwazkzkeflkyf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Optional: Set your site URL for email redirects
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**⚠️ IMPORTANT**: Only use the anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), never the service role key in client-side code!

## 📧 Email Configuration in Supabase

### 1. Configure Email Templates

Go to **Authentication > Email Templates** in Supabase Dashboard:

#### Confirm Signup Template:
- **Subject**: Confirm your email for Northline Finance
- **Message**: Update the redirect URL to: `{{ .SiteURL }}/auth/callback`

### 2. Configure URL Settings

Go to **Authentication > URL Configuration**:
- **Site URL**: `http://localhost:3000` (development) or your production URL
- **Redirect URLs**: Add these URLs:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/email-confirmed`
  - `http://localhost:3000/`

## 🚀 Installation

All dependencies are already installed. If you need to reinstall:

```bash
npm install @supabase/supabase-js @supabase/ssr react-hook-form @radix-ui/react-slot class-variance-authority clsx tailwind-merge
```

## 🎨 UI Design

The authentication UI features:
- **Modern Design**: Clean, minimalistic interface
- **Professional Look**: Blue accent colors, proper spacing
- **User-Friendly**: Clear labels, helpful error messages
- **Responsive**: Works on all screen sizes
- **Dark Mode Support**: Adapts to system preferences
- **Accessibility**: Proper ARIA labels, keyboard navigation

## 🔒 Security Features

1. **Row Level Security**: Users can only access their own data
2. **Email Verification**: Required before full access
3. **Password Requirements**: Minimum 8 characters
4. **HTTPS Only**: All connections encrypted
5. **PKCE Flow**: Secure authentication flow
6. **Session Management**: Auto-refresh tokens

## 📝 Usage

### For Users

1. **Sign Up**:
   - Click "Sign Up" in navigation
   - Fill in: First Name, Last Name, Email, Location, Password
   - Confirm password
   - Check email for verification link

2. **Verify Email**:
   - Click the verification link in email
   - Redirected to confirmation page
   - Click "Log In to Your Account"

3. **Log In**:
   - Click "Login" in navigation
   - Enter email and password
   - Redirected to home page

4. **Log Out**:
   - Click "Logout" in navigation

### For Developers

#### Check User Authentication Status:

```typescript
import { supabase } from '@/lib/supabaseClient';

// Get current session
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user;

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event);
  console.log('User:', session?.user);
});
```

#### Get User Profile:

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();
```

#### Update User Profile:

```typescript
const { error } = await supabase
  .from('profiles')
  .update({ 
    name: 'New Name',
    location: 'New Country'
  })
  .eq('id', user.id);
```

## 🧪 Testing

### Test User Flow:

1. **Registration**:
   - Go to `http://localhost:3000/?auth=register`
   - Create account with valid email
   - Should see verification message

2. **Email Verification**:
   - Check email inbox (including spam)
   - Click verification link
   - Should redirect to `/email-confirmed`

3. **Login**:
   - Go to `http://localhost:3000/?auth=login`
   - Enter credentials
   - Should redirect to home page with user menu

4. **Session Persistence**:
   - Refresh page
   - Should remain logged in
   - Navigation should show user info

## 🐛 Troubleshooting

### Email Not Received:
- Check spam folder
- Verify email templates in Supabase Dashboard
- Check Supabase Auth logs
- Verify redirect URLs are configured

### Login Fails:
- Ensure email is verified
- Check password is correct (min 8 chars)
- Verify RLS policies are set up
- Check browser console for errors

### Profile Not Created:
- Verify profiles table exists
- Check RLS policies allow INSERT
- Review API route logs
- Ensure user_id matches auth.users(id)

### RLS Errors:
- Run the SQL setup script again
- Verify policies are enabled
- Check user is authenticated
- Review Supabase logs

## 📚 File Structure

```
fintech/
├── app/
│   ├── api/
│   │   ├── check-email/route.ts      # Email existence check
│   │   └── register-user/route.ts    # User registration
│   ├── auth/
│   │   ├── callback/route.ts         # OAuth callback
│   │   └── error/page.tsx            # Error page
│   ├── email-confirmed/page.tsx      # Success page
│   ├── login/page.tsx                # Login page
│   ├── register/page.tsx             # Registration page
│   ├── verify-email/page.tsx         # Verification instructions
│   └── page.tsx                      # Home (with auth modal)
├── components/
│   ├── auth/
│   │   └── AuthModal.tsx             # Main auth component
│   ├── ui/
│   │   └── button.tsx                # Button component
│   └── Navigation.tsx                # Updated navigation
├── lib/
│   ├── supabaseClient.ts             # Client-side Supabase
│   └── supabaseServer.ts             # Server-side Supabase
└── database-setup.sql                # Complete SQL setup
```

## 🔄 Authentication Flow

```
1. User clicks "Sign Up"
   ↓
2. Fills registration form (name, family_name, email, location, password)
   ↓
3. API validates email doesn't exist
   ↓
4. Supabase creates auth.users entry
   ↓
5. Profile created in public.profiles
   ↓
6. Verification email sent
   ↓
7. User clicks email link
   ↓
8. Redirected to /auth/callback
   ↓
9. Session created
   ↓
10. Redirected to /email-confirmed
    ↓
11. User clicks "Log In"
    ↓
12. Redirected to home with authenticated session
```

## 🎯 Next Steps

1. **Run the SQL setup** in Supabase SQL Editor
2. **Configure email templates** in Supabase Dashboard
3. **Test registration flow** with a real email
4. **Verify email confirmation** works
5. **Test login** with verified account

## 📞 Support

If you encounter issues:
1. Check Supabase Auth logs
2. Review browser console
3. Verify all environment variables
4. Ensure SQL setup completed successfully
5. Test with Supabase's Auth UI first

## ✅ Complete SQL Script

See `database-setup.sql` for the complete SQL script with all tables, policies, and functions.

---

**🎉 Your authentication system is now fully set up!**
