export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: Request) {
  try {
    const { userId, strategy, userInfo } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { error } = await supabase
      .from('profiles')
      .update({
        investment_strategy: strategy,
        investment_user_info: userInfo,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating investment strategy:', error);
    return NextResponse.json(
      { error: 'Failed to update investment strategy' },
      { status: 500 }
    );
  }
}
