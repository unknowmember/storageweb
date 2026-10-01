import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 });

    const { data: existing } = await supabase
      .from('user_api_keys')
      .select('api_key')
      .eq('user_id', userId)
      .single();

    if (existing) {
      return NextResponse.json({ apiKey: existing.api_key });
    }

    const newApiKey = 'sk_live_' + crypto.randomBytes(24).toString('hex');
    const { error } = await supabase
      .from('user_api_keys')
      .insert([{ user_id: userId, api_key: newApiKey }]);

    if (error) throw error;

    return NextResponse.json({ apiKey: newApiKey });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}