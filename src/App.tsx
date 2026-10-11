import { useEffect, useState } from 'react';
import { translateSentence } from './services/geminiService';

export default function App() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [result, setResult] = useState<string>('');

  useEffect(() => {
    async function testGemini() {
      try {
        console.log('🔄 Đang gửi câu test đến Gemini...');
        const translated = await translateSentence(
          'Hello, this is a test sentence for voice translation.',
          'Tiếng Anh',
          'Tiếng Việt'
        );
        console.log('✅ Kết quả dịch:', translated);
        setResult(translated);
        setStatus('success');
      } catch (err) {
        console.error('❌ Lỗi test:', err);
        setStatus('error');
      }
    }

    testGemini();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h1 className="text-xl font-bold mb-4 text-center">Kiểm tra kết nối Gemini API</h1>
        
        <div className="mb-4 text-sm text-slate-400">
          Câu gốc: <span className="text-slate-200">"Hello, this is a test sentence for voice translation."</span>
        </div>

        {status === 'loading' && (
          <p className="text-yellow-400 animate-pulse">⏳ Đang gọi Gemini API, chờ chút...</p>
        )}

        {status === 'success' && (
          <div className="bg-emerald-950/50 border border-emerald-500/30 p-3 rounded-lg">
            <p className="text-emerald-400 font-semibold mb-1">🎉 Thành công! Bản dịch:</p>
            <p className="text-slate-100">{result}</p>
          </div>
        )}

        {status === 'error' && (
          <p className="text-red-400">❌ Có lỗi xảy ra. Hãy mở tab F12 Console để xem chi tiết.</p>
        )}
      </div>
    </div>
  );
}