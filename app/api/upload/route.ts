import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key');
  // Cho phép upload nếu đúng API Key HOẶC request từ Giao diện Web
  const isWebUI = req.headers.get('x-client-web') === 'true';
  
  if (!isWebUI && apiKey !== process.env.API_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const fileName = `${Date.now()}_${file.name}`;
    const arrayBuffer = await file.arrayBuffer();

    // 1. Upload lên Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('files')
      .upload(fileName, Buffer.from(arrayBuffer), { contentType: file.type });

    if (storageError) throw storageError;

    const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${fileName}`;

    // 2. Lưu thông tin file vào Database
    await supabaseAdmin.from('files').insert([
      { name: file.name, size: file.size, url: fileUrl }
    ]);

    return NextResponse.json({ success: true, download_url: fileUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}