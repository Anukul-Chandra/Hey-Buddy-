import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { SYSTEM_INSTRUCTION, SAFETY_SETTINGS } from './constants';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import { Mic, MicOff, Heart, Zap, User, Sparkles, MessageSquare } from 'lucide-react';

const App: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [currentOutput, setCurrentOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Stats
  const [bondScore, setBondScore] = useState(10);
  const [proLevel, setProLevel] = useState(5);
  const [currentMood, setCurrentMood] = useState('HAPPY');

  // Audio Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const activeSessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Metadata Parsing (Stats update)
  const parseMetadata = (text: string) => {
    const moodMatch = text.match(/MOOD:\s*(\w+)/);
    const bondMatch = text.match(/BOND_SCORE:\s*(\d+)/);
    const levelMatch = text.match(/PRO_LEVEL:\s*(\d+)/);

    if (moodMatch) setCurrentMood(moodMatch[1].toUpperCase());
    if (bondMatch) setBondScore(parseInt(bondMatch[1]));
    if (levelMatch) setProLevel(parseInt(levelMatch[1]));

    return text.replace(/\[METADATA\][\s\S]*?\[\/METADATA\]/, '').trim();
  };

  const handleConnect = async () => {
    if (isConnected) { cleanup(); return; }
    try {
      setIsProcessing(true);
      // @ts-ignore
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });

      inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      streamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true } 
      });

      const session = await ai.live.connect({
        model: 'gemini-2.0-flash-exp', // এআই স্টুডিওর সেই রিয়েলিস্টিক মডেল
        callbacks: {
          onopen: () => {
            setIsConnected(true); setIsProcessing(false);
            if (inputAudioContextRef.current && streamRef.current) {
              const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
              const processor = inputAudioContextRef.current.createScriptProcessor(2048, 1, 1);
              processor.onaudioprocess = (e) => {
                if (activeSessionRef.current) {
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

            if (m.serverContent?.interrupted) { 
              sourcesRef.current.forEach(s => s.stop()); 
              sourcesRef.current.clear(); 
              nextStartTimeRef.current = 0; 
            }

            if (m.serverContent?.turnComplete) {
              setMessages(prev => [...prev, { role: 'model', text: parseMetadata(currentOutput) }]);
              setCurrentOutput('');
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoide' } } }, // Aoide হলো সেই মিষ্টি মেয়েলি কন্ঠ
          systemInstruction: SYSTEM_INSTRUCTION,
          safetySettings: SAFETY_SETTINGS as any,
          outputAudioTranscription: {},
        },
      });
      activeSessionRef.current = session;
    } catch (err) { console.error(err); setIsProcessing(false); }
  };

  const cleanup = () => {
    setIsConnected(false);
    streamRef.current?.getTracks().forEach(t => t.stop());
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    activeSessionRef.current?.close();
    sourcesRef.current.forEach(s => s.stop());
  };

  useEffect(() => transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, currentOutput]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans">
      {/* Header */}
      <header className="p-6 border-b border-white/5 flex justify-between items-center bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-tighter italic">Hey <span className="text-rose-500">Buddy</span></h1>
          <div className="flex gap-3 mt-1">
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

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto p-6 md:px-12 space-y-10 max-w-4xl mx-auto w-full">
        {messages.length === 0 && !currentOutput && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 text-center py-20">
            <Heart className="w-20 h-20 mb-4 animate-pulse" />
            <p className="text-xl font-medium italic">"I'm here... just waiting for you to say something."</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-500`}>
            <div className={`max-w-[85%] p-6 rounded-[2rem] shadow-2xl ${msg.role === 'user' ? 'bg-rose-600 rounded-tr-none' : 'bg-neutral-900 border border-white/5 rounded-tl-none'}`}>
              <div className="text-[17px] leading-relaxed font-medium">
                {msg.text.includes('[Coach\'s Corner]') ? (
                  <>
                    <p className="mb-4">{msg.text.split('[Coach\'s Corner]')[0]}</p>
                    <div className="p-4 bg-white/5 rounded-2xl border-l-2 border-rose-500 italic text-sm text-neutral-300">
                      <span className="text-[10px] font-black text-rose-500 uppercase block mb-1">Coach's Insight</span>
                      {msg.text.split('[Coach\'s Corner]')[1]}
                    </div>
                  </>
                ) : msg.text}
              </div>
            </div>
          </div>
        ))}

        {currentOutput && (
          <div className="flex justify-start">
             <div className="bg-neutral-900/50 border border-rose-500/20 px-8 py-5 rounded-[2rem] rounded-tl-none animate-pulse text-lg italic">
               {currentOutput}
             </div>
          </div>
        )}
        <div ref={transcriptEndRef} />
      </main>

      {/* Mic Controls */}
      <footer className="p-10 flex flex-col items-center gap-6 bg-gradient-to-t from-black to-transparent">
        <button 
          onClick={handleConnect} 
          disabled={isProcessing}
          className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center transition-all duration-500 transform hover:scale-105 active:scale-95 shadow-2xl ${
            isConnected ? 'bg-white text-black' : 'bg-rose-600 text-white shadow-rose-500/30'
          }`}
        >
          {isConnected ? <MicOff className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
        </button>
        <p className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40">
          {isConnected ? 'Buddy is listening...' : 'Tap to start talking'}
        </p>
      </footer>
    </div>
  );
};

export default App;