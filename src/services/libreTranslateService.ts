// Chuyển mã ngôn ngữ từ dạng Web Speech (vi-VN, en-US) sang dạng chuẩn ISO-639-1 của LibreTranslate (vi, en)
function normalizeLangCode(code: string): string {
  return code.split('-')[0].toLowerCase();
}

export async function translateSentence(
  text: string,
  sourceLangCode: string,
  targetLangCode: string
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const source = normalizeLangCode(sourceLangCode);
  const target = normalizeLangCode(targetLangCode);

  if (source === target) return trimmed;

  try {
    const response = await fetch('/api-translate/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: trimmed,
        source: source,
        target: target,
        format: 'text',
      }),
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.translatedText || trimmed;
  } catch (error) {
    console.error('Lỗi khi gọi LibreTranslate self-host:', error);
    return trimmed; // Trả lại câu gốc nếu dịch lỗi
  }
}