import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function authenticateApiKey(req: Request) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) return null;

  const { data } = await supabase
    .from('user_api_keys')
    .select('user_id')
    .eq('api_key', apiKey)
    .single();

  return data ? data.user_id : null;
}

// GET /api/v1/files - Lấy danh sách file
export async function GET(req: Request) {
  try {
    const userId = await authenticateApiKey(req);
    if (!userId) {
      return NextResponse.json({ error: 'API Key không hợp lệ (x-api-key)' }, { status: 401 });
    }

    const { data: files, error } = await supabase
      .from('files')
      .select('id, name, size, s3_key, created_at, url')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, count: files.length, files });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/v1/files - Lưu bản ghi file sau khi đã upload S3
export async function POST(req: Request) {
  try {
    const userId = await authenticateApiKey(req);
    if (!userId) {
      return NextResponse.json({ error: 'API Key không hợp lệ' }, { status: 401 });
    }

    const { name, size, s3Key, url } = await req.json();

    const { data: fileRecord, error: dbErr } = await supabase
      .from('files')
      .insert([
        {
          name,
          size,
          s3_key: s3Key,
          user_id: userId,
          url,
        },
      ])
      .select()
      .single();

    if (dbErr) throw dbErr;

    return NextResponse.json({
      success: true,
      message: 'Lưu thông tin file thành công',
      file: fileRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}