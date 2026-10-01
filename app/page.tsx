'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');

  // Đăng ký / Đăng nhập
  const handleAuth = async (type: 'LOGIN' | 'SIGNUP') => {
    const action = type === 'LOGIN' 
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });
    
    const { data, error } = await action;
    if (error) alert(error.message);
    else setUser(data.user);
  };

  // Upload qua UI
  const handleUpload = async () => {
    if (!file || !user) return;
    const fileName = `${Date.now()}_${file.name}`;
    
    const { error } = await supabase.storage
      .from('files')
      .upload(fileName, file);

    if (error) {
      alert(error.message);
    } else {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${fileName}`;
      setDownloadUrl(url);
    }
  };

  return (
    <main className="p-8 max-w-md mx-auto font-sans">
      {!user ? (
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-bold">Login / Register</h1>
          <input className="border p-2 rounded" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          <input className="border p-2 rounded" type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          <div className="flex gap-2">
            <button className="bg-blue-500 text-white p-2 rounded w-1/2" onClick={() => handleAuth('LOGIN')}>Login</button>
            <button className="bg-green-500 text-white p-2 rounded w-1/2" onClick={() => handleAuth('SIGNUP')}>Register</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-bold">Upload File</h1>
          <p>Logged in as: {user.email}</p>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="bg-blue-600 text-white p-2 rounded" onClick={handleUpload}>Upload</button>

          {downloadUrl && (
            <div className="mt-4 p-2 bg-gray-100 rounded">
              <p className="font-semibold text-sm">Link tải cố định:</p>
              <a href={downloadUrl} target="_blank" className="text-blue-500 break-all text-xs">{downloadUrl}</a>
            </div>
          )}
        </div>
      )}
    </main>
  );
}