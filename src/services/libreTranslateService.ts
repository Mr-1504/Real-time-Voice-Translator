const AI_SERVER_URL = import.meta.env.AI_SERVER_URL || 'http://localhost:3000';

export async function translateSentence(
  text: string,
  sourceLang: string = 'en',
  _targetLang?: string
): Promise<string> {
  if (!text?.trim()) return '';

  // Chuẩn hóa 'vi-VN' -> 'vi', 'en-US' -> 'en'
  const shortLang = sourceLang.toLowerCase().startsWith('vi') ? 'vi' : 'en';

  try {
    const response = await fetch(`${AI_SERVER_URL}/api/translate-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text.trim(),
        source: shortLang,
      }),
    });

    if (!response.ok) {
      throw new Error(`VinAI Translate error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.translatedText || text;
  } catch (error) {
    console.error('Lỗi khi gọi VinAI Translate local:', error);
    return text;
  }
}

export const translateWithLibre = translateSentence;