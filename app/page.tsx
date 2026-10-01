'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchFiles(user.id);
        fetchApiKey(user.id);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        fetchFiles(currentUser.id);
        fetchApiKey(currentUser.id);
      } else {
        setFiles([]);
        setApiKey('');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchApiKey = async (userId: string) => {
    try {
      const res = await fetch('/api/user/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.apiKey) setApiKey(data.apiKey);
    } catch (e) {
      console.error('Lỗi lấy API Key:', e);
    }
  };

  const fetchFiles = async (userId?: string) => {
    const uid = userId || user?.id;
    if (!uid) return;

    const { data } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (data) setFiles(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Đăng nhập thất bại: ' + error.message);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert('Đăng ký thất bại: ' + error.message);
    else alert('Đã tạo tài khoản, hãy đăng nhập!');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/v1/files', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
        },
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        alert('Tải lên thành công!');
        setSelectedFile(null);
        setUploadProgress(null);
        fetchFiles();
      } else {
        alert('Lỗi: ' + (data.error || 'Upload thất bại'));
        setUploadProgress(null);
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
      setUploadProgress(null);
    }
  };

  const handleDownload = async (file: any) => {
    try {
      const res = await fetch(`/api/v1/files/${file.id}`, {
        headers: { 'x-api-key': apiKey },
      });
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      } else {
        alert('Không lấy được link tải: ' + (data.error || 'Lỗi hệ thống'));
      }
    } catch (err: any) {
      alert('Lỗi tải file: ' + err.message);
    }
  };

  const handleDelete = async (file: any) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa file "${file.name}"?`)) return;

    try {
      const res = await fetch(`/api/v1/files/${file.id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey },
      });
      const data = await res.json();
      if (data.success) {
        alert('Đã xóa file thành công!');
        fetchFiles();
      } else {
        alert('Lỗi khi xóa: ' + (data.error || 'Không thể xóa file'));
      }
    } catch (err: any) {
      alert('Lỗi xóa file: ' + err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Đã sao chép vào bộ nhớ tạm!');
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full shadow-2xl">
          <h1 className="text-2xl font-bold mb-6 text-center text-blue-400">File Storage System</h1>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Email</label>
              <input
                type="email"
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Mật khẩu</label>
              <input
                type="password"
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                onClick={handleLogin}
                className="flex-1 bg-blue-600 hover:bg-blue-500 font-semibold py-2 rounded transition"
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={handleSignUp}
                className="flex-1 bg-slate-800 hover:bg-slate-700 font-semibold py-2 rounded border border-slate-700 transition"
              >
                Đăng ký
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">File Manager</h1>
            <p className="text-sm text-slate-400">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 px-4 py-2 rounded-lg font-medium transition"
          >
            Đăng xuất
          </button>
        </div>

        {/* API Key Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2 text-slate-200">API Key Dùng Cho App Khác</h2>
          <div className="flex gap-3 items-center">
            <input
              type={showKey ? 'text' : 'password'}
              readOnly
              value={apiKey || 'Đang tải API Key...'}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 font-mono text-sm text-green-400 outline-none"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-sm border border-slate-700"
            >
              {showKey ? 'Ẩn' : 'Hiện'}
            </button>
            <button
              onClick={() => copyToClipboard(apiKey)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Sao chép
            </button>
          </div>
        </div>

        {/* Upload File Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-200">Upload File Mới</h2>
          <div className="flex gap-4 items-center">
            <input
              type="file"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploadProgress !== null}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white px-6 py-2 rounded-lg font-medium transition whitespace-nowrap"
            >
              {uploadProgress !== null ? 'Đang tải lên...' : 'Tải lên'}
            </button>
          </div>
        </div>

        {/* Danh sách File */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-200">Danh Sách File Đã Tải Lên</h2>
          {files.length === 0 ? (
            <p className="text-slate-500 text-sm">Chưa có file nào trong kho lưu trữ.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="border-b border-slate-800 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="py-3 px-4">Tên file</th>
                    <th className="py-3 px-4">Kích thước</th>
                    <th className="py-3 px-4">Ngày tạo</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-medium text-slate-200">{file.name}</td>
                      <td className="py-3 px-4">{formatSize(file.size)}</td>
                      <td className="py-3 px-4">
                        {new Date(file.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => copyToClipboard(file.url)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded text-xs border border-slate-700"
                        >
                          Copy Link
                        </button>
                        <button
                          onClick={() => handleDownload(file)}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-medium"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDelete(file)}
                          className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 px-3 py-1.5 rounded text-xs font-medium"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}