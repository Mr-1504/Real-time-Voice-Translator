import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // --- 1. BẬT CORS (Rất quan trọng để không bị chặn bởi trình duyệt) ---
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Chỉ hỗ trợ POST.' });
  }

  try {
    const backendUrl = process.env.TRANSLATE_API_URL;
    
    if (!backendUrl || backendUrl.trim() === '') {
      return res.status(500).json({ error: 'Chưa cấu hình biến TRANSLATE_API_URL' });
    }

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`LibreTranslate trả về mã lỗi ${response.status}:`, responseText);
      return res.status(response.status).json({ 
        error: `Backend Error: ${response.status}`, 
        details: responseText 
      });
    }

    const data = JSON.parse(responseText);
    return res.status(200).json(data);

  } catch (error: any) {
    console.error('Vercel Proxy Error:', error.message || error);
    return res.status(500).json({ 
      error: 'Không thể kết nối đến Backend', 
      details: error.message 
    });
  }
}