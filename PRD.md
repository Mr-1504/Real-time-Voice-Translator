# Product Requirement Document (PRD) - Real-time Voice Translator MVP

## 1. Mục tiêu sản phẩm
Xây dựng một Web App chạy trực tiếp trên trình duyệt, có khả năng lắng nghe hội thoại liên tục qua Microphone, tự động ngắt câu thành từng dòng, dịch từng câu sang ngôn ngữ đích theo thời gian thực và hiển thị song song 2 cột.

## 2. Người dùng mục tiêu
- Người tham gia các cuộc họp, phỏng vấn, hoặc giao tiếp đa ngôn ngữ cần phụ đề và bản dịch song song theo thời gian thực với chi phí 0đ.

## 3. Phạm vi tính năng MVP (Giai đoạn 1)
- **Audio Capture & STT:** Lắng nghe liên tục qua Microphone sử dụng Web Speech API của trình duyệt. Tự động nhận diện khi người nói kết thúc câu (onresult final).
- **Phân tách câu:** Mỗi câu hoàn chỉnh tạo ra một bản ghi riêng biệt với Timestamp và định danh Người nói (Speaker 1 / Speaker 2).
- **Dịch thuật qua Gemini API:** Gửi câu gốc lên Gemini Flash API để dịch sang ngôn ngữ mục tiêu (mặc định: Tiếng Anh sang Tiếng Việt hoặc ngược lại).
- **Giao diện Split-Screen (Chia đôi màn hình):**
  - Cột trái: Văn bản gốc (Original Transcript).
  - Cột phải: Bản dịch tương ứng (Translation).
  - Tự động cuộn xuống dưới cùng (Auto-scroll) khi có câu mới.
- **Quản lý phiên:** Nút "Bắt đầu ghi", "Tạm dừng", "Xóa", và nút "Đổi người nói (Speaker Toggle / Phím tắt Tab hoặc Space)".

## 4. Các tính năng mở rộng (Giai đoạn 2 - Backlog)
- Xuất dữ liệu ra Google Sheets hoặc file CSV/JSON.
- Phân biệt người nói tự động dựa trên phân tích âm thanh nâng cao.