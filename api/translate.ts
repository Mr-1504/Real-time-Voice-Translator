import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Chỉ chấp nhận request POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const backendUrl = process.env.TRANSLATE_API_URL;
    
    if (!backendUrl || backendUrl.trim() === '') {
      console.error('Lỗi: Chưa cấu hình biến TRANSLATE_API_URL trên Vercel');
      return res.status(500).json({ error: 'Missing Environment Variable: TRANSLATE_API_URL' });
    }

    // --- BƯỚC 3: THỰC THI FETCH API ---
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`Backend trả về mã lỗi ${response.status}:`, responseText);
      return res.status(response.status).json({ 
        error: `Backend Error: ${response.status}`, 
        details: responseText 
      });
    }

    // Chuyển đổi an toàn sang JSON
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