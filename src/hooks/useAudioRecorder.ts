import { useEffect } from 'react';
import { useMicVAD } from '@ricky0123/vad-react';
import { localAIClient, type RealtimeTranslationResult } from '../services/whisperService';

interface UseVADRecorderProps {
  isListening: boolean;
  currentLang: 'vi' | 'en';
  onFinalResult: (original: string, translated: string, lang: 'vi' | 'en') => void;
  onInterimResult?: (original: string, translated: string) => void;
  onSpeechStart?: () => void;
}

export function useAudioRecorder({
  isListening,
  currentLang,
  onFinalResult,
  onInterimResult,
  onSpeechStart,
}: UseVADRecorderProps) {
  useEffect(() => {
    localAIClient.connect((res: RealtimeTranslationResult) => {
      if (res.type === 'final_result') {
        onFinalResult(res.original, res.translated, res.lang);
      } else if (res.type === 'interim_translation' && onInterimResult) {
        onInterimResult(res.original, res.translated);
      }
    });

    return () => {
      localAIClient.disconnect();
    };
  }, [onFinalResult, onInterimResult]);

  const vad = useMicVAD({
    startOnLoad: false,
    baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.31/dist/",
    onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/",
    positiveSpeechThreshold: 0.6,
    negativeSpeechThreshold: 0.4,
    redemptionMs: 350,
    minSpeechMs: 150,
    onSpeechStart: () => {
      if (onSpeechStart) onSpeechStart();
    },
    onSpeechEnd: (audio: Float32Array) => {
      localAIClient.sendAudioChunk(audio, currentLang);
    },
  });

  useEffect(() => {
    if (isListening && !vad.listening && !vad.loading) {
      vad.start();
    } else if (!isListening && vad.listening) {
      vad.pause();
    }
  }, [isListening, vad.listening, vad.loading]);

  return {
    isUserSpeaking: vad.userSpeaking,
    isLoadingVAD: vad.loading,
    errored: vad.errored,
  };
}