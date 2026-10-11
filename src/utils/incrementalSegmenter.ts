import nlp from 'compromise';

// Các ngưỡng khởi đầu, chỉnh lại theo dữ liệu thật
export const THRESHOLDS = {
  stableMs: 300,          // transcript đứng yên bao lâu thì coi là ổn định
  completeSilenceMs: 500, // đoạn đủ nghĩa + lặng chừng ni thì chốt
  shortSilenceMs: 900,    // câu ngắn (< minCommitUnits) đủ nghĩa: chờ lâu hơn chút
  looseSilenceMs: 1500,   // câu tỉnh lược kiểu "Not really": không dở dang + lặng chừng ni thì chốt
  forceSilenceMs: 6000,   // người nói dừng hẳn mới ép chốt (kể cả đoạn dở dang)
  minCommitUnits: 4,      // số từ tối thiểu để chốt nhanh (không bắt buộc, có luật câu ngắn)
  minCommitUnitsCjk: 6,
  minDraftUnits: 3,       // số từ tối thiểu để dịch nháp
  minDraftUnitsCjk: 4,
  maxUnits: 30,           // buffer dài quá thì cắt bớt ở ranh giới mệnh đề
  maxUnitsCjk: 60,
} as const;

export interface SegmentDecision {
  commitCount: number;        // số token đầu buffer cần chốt (0 = chưa chốt)
  draftText: string | null;   // đoạn dịch nháp (chỉ có khi chưa chốt)
}

const CJK_LANGS = /^(ja|zh)/;

// Tiếng Anh: từ ở cuối mà xuất hiện thì câu chắc chắn còn dở
const EN_DANGLING = new Set([
  'and', 'but', 'or', 'so', 'because', 'if', 'although', 'though', 'when', 'while', 'since',
  'unless', 'until', 'as', 'than', 'that', 'which', 'who', 'whom', 'whose',
  'from', 'to', 'with', 'in', 'on', 'at', 'by', 'of', 'for', 'about', 'into', 'over', 'under',
  'the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'these', 'those',
  'is', 'are', 'am', 'was', 'were', 'be', 'been', 'will', 'would', 'can', 'could', 'should',
  'must', 'have', 'has', 'had', 'do', 'does', 'did', 'not',
  'i', 'he', 'she', 'it', 'they', 'we', 'you',
]);

// Tiếng Việt: liên từ, giới từ, trợ từ ở cuối
const VI_DANGLING = new Set([
  'và', 'nhưng', 'vì', 'bởi', 'nên', 'nếu', 'thì', 'mà', 'của', 'là', 'để', 'khi', 'rằng',
  'với', 'cho', 'trong', 'ở', 'tại', 'các', 'những', 'một', 'cái', 'không', 'đã', 'sẽ', 'đang',
  'hoặc', 'hay', 'tuy', 'dù', 'nhưng mà',
]);

export function isCjk(lang: string): boolean {
  return CJK_LANGS.test(lang);
}

// Tiếng Trung/Nhật không có khoảng trắng nên tách theo ký tự
export function tokenize(text: string, lang: string): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (isCjk(lang)) return Array.from(clean.replace(/\s+/g, ''));
  return clean.split(/\s+/);
}

export function joinTokens(tokens: string[], lang: string): string {
  return tokens.join(isCjk(lang) ? '' : ' ');
}

function isDangling(token: string | undefined, lang: string): boolean {
  if (!token || isCjk(lang)) return false;
  const word = token.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
  if (lang.startsWith('en')) return EN_DANGLING.has(word);
  if (lang.startsWith('vi')) return VI_DANGLING.has(word);
  return false;
}

// Cache kết quả kiểm tra mệnh đề, tránh parse compromise lặp lại mỗi tick
let completeKey = '';
let completeValue = false;

function isComplete(tokens: string[], lang: string): boolean {
  const text = joinTokens(tokens, lang);
  const key = `${lang}|${text}`;
  if (key === completeKey) return completeValue;

  let result: boolean;
  if (lang.startsWith('en')) {
    // Đủ chủ - vị thì mới coi là có nghĩa
    const doc = nlp(text);
    result = doc.match('#Verb').found && (doc.match('#Noun').found || doc.match('#Pronoun').found);
  } else {
    // Ngôn ngữ khác: chưa có bộ phân tích cú pháp, dựa vào độ dài tối thiểu
    result = tokens.length >= (isCjk(lang) ? THRESHOLDS.minCommitUnitsCjk : THRESHOLDS.minCommitUnits);
  }
  completeKey = key;
  completeValue = result;
  return result;
}

// Tìm ranh giới cắt an toàn khi buffer quá dài mà người nói chưa chịu nghỉ
function findCut(tokens: string[], lang: string): number {
  if (lang.startsWith('en')) {
    const text = joinTokens(tokens, lang);
    const clauses = nlp(text).clauses().out('array') as string[];
    for (let k = clauses.length - 1; k >= 1; k--) {
      const prefix = tokenize(clauses.slice(0, k).join(' '), lang);
      const count = prefix.length;
      if (count > 0 && count < tokens.length && !isDangling(tokens[count - 1], lang) && isComplete(prefix, lang)) {
        return count;
      }
    }
  }
  // Phương án dự phòng: chừa lại ~6 đơn vị cuối, lùi khỏi từ dở dang
  let cut = tokens.length - 6;
  while (cut > 0 && isDangling(tokens[cut - 1], lang)) cut--;
  return Math.max(cut, 0);
}

/**
 * Phân tích buffer chưa chốt.
 * @param tokens  các token chưa chốt (đã bỏ phần đã chốt)
 * @param idleMs  thời gian transcript không đổi (xấp xỉ khoảng lặng)
 */
export function analyzeBuffer(tokens: string[], lang: string, idleMs: number): SegmentDecision {
  const none: SegmentDecision = { commitCount: 0, draftText: null };
  if (tokens.length === 0) return none;

  const T = THRESHOLDS;
  const cjk = isCjk(lang);
  const units = tokens.length;
  const text = joinTokens(tokens, lang);
  const dangling = isDangling(tokens[units - 1], lang);
  const complete = isComplete(tokens, lang);
  const terminal = /[.!?。！？]$/.test(text) && !/\.\.\.$/.test(text);
  const minCommit = cjk ? T.minCommitUnitsCjk : T.minCommitUnits;

  // ===== Quyết định CHỐT =====
  const commitAll =
    terminal ||
    (!dangling && complete && units >= minCommit && idleMs >= T.completeSilenceMs) ||
    (!dangling && complete && idleMs >= T.shortSilenceMs) ||
    (!dangling && idleMs >= T.looseSilenceMs) ||
    idleMs >= T.forceSilenceMs;

  if (commitAll) return { commitCount: units, draftText: null };

  // Nói một mạch quá dài: chốt phần đầu ở ranh giới mệnh đề, phần sau giữ lại
  if (units >= (cjk ? T.maxUnitsCjk : T.maxUnits)) {
    const cut = findCut(tokens, lang);
    if (cut > 0) return { commitCount: cut, draftText: null };
  }

  // ===== Quyết định DỊCH NHÁP =====
  // Bỏ các từ dở dang ở đuôi ("... my mind because" -> "... my mind")
  const trimmed = [...tokens];
  while (trimmed.length > 0 && isDangling(trimmed[trimmed.length - 1], lang)) trimmed.pop();

  const minDraft = cjk ? T.minDraftUnitsCjk : T.minDraftUnits;
  if (trimmed.length >= minDraft && isComplete(trimmed, lang)) {
    return { commitCount: 0, draftText: joinTokens(trimmed, lang) };
  }
  return none;
}