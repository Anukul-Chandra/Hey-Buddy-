import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { SYSTEM_INSTRUCTION, SAFETY_SETTINGS } from './constants';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import { Mic, MicOff, Heart, Zap, Sparkles, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [currentOutput, setCurrentOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);
  
  const [bondScore, setBondScore] = useState(10);
  const [proLevel, setProLevel] = useState(5);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const activeSessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const parseMetadata = (text: string) => {
    const bondMatch = text.match(/BOND_SCORE:\s*(\d+)/);
    const levelMatch = text.match(/PRO_LEVEL:\s*(\d+)/);
    if (bondMatch) setBondScore(parseInt(bondMatch[1]));
    if (levelMatch) setProLevel(parseInt(levelMatch[1]));
    return text.replace(/\[METADATA\][\s\S]*?\[\/METADATA\]/, '').trim();
  };

  const handleConnect = async () => {
    if (isConnected) { cleanup(); return; }
    try {
      setIsProcessing(true);
      setConnError(null);
      
      // @ts-ignore
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing! Check .env.local");

      const ai = new GoogleGenAI({ apiKey });
      inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });

      const session = await ai.live.connect({
        model: 'gemini-2.0-flash', // আপনার লিস্টের সবচেয়ে স্ট্যাবল মডেল
        callbacks: {
          onopen: () => {
            setIsConnected(true); setIsProcessing(false);
            if (inputAudioContextRef.current && streamRef.current) {
              const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
              const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
              processor.onaudioprocess = (e) => {
                if (activeSessionRef.current?.ws?.readyState === 1) {
                  activeSessionRef.current.sendRealtimeInput({ media: createPcmBlob(e.inputBuffer.getChannelData(0)) });
                }
              };
              source.connect(processor);
              processor.connect(inputAudioContextRef.current.destination);
            }
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.serverContent?.outputTranscription) setCurrentOutput(p => p + m.serverContent!.outputTranscription!.text);
            const base64 = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64 && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buf = await decodeAudioData(decode(base64), ctx, 24000, 1);
              const src = ctx.createBufferSource();
              src.buffer = buf; src.connect(ctx.destination);
              src.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buf.duration;
              sourcesRef.current.add(src);
            }
            if (m.serverContent?.interrupted) { sourcesRef.current.forEach(s => s.stop()); sourcesRef.current.clear(); nextStartTimeRef.current = 0; }
            if (m.serverContent?.turnComplete) {
              setMessages(prev => [...prev, { role: 'model', text: parseMetadata(currentOutput) }]);
              setCurrentOutput('');
            }
          },
          onclose: (e) => { setConnError(`Closed: ${e.reason || 'Quota limit'}`); cleanup(); },
          onerror: (e) => { setConnError("WebSocket Error"); cleanup(); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }, // মিষ্টি মেয়েলি কণ্ঠ
          systemInstruction: SYSTEM_INSTRUCTION,
          safetySettings: SAFETY_SETTINGS as any,
          outputAudioTranscription: {},
        },
      });
      activeSessionRef.current = session;
    } catch (err: any) { setConnError(err.message); setIsProcessing(false); cleanup(); }
  };

  const cleanup = () => {
    setIsConnected(false); setIsProcessing(false);
    streamRef.current?.getTracks().forEach(t => t.stop());
    inputAudioContextRef.current?.close(); outputAudioContextRef.current?.close();
    if (activeSessionRef.current) try { activeSessionRef.current.close(); } catch(e) {}
    activeSessionRef.current = null;
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} }); sourcesRef.current.clear();
  };

  useEffect(() => transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, currentOutput]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans overflow-hidden">
      <header className="p-6 border-b border-white/5 flex justify-between items-center bg-black/50 backdrop-blur-xl">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black italic tracking-tighter">Hey <span className="text-rose-500">Buddy</span></h1>
          <div className="flex gap-4 mt-1 opacity-80">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1">
              <Heart className="w-3 h-3 fill-current" /> Bond: {bondScore}%
            </span>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
              <Zap className="w-3 h-3 fill-current" /> Mastery: {proLevel}%
            </span>
          </div>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${isConnected ? 'bg-rose-500/20 text-rose-500 animate-pulse' : 'bg-white/5 text-neutral-500'}`}>
          {isConnected ? '• Live Session' : 'Offline'}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:px-12 space-y-10 max-w-4xl mx-auto w-full">
        {connError && <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 text-rose-500 text-sm"><AlertCircle className="w-5 h-5" /> {connError}</div>}
        
        {messages.length === 0 && !currentOutput && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 text-center py-24">
            <Heart className="w-20 h-20 mb-4 animate-pulse" />
            <p className="text-xl italic">"I'm waiting to hear your voice..."</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-7 rounded-[2.5rem] shadow-2xl ${msg.role === 'user' ? 'bg-rose-600 rounded-tr-none' : 'bg-neutral-900 border border-white/5 rounded-tl-none'}`}>
              <div className="text-[18px] leading-relaxed font-medium">
                {msg.text.includes("[Coach's Corner]") ? (
                  <>
                    <p className="mb-5">{msg.text.split("[Coach's Corner]")[0]}</p>
                    <div className="p-5 bg-white/5 rounded-3xl border-l-4 border-rose-500 italic text-sm text-neutral-300">
                      <span className="text-[10px] font-black text-rose-500 uppercase block mb-1">Coach's Corner</span>
                      {msg.text.split("[Coach's Corner]")[1]}
                    </div>
                  </>
                ) : msg.text}
              </div>
            </div>
          </div>
        ))}

        {currentOutput && (
          <div className="flex justify-start">
             <div className="bg-neutral-900/50 border border-rose-500/20 px-8 py-6 rounded-[2.5rem] rounded-tl-none animate-pulse text-lg italic">
               {currentOutput}
             </div>
          </div>
        )}
        <div ref={transcriptEndRef} />
      </main>

      <footer className="p-12 flex flex-col items-center gap-6 bg-gradient-to-t from-black to-transparent">
        <button 
          onClick={handleConnect} 
          disabled={isProcessing}
          className={`w-32 h-32 rounded-[3rem] flex items-center justify-center transition-all duration-500 transform hover:scale-105 active:scale-95 shadow-3xl ${
            isConnected ? 'bg-white text-black' : 'bg-rose-600 text-white shadow-rose-500/40'
          }`}
        >
          {isConnected ? <MicOff className="w-14 h-14" /> : <Mic className="w-14 h-14" />}
        </button>
        <p className="text-[11px] font-black uppercase tracking-[0.5em] opacity-40">
          {isConnected ? 'Buddy is Listening' : 'Connect with Buddy'}
        </p>
      </footer>
    </div>
  );
};

export default App;