import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: 'https://s3.filebase.io', // Endpoint S3 chuẩn của Filebase
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY!,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY!,
  },
});

export async function POST(req: Request) {
  try {
    const { fileName } = await req.json();
    const uniqueFileName = `${Date.now()}_${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.FILEBASE_BUCKET_NAME!,
      Key: uniqueFileName,
    });

    // Tạo Presigned URL hết hạn sau 1 giờ
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    
    // URL tải public qua S3 endpoint hoặc IPFS Gateway của Filebase
    const publicDownloadUrl = `https://s3.filebase.io/${process.env.FILEBASE_BUCKET_NAME}/${uniqueFileName}`;

    return NextResponse.json({ uploadUrl, publicDownloadUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}