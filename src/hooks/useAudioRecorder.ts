import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderProps {
  onAudioChunk: (blob: Blob) => void;
  timeSlice?: number; // Cắt mẩu âm thanh sau mỗi bao nhiêu ms (mặc định 2500ms)
}

export function useAudioRecorder({ onAudioChunk, timeSlice = 2500 }: UseAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          onAudioChunk(event.data);
        }
      };

      mediaRecorder.start(timeSlice);
      setIsRecording(true);
    } catch (err) {
      console.error('Không thể truy cập Microphone:', err);
    }
  }, [onAudioChunk, timeSlice]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  }, [isRecording]);

  return { isRecording, startRecording, stopRecording };
}