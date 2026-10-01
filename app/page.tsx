'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface FileItem {
  id: string;
  name: string;
  size: number;
  url: string;
  created_at: string;
}

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      if (data.session?.user) fetchFiles();
    });
  }, []);

  const fetchFiles = async () => {
    const { data } = await supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setFiles(data);
  };

  const handleAuth = async (type: 'LOGIN' | 'SIGNUP') => {
    const action = type === 'LOGIN'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });

    const { data, error } = await action;
    if (error) alert(error.message);
    else {
      setUser(data.user);
      fetchFiles();
    }
  };

  // Upload hỗ trợ tính % tiến trình (XMLHttpRequest)
const handleUpload = async () => {
  if (!selectedFile) return;

  setUploadProgress(0);

  try {
    // 1. Lấy Presigned URL từ API
    const res = await fetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: selectedFile.name }),
    });

    const { uploadUrl, publicDownloadUrl, error } = await res.json();
    if (error) {
      alert('Lỗi khởi tạo upload: ' + error);
      setUploadProgress(null);
      return;
    }

    // 2. Upload file trực tiếp lên Filebase S3 qua XMLHttpRequest
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200 || xhr.status === 204) {
        // Lưu thông tin file vào Supabase
        await supabase.from('files').insert([
          {
            name: selectedFile.name,
            size: selectedFile.size,
            url: publicDownloadUrl,
          },
        ]);
        setUploadProgress(null);
        setSelectedFile(null);
        fetchFiles();
        alert('Tải lên thành công!');
      } else {
        alert(`Tải lên thất bại với mã lỗi HTTP: ${xhr.status}`);
        setUploadProgress(null);
      }
    };

    xhr.onerror = () => {
      alert('Lỗi kết nối / CORS khi tải lên Filebase!');
      setUploadProgress(null);
    };

    xhr.send(selectedFile);
  } catch (e: any) {
    alert('Lỗi: ' + e.message);
    setUploadProgress(null);
  }
};

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  // Thêm các hàm sau vào trong component chính của app/page.tsx

const [apiKey, setApiKey] = useState<string>('');

// Lấy/Tạo API Key
const fetchApiKey = async (userId: string) => {
  const res = await fetch('/api/user/api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json();
  if (data.apiKey) setApiKey(data.apiKey);
};

// Hàm Download chuẩn
const handleDownload = async (file: any) => {
  const s3Key = file.s3_key || file.url.split('/').pop();
  const res = await fetch('/api/download-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: s3Key }),
  });
  const { downloadUrl, error } = await res.json();
  if (error) {
    alert('Lỗi tải file: ' + error);
    return;
  }
  window.open(downloadUrl, '_blank');
};

// Hàm Xóa file
const handleDelete = async (file: any) => {
  if (!confirm(`Bạn có chắc muốn xóa ${file.name}?`)) return;

  const s3Key = file.s3_key || file.url.split('/').pop();

  // 1. Xóa trên S3
  await fetch('/api/delete-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: s3Key }),
  });

  // 2. Xóa trong DB Supabase
  await supabase.from('files').delete().eq('id', file.id);

  fetchFiles(); // Reload lại danh sách
};

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl w-full max-w-md shadow-2xl">
          <h1 className="text-2xl font-bold mb-6 text-center text-blue-400">Storage Cloud</h1>
          <div className="space-y-4">
            <input
              className="w-full bg-gray-800 border border-gray-700 p-3 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="Email"
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full bg-gray-800 border border-gray-700 p-3 rounded-lg focus:outline-none focus:border-blue-500"
              type="password"
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="flex gap-3">
              <button className="w-1/2 bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-medium transition" onClick={() => handleAuth('LOGIN')}>Đăng nhập</button>
              <button className="w-1/2 bg-gray-800 hover:bg-gray-700 border border-gray-700 py-3 rounded-lg font-medium transition" onClick={() => handleAuth('SIGNUP')}>Đăng ký</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center bg-gray-900 p-6 rounded-xl border border-gray-800">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">File Manager</h1>
            <p className="text-sm text-gray-400">{user.email}</p>
          </div>
          <button
            onClick={() => { supabase.auth.signOut(); setUser(null); }}
            className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg text-sm hover:bg-red-500/20 transition"
          >
            Đăng xuất
          </button>
        </div>

        {/* Upload Box */}
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 space-y-4">
          <h2 className="text-lg font-semibold">Upload File Mới</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploadProgress !== null}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 px-6 py-2.5 rounded-lg font-medium transition whitespace-nowrap"
            >
              Tải lên
            </button>
          </div>

          {/* Thanh Tiến Trình % */}
          {uploadProgress !== null && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Đang tải lên...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* File List Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-lg font-semibold">Danh Sách File Đã Tải Lên</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/50 text-gray-400 uppercase text-xs border-b border-gray-800">
                <tr>
                  <th className="p-4">Tên File</th>
                  <th className="p-4">Kích thước</th>
                  <th className="p-4">Ngày tạo</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {files.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">Chưa có file nào được tải lên.</td>
                  </tr>
                ) : (
                  files.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-800/50 transition">
                      <td className="p-4 font-medium text-white max-w-xs truncate">{file.name}</td>
                      <td className="p-4 text-gray-400">{formatSize(file.size)}</td>
                      <td className="p-4 text-gray-400">{new Date(file.created_at).toLocaleDateString('vi-VN')}</td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(file.url)}
                          className="bg-gray-800 hover:bg-gray-700 text-xs px-3 py-1.5 rounded-md border border-gray-700 transition"
                        >
                          Copy Link
                        </button>
                        <a
                          href={file.url}
                          target="_blank"
                          download
                          className="bg-blue-600 hover:bg-blue-500 text-xs text-white px-3 py-1.5 rounded-md font-medium transition inline-block"
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}