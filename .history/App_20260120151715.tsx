import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { SYSTEM_INSTRUCTION, SAFETY_SETTINGS } from './constants';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import { ChatMessage } from './types';
import { 
  Mic, 
  MicOff, 
  MessageSquare, 
  Activity, 
  Heart, 
  User, 
  Settings,
  AlertCircle,
  Sparkles,
  Menu,
  X,
  Plus,
  History,
  Trash2,
  Trophy,
  Zap
} from 'lucide-react';

interface SavedChat {
  id: string;
  timestamp: number;
  preview: string;
  messages: ChatMessage[];
  stats?: { bond: number; level: number; mood: string };
}

const App: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Stats & Mood (The "Interesting Feature")
  const [bondScore, setBondScore] = useState(10);
  const [proLevel, setProLevel] = useState(5);
  const [currentMood, setCurrentMood] = useState('NEUTRAL');

  // Sidebar and History
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<SavedChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const activeSessionRef = useRef<any>(null); // Direct access to session for speed
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('hey_buddy_history_v2');
    if (saved) setChatHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (messages.length > 0) saveCurrentChat();
  }, [messages, bondScore, proLevel, currentMood]);

  const saveCurrentChat = () => {
    const id = activeChatId || Date.now().toString();
    const preview = messages.find(m => m.role === 'user')?.text.slice(0, 40) + '...';
    
    setChatHistory(prev => {
      const existingIdx = prev.findIndex(c => c.id === id);
      const updatedChat = { 
        id, 
        timestamp: Date.now(), 
        preview: preview || 'New Talk', 
        messages,
        stats: { bond: bondScore, level: proLevel, mood: currentMood }
      };
      
      let newList;
      if (existingIdx >= 0) {
        newList = [...prev];
        newList[existingIdx] = updatedChat;
      } else {
        newList = [updatedChat, ...prev];
        setActiveChatId(id);
      }
      localStorage.setItem('hey_buddy_history_v2', JSON.stringify(newList));
      return newList;
    });
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newList = chatHistory.filter(c => c.id !== id);
    setChatHistory(newList);
    localStorage.setItem('hey_buddy_history_v2', JSON.stringify(newList));
    if (activeChatId === id) {
      setMessages([]);
      setActiveChatId(null);
      setBondScore(10);
      setProLevel(5);
    }
  };

  const loadChat = (chat: SavedChat) => {
    setMessages(chat.messages);
    setActiveChatId(chat.id);
    setBondScore(chat.stats?.bond || 10);
    setProLevel(chat.stats?.level || 5);
    setCurrentMood(chat.stats?.mood || 'NEUTRAL');
    setIsSidebarOpen(false);
  };

  const startNewChat = () => {
    setMessages([]);
    setActiveChatId(null);
    setBondScore(10);
    setProLevel(5);
    setCurrentMood('NEUTRAL');
    setIsSidebarOpen(false);
  };

  const parseMetadata = (text: string) => {
    const match = text.match(/\[METADATA\]([\s\S]*?)\[\/METADATA\]/);
    if (!match) return text;
    
    const content = match[1];
    const moodMatch = content.match(/MOOD:\s*(\w+)/);
    const bondMatch = content.match(/BOND_SCORE:\s*(\d+)/);
    const levelMatch = content.match(/PRO_LEVEL:\s*(\d+)/);

    if (moodMatch) setCurrentMood(moodMatch[1].toUpperCase());
    if (bondMatch) setBondScore(parseInt(bondMatch[1]));
    if (levelMatch) setProLevel(parseInt(levelMatch[1]));

    return text.replace(/\[METADATA\][\s\S]*?\[\/METADATA\]/, '').trim();
  };

  const moodColor = useMemo(() => {
    switch (currentMood) {
      case 'ROMANTIC': return 'rose';
      case 'DEEP': return 'indigo';
      case 'HAPPY': return 'amber';
      case 'CONCERNED': return 'emerald';
      default: return 'rose';
    }
  }, [currentMood]);

  const handleConnect = async () => {
    if (isConnected) { cleanup(); return; }
    try {
      setIsProcessing(true); setError(null);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      streamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1, 
          sampleRate: 16000,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true
        } 
      });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnected(true); setIsProcessing(false);
            if (inputAudioContextRef.current && streamRef.current) {
              const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
              // ULTRA-LOW LATENCY: Buffer size 256 (~16ms)
              scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(256, 1, 1);
              scriptProcessorRef.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                // Optimization: Use activeSessionRef to avoid promise microtask overhead
                if (activeSessionRef.current) {
                  activeSessionRef.current.sendRealtimeInput({ media: createPcmBlob(inputData) });
                } else {
                  sessionPromise.then(s => s.sendRealtimeInput({ media: createPcmBlob(inputData) }));
                }
              };
              source.connect(scriptProcessorRef.current);
              scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
            }
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.serverContent?.outputTranscription) setCurrentOutput(p => p + m.serverContent!.outputTranscription!.text);
            else if (m.serverContent?.inputTranscription) setCurrentInput(p => p + m.serverContent!.inputTranscription!.text);

            const base64 = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64 && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              // Play immediately if buffer is empty
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buf = await decodeAudioData(decode(base64), ctx, 24000, 1);
              const src = ctx.createBufferSource();
              src.buffer = buf; src.connect(ctx.destination);
              src.onended = () => sourcesRef.current.delete(src);
              src.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buf.duration;
              sourcesRef.current.add(src);
            }
            if (m.serverContent?.interrupted) { sourcesRef.current.forEach(s => s.stop()); sourcesRef.current.clear(); nextStartTimeRef.current = 0; }
            if (m.serverContent?.turnComplete) {
              setMessages(prev => {
                const lastOutput = parseMetadata(currentOutput.trim());
                return [...prev, { role: 'user', text: currentInput.trim() }, { role: 'model', text: lastOutput }];
              });
              setCurrentInput(''); setCurrentOutput('');
            }
          },
          onerror: () => { setError('Oops! Connection problem.'); cleanup(); },
          onclose: () => cleanup()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction: SYSTEM_INSTRUCTION,
          safetySettings: SAFETY_SETTINGS,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
      });
      sessionRef.current = sessionPromise;
      sessionPromise.then(s => { activeSessionRef.current = s; });
    } catch (err) { setError('Mic permission issue.'); setIsProcessing(false); }
  };

  const cleanup = () => {
    setIsConnected(false); setIsProcessing(false);
    
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close();
    }
    inputAudioContextRef.current = null;

    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close();
    }
    outputAudioContextRef.current = null;

    if (sessionRef.current) {
      sessionRef.current.then((s: any) => s.close?.());
      sessionRef.current = null;
    }
    
    activeSessionRef.current = null;

    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
  };

  useEffect(() => transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, currentOutput, currentInput]);

  return (
    <div className="flex h-screen bg-[#050505] text-neutral-100 overflow-hidden relative">
      
      {/* Mood Reactive Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden transition-all duration-1000">
        <div className={`absolute top-[-20%] left-[-20%] w-[60%] h-[60%] blur-[150px] rounded-full transition-colors duration-1000 ${
          moodColor === 'rose' ? 'bg-rose-900/10' : 
          moodColor === 'indigo' ? 'bg-indigo-900/15' : 
          moodColor === 'amber' ? 'bg-amber-900/10' : 'bg-emerald-900/10'
        }`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] blur-[180px] rounded-full transition-colors duration-1000 ${
          moodColor === 'rose' ? 'bg-rose-500/5' : 
          moodColor === 'indigo' ? 'bg-indigo-500/10' : 
          moodColor === 'amber' ? 'bg-amber-500/5' : 'bg-emerald-500/5'
        }`} />
      </div>

      <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />

      <aside className={`fixed left-0 top-0 h-full w-[320px] glass-panel z-50 transform transition-transform duration-500 ease-out border-r border-rose-500/10 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-xl font-black italic playfair text-rose-500">History</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5" /></button>
          </div>
          <button onClick={startNewChat} className="flex items-center gap-3 w-full p-5 mb-8 rounded-[1.5rem] bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all text-rose-500 font-black tracking-widest uppercase text-xs">
            <Plus className="w-5 h-5" /> New Session
          </button>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {chatHistory.map(chat => (
              <div key={chat.id} onClick={() => loadChat(chat)} className={`group relative p-5 rounded-2xl border transition-all cursor-pointer ${activeChatId === chat.id ? 'bg-rose-500/15 border-rose-500/40' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                <p className="text-sm font-bold line-clamp-1 mb-2 pr-6 opacity-90">{chat.preview}</p>
                <div className="flex justify-between items-center opacity-50">
                   <p className="text-[10px] font-black tracking-widest">{new Date(chat.timestamp).toLocaleDateString()}</p>
                   <div className="flex gap-1">
                      <div className="w-1 h-1 rounded-full bg-rose-500" />
                      <div className="w-1 h-1 rounded-full bg-rose-500/50" />
                   </div>
                </div>
                <button onClick={(e) => deleteChat(chat.id, e)} className="absolute right-3 top-5 opacity-0 group-hover:opacity-100 p-2 text-neutral-500 hover:text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full relative z-10 max-w-5xl mx-auto w-full">
        <header className="flex items-center justify-between p-6 md:px-10 border-b border-white/5 bg-[#050505]/50 backdrop-blur-lg">
          <div className="flex items-center gap-5">
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all"><Menu className="w-6 h-6" /></button>
            <div className="flex flex-col">
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center">
                Hey <span className="text-rose-500 underline decoration-rose-500/30 italic ml-2">Buddy</span>
              </h1>
              <div className="flex items-center gap-3 mt-1">
                 <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/10 rounded-full border border-rose-500/10 text-[9px] font-black text-rose-500 uppercase tracking-[0.1em]">
                    <Zap className="w-2.5 h-2.5 fill-current" /> Mastery Level: {proLevel}%
                 </div>
                 <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 rounded-full border border-indigo-500/10 text-[9px] font-black text-indigo-400 uppercase tracking-[0.1em]">
                    <Heart className="w-2.5 h-2.5 fill-current" /> Bond: {bondScore}%
                 </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isConnected && <div className="px-4 py-2 bg-rose-500/10 rounded-full border border-rose-500/20 text-[10px] font-black tracking-widest text-rose-500 animate-pulse uppercase">Live Voice</div>}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-700 ${moodColor === 'rose' ? 'bg-rose-600 shadow-rose-500/20' : moodColor === 'indigo' ? 'bg-indigo-600 shadow-indigo-500/20' : 'bg-amber-600 shadow-amber-500/20'}`}>
              <Heart className={`w-6 h-6 fill-current ${isConnected ? 'animate-ping' : ''}`} />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 md:px-10 py-10 space-y-12 custom-scrollbar scroll-smooth">
          {messages.length === 0 && !currentInput && !currentOutput ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-10">
              <div className="relative">
                <div className="absolute inset-0 bg-rose-500/20 blur-[80px] rounded-full animate-pulse" />
                <div className="relative w-40 h-40 rounded-[3rem] glass-panel border border-white/10 flex items-center justify-center shadow-2xl float-animation">
                  <Heart className="w-16 h-16 text-rose-500 fill-rose-500/10" />
                </div>
              </div>
              <div className="space-y-4">
                <h2 className="text-4xl font-black playfair italic">Ready for a talk?</h2>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 w-1/3 animate-shimmer" />
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex w-full animate-in fade-in slide-in-from-bottom-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] group ${msg.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
                  <div className={`flex items-center gap-2 mb-3 px-1 text-[10px] font-black tracking-[0.2em] uppercase opacity-40 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5" />}
                    {msg.role === 'user' ? 'YOU' : 'HEY BUDDY'}
                  </div>
                  <div className={`px-7 py-5 rounded-[2.2rem] shadow-2xl relative overflow-hidden backdrop-blur-md transition-all duration-500 ${
                    msg.role === 'user' 
                      ? 'bg-rose-600 text-white rounded-tr-none' 
                      : 'glass-panel text-neutral-100 rounded-tl-none border-white/5'
                  }`}>
                    <div className="whitespace-pre-wrap leading-relaxed text-[18px] font-medium tracking-tight">
                      {msg.text.includes('[Coach\'s Corner]') ? (
                        <>
                          <div className="mb-8">{msg.text.split('[Coach\'s Corner]')[0]}</div>
                          <div className="pt-6 border-t border-white/10 bg-white/5 -mx-7 -mb-5 px-7 pb-5">
                            <div className="text-[11px] font-black text-rose-400 mb-3 flex items-center gap-2 tracking-[0.2em] uppercase">
                              <Sparkles className="w-3.5 h-3.5" /> Coach's Insight
                            </div>
                            <div className="text-[16px] italic text-neutral-300 leading-snug font-normal">
                              {msg.text.split('[Coach\'s Corner]')[1].trim()}
                            </div>
                          </div>
                        </>
                      ) : msg.text}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {currentInput && (
            <div className="flex justify-end opacity-50"><div className="bg-rose-950/20 border border-white/5 rounded-2xl px-6 py-3 italic text-sm">{currentInput}</div></div>
          )}
          {currentOutput && (
            <div className="flex justify-start animate-pulse"><div className="glass-panel border-rose-500/10 rounded-[2.2rem] rounded-tl-none px-8 py-5 text-lg font-medium tracking-tight">{currentOutput}</div></div>
          )}
          <div ref={transcriptEndRef} />
        </main>

        <footer className="p-10 flex flex-col items-center bg-gradient-to-t from-[#050505] to-transparent">
          <div className="relative group">
            {isConnected && <div className="absolute -inset-10 bg-rose-500/20 rounded-full animate-ping pointer-events-none" />}
            <button onClick={handleConnect} disabled={isProcessing} className={`relative w-28 h-28 rounded-[3rem] flex items-center justify-center transition-all duration-700 transform hover:scale-110 active:scale-90 shadow-2xl ${
              isConnected ? 'bg-neutral-900 border-2 border-rose-500/40 text-rose-500' : 'bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-rose-500/30'
            } ${isProcessing ? 'animate-pulse cursor-wait' : 'cursor-pointer'}`}>
              {isConnected ? <MicOff className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
            </button>
          </div>
          <div className="mt-8 text-center space-y-1.5">
            <p className="text-xs font-black text-white uppercase tracking-[0.4em]">{isConnected ? "Listening to you..." : "Connect with Buddy"}</p>
            <p className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase opacity-60">Deep. Personal. Authentic.</p>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-shimmer { animation: shimmer 2s infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(225, 29, 72, 0.2); border-radius: 10px; }
        .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.05); }
      `}</style>
    </div>
  );
};

export default App;