import { useState, useEffect, useRef, useCallback } from 'react';
import { analyzeBuffer, joinTokens, tokenize, THRESHOLDS } from '../utils/incrementalSegmenter';

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  onresult: ((event: any) => void) | null;
}

interface UseSpeechRecognitionProps {
  lang?: string;
  onDraft?: (draftText: string | null) => void;
  onCommit?: (finalText: string) => void;       // Đoạn đã chốt, gọi đúng một lần cho mỗi đoạn
}

const TICK_MS = 100;

export function useSpeechRecognition({
  lang = 'en-US',
  onDraft,
  onCommit,
}: UseSpeechRecognitionProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isListeningRef = useRef(false);
  const langRef = useRef(lang);
  const onDraftRef = useRef(onDraft);
  const onCommitRef = useRef(onCommit);

  // ===== Bộ ổn định transcript (Stabilizer) =====
  // Danh sách kết quả mới nhất của Web Speech trong phiên hiện tại
  const resultsRef = useRef<any>(null);
  // Index kết quả đầu tiên chưa chốt hết: các result trước index ni đã khóa, không đọc lại
  const baseIndexRef = useRef(0);
  // Số token đầu (tính từ baseIndex) đã chốt, dùng khi result cuối còn là interim
  const skipTokensRef = useRef(0);
  const lastTextRef = useRef('');
  const lastChangeAtRef = useRef(0);
  const lastDraftRef = useRef<string | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onDraftRef.current = onDraft; }, [onDraft]);
  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);

  useEffect(() => {
    langRef.current = lang;
    if (recognitionRef.current) recognitionRef.current.lang = lang;
  }, [lang]);

  // Đọc phần transcript chưa chốt từ baseIndex trở đi
  const readBuffer = useCallback(() => {
    const list = resultsRef.current;
    if (!list) return { tokens: [] as string[], allFinal: true };

    let raw = '';
    let allFinal = true;
    for (let i = baseIndexRef.current; i < list.length; i++) {
      raw += ' ' + list[i][0].transcript;
      if (!list[i].isFinal) allFinal = false;
    }
    const all = tokenize(raw, langRef.current);
    return { tokens: all.slice(skipTokensRef.current), allFinal };
  }, []);

  // Khóa toàn bộ result hiện có: lần sau chỉ đọc từ result mới
  const advanceBase = useCallback(() => {
    baseIndexRef.current = resultsRef.current?.length ?? 0;
    skipTokensRef.current = 0;
  }, []);

  const emitDraft = useCallback((text: string | null) => {
    if (text === lastDraftRef.current) return; // không dịch lại nháp giống hệt
    lastDraftRef.current = text;
    onDraftRef.current?.(text);
  }, []);

  // CHỐT `count` token đầu: đẩy sang dịch chính thức đúng một lần
  const commitTokens = useCallback((count: number) => {
    const { tokens, allFinal } = readBuffer();
    const n = Math.min(count, tokens.length);
    if (n <= 0) return;

    const lang = langRef.current;
    const text = joinTokens(tokens.slice(0, n), lang);
    skipTokensRef.current += n;
    lastDraftRef.current = null; // nháp cũ hết hiệu lực, App sẽ tự xóa khi nhận commit

    // Chốt hết và mọi result đã final thì khóa luôn theo index
    if (n === tokens.length && allFinal) advanceBase();

    setInterimTranscript(joinTokens(tokens.slice(n), lang));
    onCommitRef.current?.(text);
  }, [readBuffer, advanceBase]);

  // Chốt nốt phần còn lại (khi dừng ghi, hoặc phiên nhận dạng bị ngắt)
  const flushRemaining = useCallback(() => {
    const { tokens } = readBuffer();
    if (tokens.length > 0) commitTokens(tokens.length);
    emitDraft(null);
  }, [readBuffer, commitTokens, emitDraft]);

  // Vòng kiểm tra định kỳ: cập nhật UI, quyết định dịch nháp / chốt
  const tick = useCallback(() => {
    const lang = langRef.current;
    const { tokens, allFinal } = readBuffer();
    const text = joinTokens(tokens, lang);

    if (text !== lastTextRef.current) {
      lastTextRef.current = text;
      lastChangeAtRef.current = Date.now();
      setInterimTranscript(text);
    }

    if (tokens.length === 0) {
      // Không còn gì chờ chốt: dọn nháp, và khóa index nếu result đã final hết
      emitDraft(null);
      if (allFinal && resultsRef.current && resultsRef.current.length > baseIndexRef.current) advanceBase();
      return;
    }

    const idleMs = Date.now() - lastChangeAtRef.current;
    if (idleMs < THRESHOLDS.stableMs) return; // transcript chưa ổn định

    const decision = analyzeBuffer(tokens, lang, idleMs);
    if (decision.commitCount > 0) {
      commitTokens(decision.commitCount);
    } else {
      emitDraft(decision.draftText);
    }
  }, [readBuffer, commitTokens, emitDraft, advanceBase]);

  const stopTick = useCallback(() => {
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!Ctor) {
      setIsSupported(false);
      setError('Trình duyệt không hỗ trợ Web Speech API.');
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = langRef.current;

    // Mỗi phiên mới thì danh sách result bắt đầu lại từ 0
    recognition.onstart = () => {
      setError(null);
      resultsRef.current = null;
      baseIndexRef.current = 0;
      skipTokensRef.current = 0;
    };

    // Chỉ lưu lại result, việc chốt/nháp để tick lo
    recognition.onresult = (event: any) => {
      resultsRef.current = event.results;
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed') {
        setError('Quyền truy cập Microphone bị từ chối.');
        isListeningRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Phiên bị ngắt: chốt nốt phần còn lại để khỏi mất chữ
      flushRemaining();
      if (isListeningRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (isListeningRef.current) {
            try { recognition.start(); } catch { /* đang chạy rồi thì thôi */ }
          }
        }, 150);
      } else {
        stopTick();
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isListeningRef.current = false;
      stopTick();
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try { recognition.stop(); } catch { /* bỏ qua */ }
    };
  }, [flushRemaining, stopTick]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      setError(null);
      resultsRef.current = null;
      baseIndexRef.current = 0;
      skipTokensRef.current = 0;
      lastTextRef.current = '';
      lastDraftRef.current = null;
      setInterimTranscript('');
      isListeningRef.current = true;
      setIsListening(true);
      recognitionRef.current.start();
      if (!tickTimerRef.current) tickTimerRef.current = setInterval(tick, TICK_MS);
    } catch { /* bỏ qua */ }
  }, [tick]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    flushRemaining(); // chốt ngay bằng ngôn ngữ hiện tại (phòng trường hợp vừa đổi ngôn ngữ)
    setInterimTranscript('');
    try { recognitionRef.current?.stop(); } catch { /* bỏ qua */ }
    // tick sẽ được dừng ở onend sau khi chốt nốt các result final muộn
  }, [flushRemaining]);

  return {
    isListening,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetError: () => setError(null),
  };
}