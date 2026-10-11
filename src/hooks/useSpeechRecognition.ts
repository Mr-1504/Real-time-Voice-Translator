import { useState, useEffect, useRef, useCallback } from 'react';
import { processTranscriptBuffer } from '../utils/sentenceSegmenter';

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
  onSentenceComplete?: (finalText: string) => void;
}

export function useSpeechRecognition({
  lang = 'en-US',
  onSentenceComplete,
}: UseSpeechRecognitionProps = {}) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const onSentenceCompleteRef = useRef(onSentenceComplete);
  
  // Bộ đệm thông minh
  const accumulatedTextRef = useRef<string>('');
  const currentInterimRef = useRef<string>('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    onSentenceCompleteRef.current = onSentenceComplete;
  }, [onSentenceComplete]);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang;
    }
  }, [lang]);

  useEffect(() => {
    const windowWithSpeech = window as any;
    const SpeechRecognitionConstructor = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setIsSupported(false);
      setError('Trình duyệt không hỗ trợ Web Speech API.');
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => setError(null);

    recognition.onresult = (event: any) => {
      let newFinalText = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          newFinalText += text + ' ';
        } else {
          currentInterim += text;
        }
      }

      currentInterimRef.current = currentInterim;

      // Nếu API chốt một mảnh văn bản, tích lũy vào bộ đệm của chúng ta
      if (newFinalText.trim()) {
        accumulatedTextRef.current = (accumulatedTextRef.current + ' ' + newFinalText.trim()).trim();
      }

      // Xử lý bộ đệm qua thư viện Compromise
      const { completeSentences, remainingBuffer } = processTranscriptBuffer(accumulatedTextRef.current, lang);
      
      completeSentences.forEach(sentence => {
        onSentenceCompleteRef.current?.(sentence);
      });
      accumulatedTextRef.current = remainingBuffer;

      // Cập nhật UI ngay lập tức
      setInterimTranscript((accumulatedTextRef.current + ' ' + currentInterim).trim());

      // ==========================================
      // CƠ CHẾ DYNAMIC SILENCE (KHOẢNG LẶNG 1.2S)
      // ==========================================
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      
      silenceTimerRef.current = setTimeout(() => {
        const textToFlush = (accumulatedTextRef.current + ' ' + currentInterimRef.current).trim();
        if (textToFlush) {
          onSentenceCompleteRef.current?.(textToFlush);
        }
        
        // Reset sạch bộ đệm
        accumulatedTextRef.current = '';
        currentInterimRef.current = '';
        setInterimTranscript('');

        // Abort API để xóa bộ đệm của trình duyệt (tránh gửi lại dữ liệu cũ đã flush)
        if (recognitionRef.current && isListeningRef.current) {
          recognitionRef.current.abort(); 
        }
      }, 1200);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      if (event.error === 'not-allowed') {
        setError('Quyền truy cập Microphone bị từ chối.');
        isListeningRef.current = false;
        setIsListening(false);
      }
    };

    // Tự động khởi động lại khi bị ngắt (do abort hoặc kết nối chập chờn)
    recognition.onend = () => {
      if (isListeningRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (isListeningRef.current) {
            try { recognition.start(); } catch {}
          }
        }, 150);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isListeningRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try { recognition.stop(); } catch {}
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      setError(null);
      accumulatedTextRef.current = '';
      currentInterimRef.current = '';
      setInterimTranscript('');
      isListeningRef.current = true;
      setIsListening(true);
      recognitionRef.current.start();
    } catch {}
  }, []);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setInterimTranscript('');
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
  }, []);

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