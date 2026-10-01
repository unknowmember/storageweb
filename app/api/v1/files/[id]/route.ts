import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

// GET /api/v1/files/[id] - Lấy link tải Presigned URL
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await authenticateApiKey(req);
    if (!userId) {
      return NextResponse.json({ error: 'API Key không hợp lệ' }, { status: 401 });
    }

    // Await params theo chuẩn Next.js 15/16
    const { id } = await context.params;

    const { data: file } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 404 });
    }

    const s3Key = file.s3_key || file.url.split('/').pop();
    const command = new GetObjectCommand({
      Bucket: process.env.FILEBASE_BUCKET_NAME!,
      Key: s3Key,
    });

    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return NextResponse.json({ success: true, fileName: file.name, downloadUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/v1/files/[id] - Xóa file
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await authenticateApiKey(req);
    if (!userId) {
      return NextResponse.json({ error: 'API Key không hợp lệ' }, { status: 401 });
    }

    // Await params theo chuẩn Next.js 15/16
    const { id } = await context.params;

    const { data: file } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 404 });
    }

    const s3Key = file.s3_key || file.url.split('/').pop();

    // 1. Xóa trên Filebase S3
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.FILEBASE_BUCKET_NAME!,
        Key: s3Key,
      })
    );

    // 2. Xóa trong Database Supabase
    await supabase.from('files').delete().eq('id', id);

    return NextResponse.json({ success: true, message: 'Đã xóa file thành công' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}