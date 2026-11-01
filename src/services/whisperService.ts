export interface RealtimeTranslationResult {
  type: "interim_translation" | "final_result";
  original: string;
  translated: string;
  lang: "vi" | "en";
}

class LocalAIClient {
  private ws: WebSocket | null = null;
  private onResultCallback: ((data: RealtimeTranslationResult) => void) | null =
    null;
  private wsUrl: string;

  constructor() {
    this.wsUrl =
      import.meta.env.AI_WS_URL ||
      "ws://localhost:3000/ws/translate";
  }

  connect(onResult: (data: RealtimeTranslationResult) => void) {
    this.onResultCallback = onResult;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log("🔗 Đã kết nối tới PhoWhisper & VinAI Translate Server");
    };

    this.ws.onmessage = (event) => {
      try {
        const data: RealtimeTranslationResult = JSON.parse(event.data);
        if (this.onResultCallback) {
          this.onResultCallback(data);
        }
      } catch (err) {
        console.error("Lỗi parse kết quả từ AI Server:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("⚠️ Ngắt kết nối AI Server, thử kết nối lại sau 2s...");
      setTimeout(() => {
        if (this.onResultCallback) this.connect(this.onResultCallback);
      }, 2000);
    };
  }

  /**
   * Gửi đoạn âm thanh Float32Array (16kHz) ngay khi người nói vừa ngắt nhịp thở
   */
  sendAudioChunk(audioFloat32: Float32Array, lang: "vi" | "en") {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: "audio",
        lang,
        audio: Array.from(audioFloat32),
      }),
    );
  }

  /**
   * Gửi text tạm (Interim) để dịch nháp tức thì khi người dùng vẫn đang nói
   */
  sendInterimText(text: string, lang: "vi" | "en") {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !text.trim())
      return;
    this.ws.send(
      JSON.stringify({
        type: "text",
        lang,
        text,
      }),
    );
  }

  disconnect() {
    this.onResultCallback = null;
    if (this.ws) {
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}

export const localAIClient = new LocalAIClient();
