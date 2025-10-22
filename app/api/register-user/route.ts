export const runtime = 'nodejs';

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: Request) {
  const formData = await request.json()
  const { 
    email, 
    password, 
    name,
    family_name,
    location
  } = formData

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Supabase configuration is missing.' },
      { status: 500 }
    )
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    // First sign up the user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          name: name,
          family_name: family_name,
          location: location
        }
      },
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user?.id) {
      return NextResponse.json(
        { error: 'User creation failed' },
        { status: 400 }
      )
    }
    
    // Insert profile data
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        { 
          id: authData.user.id,
          email: email,
          name: name,
          family_name: family_name,
          location: location,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])

    if (profileError) {
      console.error('Profile creation error:', profileError)
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        message: 'Registration successful! Please check your email for confirmation.',
        userId: authData.user.id
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status: 500 }
    )
  }
}
