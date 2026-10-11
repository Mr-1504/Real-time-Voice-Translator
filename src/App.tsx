import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Trash2, ArrowRightLeft, Sparkles, AlertCircle, Volume2, Copy, Check, FileSpreadsheet } from "lucide-react";
import { exportToExcel } from "./services/exportService";
import { translateSentence } from "./services/libreTranslateService";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import type { SpeakerId, TranscriptItem, LanguageOption } from "./types";

const LANGUAGES: LanguageOption[] = [
  { code: "vi-VN", name: "Tiếng Việt" },
  { code: "en-US", name: "Tiếng Anh" },
  { code: "ja-JP", name: "Tiếng Nhật" },
  { code: "ko-KR", name: "Tiếng Hàn" },
  { code: "zh-CN", name: "Tiếng Trung" },
  { code: "fr-FR", name: "Tiếng Pháp" },
];

interface DraftState {
  text: string;
  translated: string;
  isTranslating: boolean;
}

export default function App() {
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [currentSpeaker, setCurrentSpeaker] = useState<SpeakerId>("speaker1");
  const currentSpeakerRef = useRef<SpeakerId>("speaker1");

  useEffect(() => {
    currentSpeakerRef.current = currentSpeaker;
  }, [currentSpeaker]);

  const [sourceLang, setSourceLang] = useState<LanguageOption>(LANGUAGES[1]); // Mặc định Anh -> Việt
  const [targetLang, setTargetLang] = useState<LanguageOption>(LANGUAGES[0]);
  const sourceLangRef = useRef<LanguageOption>(sourceLang);
  const targetLangRef = useRef<LanguageOption>(targetLang);

  useEffect(() => {
    sourceLangRef.current = sourceLang;
    targetLangRef.current = targetLang;
  }, [sourceLang, targetLang]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Chống race: chỉ nhận kết quả dịch nháp của yêu cầu mới nhất
  const draftReqIdRef = useRef(0);
  // Cache bản dịch nháp để khi chốt đúng đoạn đó thì khỏi dịch lại
  const draftCacheRef = useRef<{ text: string; translated: string } | null>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Ứng viên dịch sớm: dịch để hiện bản nháp, chưa khóa
  const handleDraft = useCallback(async (text: string | null) => {
    const reqId = ++draftReqIdRef.current;
    if (!text) {
      setDraft(null);
      return;
    }
    // Giữ bản dịch tạm cũ trong lúc chờ để khỏi nhấp nháy
    setDraft((prev) => ({ text, translated: prev?.translated ?? "", isTranslating: true }));

    const translated = await translateSentence(text, sourceLangRef.current.code, targetLangRef.current.code);
    if (reqId !== draftReqIdRef.current) return; // đã có nháp mới hơn hoặc đã chốt: bỏ kết quả cũ

    if (translated !== text) draftCacheRef.current = { text, translated };
    setDraft({ text, translated, isTranslating: false });
  }, []);

  // Đoạn đã chốt: tạo bản ghi chính thức và dịch đúng một lần
  const handleCommit = useCallback(async (finalText: string) => {
    // Vô hiệu hóa mọi yêu cầu dịch nháp đang bay, xóa nháp khỏi UI
    draftReqIdRef.current++;
    setDraft(null);

    const cached = draftCacheRef.current;
    draftCacheRef.current = null;

    const activeSpeaker = currentSpeakerRef.current;
    const currentSource = sourceLangRef.current;
    const currentTarget = targetLangRef.current;
    const timestamp = new Date().toTimeString().split(" ")[0];
    const newItemId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (cached && cached.text === finalText) {
      setTranscripts((prev) => [
        ...prev,
        { id: newItemId, speaker: activeSpeaker, original: finalText, translated: cached.translated, timestamp, isTranslating: false },
      ]);
      return;
    }

    setTranscripts((prev) => [
      ...prev,
      { id: newItemId, speaker: activeSpeaker, original: finalText, translated: "", timestamp, isTranslating: true },
    ]);

    try {
      const translated = await translateSentence(finalText, currentSource.code, currentTarget.code);
      setTranscripts((prev) =>
        prev.map((item) => (item.id === newItemId ? { ...item, translated, isTranslating: false } : item))
      );
    } catch {
      setTranscripts((prev) =>
        prev.map((item) => (item.id === newItemId ? { ...item, translated: finalText, isTranslating: false } : item))
      );
    }
  }, []);

  const { isListening, interimTranscript, error: speechError, isSupported, startListening, stopListening, resetError } = useSpeechRecognition({
    lang: sourceLang.code,
    onDraft: handleDraft,
    onCommit: handleCommit,
  });

  useEffect(() => {
    scrollToBottom();
  }, [transcripts, interimTranscript, draft]);

  const toggleSpeaker = useCallback(() => setCurrentSpeaker((prev) => (prev === "speaker1" ? "speaker2" : "speaker1")), []);

  const handleSwapLanguages = () => {
    if (isListening) stopListening();
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const handleClearAll = () => {
    if (transcripts.length > 0 && window.confirm("Làm mới toàn bộ cuộc hội thoại?")) {
      setTranscripts([]);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (text: string, langCode: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = (event.target as HTMLElement)?.tagName;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(activeTag)) return;
      if (event.code === "Space") {
        event.preventDefault();
        toggleSpeaker();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleSpeaker]);

  const handleExportExcel = () => {
    if (transcripts.length === 0) return;
    try {
      const now = new Date();
      const fileName = `Hoi_thoai_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}.xlsx`;
      exportToExcel(transcripts, fileName);

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToastMessage("Đã tải file Excel!");
      toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Lỗi xuất file Excel";
      alert(errMsg);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0c10] text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <header className="border-b border-white/[0.06] bg-[#0d1117]/80 backdrop-blur-xl px-5 py-3 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 p-0.5 shadow-md flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-white">Voice Translator</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Draft + Commit</span>
              </div>
              <p className="text-[11px] text-slate-500 font-normal">Song ngữ trực tiếp • Nhấn <kbd className="px-1 py-0.2 bg-white/[0.06] rounded border border-white/[0.08]">Space</kbd> đổi Speaker</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-[#161b22] border border-white/[0.08] rounded-xl px-2.5 py-1 text-xs">
              <select value={sourceLang.code} onChange={(e) => setSourceLang(LANGUAGES.find(l => l.code === e.target.value) || sourceLang)} disabled={isListening} className="bg-transparent text-slate-300 hover:text-white outline-none cursor-pointer py-1 font-medium disabled:opacity-40">
                {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code} className="bg-[#161b22]">{lang.name}</option>)}
              </select>
              <button onClick={handleSwapLanguages} disabled={isListening} className="p-1 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-30"><ArrowRightLeft className="w-3 h-3" /></button>
              <select value={targetLang.code} onChange={(e) => setTargetLang(LANGUAGES.find(l => l.code === e.target.value) || targetLang)} disabled={isListening} className="bg-transparent text-slate-300 hover:text-white outline-none cursor-pointer py-1 font-medium disabled:opacity-40">
                {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code} className="bg-[#161b22]">{lang.name}</option>)}
              </select>
            </div>

            <button onClick={toggleSpeaker} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${currentSpeaker === "speaker1" ? "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/15" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${currentSpeaker === "speaker1" ? "bg-blue-400" : "bg-emerald-400"}`} />
              <span>{currentSpeaker === "speaker1" ? "Speaker 1" : "Speaker 2"}</span>
            </button>

            <button onClick={isListening ? stopListening : startListening} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${isListening ? "bg-rose-500/15 text-rose-300 border border-rose-500/30" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}>
              {isListening ? <><span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" /><MicOff className="w-3.5 h-3.5" /><span>Dừng thu</span></> : <><Mic className="w-3.5 h-3.5" /><span>Bắt đầu ghi</span></>}
            </button>
            <button onClick={handleExportExcel} disabled={transcripts.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161b22] text-slate-300 hover:text-white border border-white/[0.08] text-xs font-medium disabled:opacity-30"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /><span>Xuất Excel</span></button>
            <button onClick={handleClearAll} disabled={transcripts.length === 0} className="p-2 rounded-xl bg-[#161b22] text-slate-500 hover:text-rose-400 border border-white/[0.08] disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </header>

      {(!isSupported || speechError) && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full"><AlertCircle className="w-4 h-4 text-amber-400 shrink-0" /><span>{!isSupported ? "Trình duyệt không hỗ trợ Web Speech API." : speechError}</span>{speechError && <button onClick={resetError} className="ml-auto underline">Đóng</button>}</div>
        </div>
      )}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 transition-all duration-300"><div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#161b22] border border-emerald-500/30 text-emerald-400 shadow-xl text-xs font-medium"><Check className="w-3.5 h-3.5" /><span>{toastMessage}</span></div></div>
      )}

      <main className="flex-1 overflow-hidden flex flex-col max-w-7xl w-full mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 uppercase px-2"><span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400/80" />Văn bản gốc ({sourceLang.name})</span></div>
          <div className="hidden md:flex items-center justify-between text-[11px] font-medium text-slate-500 uppercase px-2"><span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />Bản dịch ({targetLang.name})</span></div>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
          {transcripts.length === 0 && !interimTranscript && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-3 text-slate-600"><Mic className="w-5 h-5" /></div>
              <p className="text-sm font-medium text-slate-400">Sẵn sàng phiên dịch</p>
            </div>
          )}

          {transcripts.map((item) => (
            <div key={item.id} className="grid grid-cols-1 md:grid-cols-2 gap-3 group">
              <div className="bg-[#131722]/40 hover:bg-[#131722]/80 border border-white/[0.04] rounded-2xl p-4 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${item.speaker === "speaker1" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>{item.speaker === "speaker1" ? "Speaker 1" : "Speaker 2"}</span>
                    <span className="text-[11px] text-slate-600">{item.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSpeak(item.original, sourceLang.code)} className="p-1 text-slate-500 hover:text-slate-300"><Volume2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleCopyText(`orig-${item.id}`, item.original)} className="p-1 text-slate-500 hover:text-slate-300">{copiedId === `orig-${item.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
                  </div>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-normal">{item.original}</p>
              </div>

              <div className="bg-[#131722]/40 hover:bg-[#131722]/80 border border-white/[0.04] rounded-2xl p-4 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Bản dịch</span>
                    {!item.isTranslating && item.translated && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleSpeak(item.translated, targetLang.code)} className="p-1 text-slate-500 hover:text-slate-300"><Volume2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleCopyText(`trans-${item.id}`, item.translated)} className="p-1 text-slate-500 hover:text-slate-300">{copiedId === `trans-${item.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
                      </div>
                    )}
                  </div>
                  {item.isTranslating ? (
                    <div className="space-y-2 py-1 animate-pulse"><div className="h-3.5 bg-white/[0.05] rounded w-3/4" /><div className="h-3.5 bg-white/[0.05] rounded w-1/2" /></div>
                  ) : <p className="text-sm leading-relaxed font-normal text-emerald-300/90">{item.translated}</p>}
                </div>
              </div>
            </div>
          ))}

          {/* Dòng đang nói: cột trái là transcript chưa chốt, cột phải là bản dịch nháp */}
          {interimTranscript && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-[#131722]/20 border border-indigo-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${currentSpeaker === "speaker1" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>{currentSpeaker === "speaker1" ? "Speaker 1" : "Speaker 2"}</span>
                  <span className="text-[11px] text-indigo-400/80 flex items-center gap-1.5 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />Đang nghe & phân tích...</span>
                </div>
                <p className="text-sm text-slate-400 italic font-light leading-relaxed">"{interimTranscript}"</p>
              </div>

              <div className="bg-[#131722]/20 border border-dashed border-amber-500/25 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-medium text-amber-400/80 uppercase">Bản dịch tạm</span>
                  {draft?.isTranslating && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                </div>
                {draft && draft.translated ? (
                  <p className="text-sm text-amber-200/70 italic leading-relaxed">{draft.translated}</p>
                ) : (
                  <p className="text-xs text-slate-600">Chờ đủ ý để dịch nháp...</p>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-1" />
        </div>
      </main>

      <footer className="border-t border-white/[0.06] bg-[#0d1117]/60 px-5 py-2 text-[11px] text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${isListening ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />{isListening ? "Đang lắng nghe trực tiếp" : "Đã tạm dừng"}</span><span>•</span><span>Tổng câu: <strong className="text-slate-400">{transcripts.length}</strong></span>
        </div>
        <div><span>Phím tắt: </span><kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded border text-[10px]">Space</kbd> đổi Người nói</div>
      </footer>
    </div>
  );
}