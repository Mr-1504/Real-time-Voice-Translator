# Tech Stack & Architecture

## 1. Công nghệ chính
- **Framework:** Vite + React (TypeScript) -> Nhẹ, khởi động tức thì, tương thích tốt nhất khi vibe coding.
- **Styling:** Tailwind CSS + Lucide React (Icons).
- **Speech-to-Text:** Web Speech API (`webkitSpeechRecognition`) -> Có sẵn trên Chrome/Edge, 0đ, không phụ thuộc backend.
- **Translation Engine:** Google Gemini API (Model: `gemini-2.5-flash` hoặc `gemini-1.5-flash` qua SDK `@google/genai`).
- **State Management:** React `useState`, `useRef` (để kiểm soát stream nhận diện giọng nói không bị re-render thừa).

## 2. Luồng dữ liệu (Data Flow)
`Microphone` 
  ➜ `Web Speech API (Browser)` 
  ➜ `Final Sentence Event` 
  ➜ `Gemini API (Translate Prompt)` 
  ➜ `Update State (List: { id, speaker, original, translated, timestamp })` 
  ➜ `Render Split-Screen UI`

## 3. Cấu hình & Biến môi trường
- `VITE_GEMINI_API_KEY`: API Key lấy từ Google AI Studio (lưu trong file `.env.local`).