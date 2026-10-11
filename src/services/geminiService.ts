import { GoogleGenAI } from '@google/genai';

// Đọc API Key từ biến môi trường Vite (.env.local)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Kiểm tra sự tồn tại của API Key và cảnh báo sớm trong console nếu thiếu
if (!apiKey) {
  console.warn(
    '⚠️ [Gemini Service] Biến môi trường VITE_GEMINI_API_KEY chưa được khai báo trong file .env.local.'
  );
}

// Khởi tạo client GoogleGenAI theo chuẩn SDK @google/genai
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Lựa chọn model tối ưu độ trễ thấp nhất và chi phí phù hợp nhất cho hội thoại trực tiếp
const FLASH_MODEL = 'gemini-3-flash-preview';
/**
 * Dịch một câu thoại từ ngôn ngữ nguồn sang ngôn ngữ đích theo thời gian thực.
 *
 * @param text - Câu thoại gốc cần dịch
 * @param sourceLang - Ngôn ngữ nguồn (mặc định: "Tiếng Anh" hoặc mã ngôn ngữ "en")
 * @param targetLang - Ngôn ngữ đích (mặc định: "Tiếng Việt" hoặc mã ngôn ngữ "vi")
 * @returns Promise<string> - Chuỗi văn bản dịch hoặc văn bản gốc (nếu gặp lỗi)
 */
export async function translateSentence(
  text: string,
  sourceLang: string = 'Tiếng Anh',
  targetLang: string = 'Tiếng Việt'
): Promise<string> {
  const trimmedText = text?.trim();

  // Bỏ qua không gửi request nếu chuỗi rỗng
  if (!trimmedText) {
    return '';
  }

  try {
    // 1. Kiểm tra API Key và Client trước khi gửi yêu cầu
    if (!ai || !apiKey) {
      throw new Error(
        'VITE_GEMINI_API_KEY chưa được thiết lập. Vui lòng kiểm tra file .env.local và khởi động lại Vite dev server.'
      );
    }

    // 2. System Instruction được thiết kế nghiêm ngặt:
    // Chỉ trả về bản dịch thuần túy, tuyệt đối không giải thích ngữ pháp hay chào hỏi
    const systemInstruction = `Bạn là một phiên dịch viên hội thoại trực tiếp thời gian thực (Real-time Conversational Voice Translator).
Nhiệm vụ: Dịch chính xác câu thoại từ "${sourceLang}" sang "${targetLang}".
Quy tắc nghiêm ngặt:
1. CHỈ xuất ra duy nhất câu văn bản đã dịch.
2. TUYỆT ĐỐI KHÔNG thêm lời chào, giải thích ngữ pháp, ngữ cảnh hay bọc trong dấu ngoặc kép.
3. Giữ đúng sắc thái và ngữ điệu tự nhiên của văn phong nói (hội thoại thường ngày, từ lóng, cảm thán).
4. Giữ nguyên định dạng dấu câu và danh từ riêng.`;

    // 3. Gửi request đến Gemini Flash API
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: trimmedText,
      config: {
        systemInstruction,
        temperature: 0.3, // Nhiệt độ thấp đảm bảo bản dịch chuẩn xác, nhất quán và không suy diễn
      },
    });

    const translatedText = response.text?.trim();

    if (translatedText && translatedText.length > 0) {
      return translatedText;
    }

    // Trường hợp phản hồi rỗng từ API
    console.warn('⚠️ [Gemini Service] Phản hồi rỗng từ Gemini API. Fallback về câu gốc.');
    return trimmedText;
  } catch (error) {
    // Bắt và log lỗi mạng / lỗi xác thực API cẩn thận
    console.error('❌ [Gemini Service] Gặp sự cố khi dịch câu thoại:', error);

    // Fallback: Trả về câu gốc để không làm gián đoạn luồng hiển thị hội thoại của người dùng
    return trimmedText;
  }
}