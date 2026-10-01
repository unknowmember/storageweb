import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key không hợp lệ' }, { status: 401 });
    }

    const { data: keyData } = await supabase
      .from('user_api_keys')
      .select('user_id')
      .eq('api_key', apiKey)
      .single();

    if (!keyData) {
      return NextResponse.json({ error: 'API Key không hợp lệ' }, { status: 401 });
    }

    const { fileName, fileType } = await req.json();
    if (!fileName) {
      return NextResponse.json({ error: 'Thiếu fileName' }, { status: 400 });
    }

    const s3Key = `${Date.now()}_${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.FILEBASE_BUCKET_NAME!,
      Key: s3Key,
      ContentType: fileType || 'application/octet-stream',
    });

    // Tạo Presigned URL cho phép client đẩy file trực tiếp lên S3
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return NextResponse.json({
      success: true,
      uploadUrl,
      s3Key,
      fileUrl: `https://s3.filebase.io/${process.env.FILEBASE_BUCKET_NAME}/${s3Key}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}