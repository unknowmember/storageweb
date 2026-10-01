import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';

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
    const { key } = await req.json();
    if (!key) return NextResponse.json({ error: 'Missing file key' }, { status: 400 });

    const command = new DeleteObjectCommand({
      Bucket: process.env.FILEBASE_BUCKET_NAME!,
      Key: key,
    });

    await s3.send(command);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}