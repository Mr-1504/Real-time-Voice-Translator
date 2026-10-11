import type { TranscriptItem } from '../types';

/**
 * Xuất danh sách hội thoại ra Google Sheets qua Webhook Google Apps Script
 *
 * @param transcripts - Mảng các câu thoại đã ghi nhận
 * @param webhookUrl - URL triển khai Web App của Google Apps Script
 * @returns Promise<boolean> - Trả về true nếu gửi dữ liệu thành công
 */
export async function exportToGoogleSheets(
  transcripts: TranscriptItem[],
  webhookUrl: string
): Promise<boolean> {
  const cleanUrl = webhookUrl?.trim();

  // Kiểm tra tính hợp lệ trước khi gửi
  if (!cleanUrl) {
    throw new Error('Vui lòng nhập Google Apps Script Webhook URL.');
  }

  if (!transcripts || transcripts.length === 0) {
    throw new Error('Chưa có dữ liệu hội thoại nào để xuất.');
  }

  try {
    // Chuẩn hóa cấu trúc dữ liệu từng dòng
    const payload = transcripts.map((item) => ({
      timestamp: item.timestamp,
      speaker: item.speaker === 'speaker1' ? 'Speaker 1' : 'Speaker 2',
      original: item.original,
      translated: item.translated || '',
    }));

    // Sử dụng fetch với mode: 'no-cors' để tránh trình duyệt chặn CORS từ script.google.com
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        data: payload,
        exportedAt: new Date().toLocaleString('vi-VN'),
      }),
    });

    // Do mode là 'no-cors', trình duyệt nhận opaque response (status 0). Nếu không có Exception thrown thì request đã tới Apps Script thành công
    return true;
  } catch (error) {
    console.error('❌ [Sheets Service] Gặp sự cố khi gửi dữ liệu:', error);
    return false;
  }
}