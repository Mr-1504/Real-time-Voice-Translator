export interface WhisperResult {
  text: string;
}

/**
 * Gửi file ghi âm (Blob) sang Whisper Server để nhận diện hoặc dịch
 * @param audioBlob Dữ liệu âm thanh từ MediaRecorder
 * @param task 'transcribe' (chỉ gỡ băng + dấu câu) hoặc 'translate' (dịch sang tiếng Anh)
 * @param language Mã ngôn ngữ ('vi' hoặc 'en')
 */
export async function processAudioWithWhisper(
  audioBlob: Blob,
  task: 'transcribe' | 'translate' = 'transcribe',
  language?: string
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', 'base');
  formData.append('response_format', 'json');

  // Endpoint chuẩn OpenAI: /v1/audio/transcriptions hoặc /v1/audio/translations
  const endpoint = task === 'translate' 
    ? '/api-whisper/v1/audio/translations' 
    : '/api-whisper/v1/audio/transcriptions';

  if (language && task === 'transcribe') {
    formData.append('language', language);
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Whisper HTTP error: ${res.status}`);
    }

    const data: WhisperResult = await res.json();
    return data.text.trim();
  } catch (error) {
    console.error('Lỗi gọi Whisper:', error);
    return '';
  }
}