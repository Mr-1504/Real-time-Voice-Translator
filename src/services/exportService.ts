import * as XLSX from 'xlsx';
import type { TranscriptItem } from '../types';

/**
 * Tạo tên file mặc định có dấu thời gian: Voice_Translation_YYYY-MM-DD_HH-mm.<ext>
 */
function getFormattedFileName(extension: 'xlsx' | 'csv'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `Voice_Translation_${year}-${month}-${day}_${hours}-${minutes}.${extension}`;
}

/**
 * Xử lý escape chuỗi an toàn cho định dạng CSV (tránh lỗi khi có dấu phẩy hoặc xuống dòng)
 */
function escapeCsvCell(cell: string): string {
  const str = cell ?? '';
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Xuất dữ liệu hội thoại ra file Excel (.xlsx) trực tiếp trên trình duyệt
 *
 * @param transcripts - Danh sách các câu thoại đã ghi nhận
 * @param fileName - Tên file tùy chọn (nếu để trống sẽ dùng tên mặc định kèm timestamp)
 */
export function exportToExcel(transcripts: TranscriptItem[], fileName?: string): void {
  if (!transcripts || transcripts.length === 0) {
    throw new Error('Chưa có câu thoại nào để xuất file.');
  }

  // 1. Chuẩn bị dữ liệu hiển thị theo 4 cột chuẩn
  const data = transcripts.map((item) => ({
    'Thời gian': item.timestamp,
    'Người nói': item.speaker === 'speaker1' ? 'Speaker 1' : 'Speaker 2',
    'Văn bản gốc': item.original,
    'Bản dịch': item.translated || '',
  }));

  // 2. Tạo worksheet từ mảng dữ liệu
  const worksheet = XLSX.utils.json_to_sheet(data);

  // 3. Đặt độ rộng các cột (cols width) để khi mở không bị che khuất chữ
  worksheet['!cols'] = [
    { wch: 14 }, // Cột Thời gian
    { wch: 14 }, // Cột Người nói
    { wch: 45 }, // Cột Văn bản gốc
    { wch: 45 }, // Cột Bản dịch
  ];

  // 4. Khởi tạo workbook và gắn worksheet vào
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hội thoại');

  // 5. Tự động tải file .xlsx về máy
  const finalFileName = fileName || getFormattedFileName('xlsx');
  XLSX.writeFile(workbook, finalFileName);
}

/**
 * Xuất dữ liệu hội thoại ra file CSV chuẩn UTF-8 có kèm BOM (\uFEFF)
 * đảm bảo mở trực tiếp trên Microsoft Excel không bị lỗi font/dấu tiếng Việt.
 *
 * @param transcripts - Danh sách các câu thoại
 * @param fileName - Tên file tùy chọn
 */
export function exportToCsv(transcripts: TranscriptItem[], fileName?: string): void {
  if (!transcripts || transcripts.length === 0) {
    throw new Error('Chưa có câu thoại nào để xuất file.');
  }

  // 1. Định nghĩa hàng tiêu đề
  const headers = ['Thời gian', 'Người nói', 'Văn bản gốc', 'Bản dịch'];

  // 2. Định nghĩa dữ liệu từng dòng
  const rows = transcripts.map((item) => [
    escapeCsvCell(item.timestamp),
    escapeCsvCell(item.speaker === 'speaker1' ? 'Speaker 1' : 'Speaker 2'),
    escapeCsvCell(item.original),
    escapeCsvCell(item.translated || ''),
  ]);

  // Ghép các dòng theo chuẩn CRLF
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\r\n');

  // 3. Thêm BOM (\uFEFF) để Excel trên Windows nhận diện đúng mã hóa UTF-8
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // 4. Kích hoạt tải về tự động
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || getFormattedFileName('csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}