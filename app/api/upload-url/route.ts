import { S3Client, PutObjectCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: 'https://s3.filebase.com',
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY!,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY!,
  },
  forcePathStyle: true, // Ép dùng chuẩn path-style để thông CORS
});

export async function POST(req: Request) {
  try {
    const { fileName, fileType } = await req.json();
    const uniqueFileName = `${Date.now()}_${fileName}`;
    const contentType = fileType || 'application/octet-stream';

    // Đẩy luật CORS thẳng trực tiếp qua S3 API
    try {
      await s3.send(
        new PutBucketCorsCommand({
          Bucket: process.env.FILEBASE_BUCKET_NAME,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                AllowedOrigins: ['*'],
                ExposeHeaders: ['ETag'],
              },
            ],
          },
        })
      );
    } catch (e) {
      console.log('CORS auto-config skipped:', e);
    }

    const command = new PutObjectCommand({
      Bucket: process.env.FILEBASE_BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const publicDownloadUrl = `https://ipfs.filebase.io/ipfs/${uniqueFileName}`;

    return NextResponse.json({ uploadUrl, publicDownloadUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}