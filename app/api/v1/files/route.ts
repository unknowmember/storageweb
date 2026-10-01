import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: 'https://s3.filebase.io',
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY!,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY!,
  },
});

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

// POST /api/v1/files - Upload file
export async function POST(req: Request) {
  try {
    const userId = await authenticateApiKey(req);
    if (!userId) {
      return NextResponse.json({ error: 'API Key không hợp lệ (x-api-key)' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'Thiếu file trong form-data (field name: file)' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const s3Key = `${Date.now()}_${file.name}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.FILEBASE_BUCKET_NAME!,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      })
    );

    const { data: fileRecord, error: dbErr } = await supabase
      .from('files')
      .insert([
        {
          name: file.name,
          size: file.size,
          s3_key: s3Key,
          user_id: userId,
          url: `https://s3.filebase.io/${process.env.FILEBASE_BUCKET_NAME}/${s3Key}`,
        },
      ])
      .select()
      .single();

    if (dbErr) throw dbErr;

    return NextResponse.json({
      success: true,
      message: 'Upload file thành công',
      file: fileRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}