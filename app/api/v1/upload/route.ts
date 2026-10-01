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

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu Header x-api-key' }, { status: 401 });
    }

    // Kiểm tra API Key hợp lệ
    const { data: keyData } = await supabase
      .from('user_api_keys')
      .select('user_id')
      .eq('api_key', apiKey)
      .single();

    if (!keyData) {
      return NextResponse.json({ error: 'API Key không hợp lệ' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'Chưa đính kèm file (field: file)' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const s3Key = `${Date.now()}_${file.name}`;

    // Upload lên S3
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.FILEBASE_BUCKET_NAME!,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      })
    );

    // Lưu thông tin vào Database
    const { data: fileRecord, error: dbErr } = await supabase
      .from('files')
      .insert([
        {
          name: file.name,
          size: file.size,
          s3_key: s3Key,
          user_id: keyData.user_id,
          url: `https://s3.filebase.io/${process.env.FILEBASE_BUCKET_NAME}/${s3Key}`,
        },
      ])
      .select()
      .single();

    if (dbErr) throw dbErr;

    return NextResponse.json({
      message: 'Upload thành công',
      file: fileRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}