// Định danh người nói theo PRD (Speaker 1 / Speaker 2)
export type SpeakerId = 'speaker1' | 'speaker2';

// Cấu trúc một câu thoại hoàn chỉnh trong danh sách hội thoại
export interface TranscriptItem {
  id: string;                      // Khóa duy nhất (UUID hoặc timestamp)
  speaker: SpeakerId;              // Người nói hiện tại
  original: string;                // Văn bản gốc do Web Speech API nhận diện
  translated: string;              // Bản dịch do Gemini API trả về
  timestamp: string;               // Thời gian phát ngôn (HH:mm:ss)
  isTranslating?: boolean;         // Trạng thái đang gọi Gemini dịch
}

// Cấu hình ngôn ngữ dịch thuật
export interface LanguageOption {
  code: string;
  name: string;
}