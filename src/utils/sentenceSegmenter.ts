import nlp from 'compromise';

// Tập hợp các từ gây dở dang câu (giới từ, liên từ, mạo từ, động từ tobe ở cuối)
const DANGLING_WORDS = new Set([
  'from', 'to', 'and', 'because', 'but', 'or', 'so', 'with', 'in', 'on', 'at', 'by', 'of', 'for', 'about',
  'is', 'are', 'am', 'was', 'were', 'the', 'a', 'an', 'that', 'which', 'i', 'he', 'she', 'it', 'they', 'we'
]);

export function processTranscriptBuffer(
  buffer: string, 
  langCode: string
): { completeSentences: string[]; remainingBuffer: string } {
  const text = buffer.trim();
  if (!text) return { completeSentences: [], remainingBuffer: '' };

  const isEnglish = langCode.startsWith('en');
  const words = text.split(/\s+/);
  const completeSentences: string[] = [];
  let remainingBuffer = text;

  if (isEnglish) {
    const doc = nlp(text);
    // Phân tách theo mệnh đề (clauses) thay vì ép ngắt câu cứng nhắc
    const clauses = doc.clauses().out('array') as string[];

    if (clauses.length > 0) {
      for (const clause of clauses) {
        const clauseDoc = nlp(clause);
        const hasVerb = clauseDoc.match('#Verb').found;
        const hasNoun = clauseDoc.match('#Noun').found || clauseDoc.match('#Pronoun').found;

        const terms = clauseDoc.terms().out('array');
        const lastWord = terms.length > 0 ? terms[terms.length - 1].toLowerCase().replace(/[^\w\s]/g, '') : '';

        // Chốt câu NẾU: Đủ Chủ - Vị VÀ từ cuối cùng không phải là giới từ/liên từ dở dang
        if (hasVerb && hasNoun && !DANGLING_WORDS.has(lastWord)) {
          completeSentences.push(clause);
          remainingBuffer = remainingBuffer.substring(remainingBuffer.indexOf(clause) + clause.length).trim();
        } else {
          // Mệnh đề đang nói dở -> Dừng kiểm tra, giữ toàn bộ phần còn lại trong buffer
          break;
        }
      }
    }
  } else {
    // Tiếng Việt / Ngôn ngữ khác: Xử lý dồn cục (Run-on sentences)
    // Nếu bộ đệm tích tụ quá 15 từ mà chưa có khoảng lặng, cắt 12 từ đầu ra dịch trước để tránh nghẽn
    if (words.length >= 15) {
      const completeSentence = words.slice(0, 12).join(' ');
      completeSentences.push(completeSentence);
      remainingBuffer = words.slice(12).join(' ');
    }
  }

  return { completeSentences, remainingBuffer };
}
