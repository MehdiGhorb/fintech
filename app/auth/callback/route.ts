import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createSupabaseServerClient()
    
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) throw error

      return NextResponse.redirect(`${requestUrl.origin}/email-confirmed`)
    } catch (error: any) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/error?error=${encodeURIComponent(error.message)}`
      )
    }
  }

  // If no code, redirect to home
  return NextResponse.redirect(`${requestUrl.origin}/`)
}
