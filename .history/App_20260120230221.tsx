import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { SYSTEM_INSTRUCTION, SAFETY_SETTINGS } from './constants';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import { ChatMessage } from './types';
import { Mic, MicOff, Heart, Zap } from 'lucide-react';

/* -------------------- APP -------------------- */
const App: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [bondScore] = useState(10);
  const [proLevel] = useState(5);

  // 🔐 SOFT MIC GATE
  const [showMicGate, setShowMicGate] = useState(false);

  /* -------- AUDIO & SESSION REFS -------- */
  const inputAudioCtx = useRef<AudioContext | null>(null);
  const outputAudioCtx = useRef<AudioContext | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const processorNode = useRef<ScriptProcessorNode | null>(null);
  const nextStartTime = useRef(0);
  const audioSources = useRef<Set<AudioBufferSourceNode>>(new Set());

  const sessionPromiseRef = useRef<any>(null);
  const activeSessionRef = useRef<any>(null);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentInput, currentOutput]);

  /* -------------------- CLEANUP -------------------- */
  const cleanup = () => {
    setIsConnected(false);
    setIsProcessing(false);

    processorNode.current?.disconnect();
    processorNode.current = null;

    micStream.current?.getTracks().forEach(t => t.stop());
    micStream.current = null;

    inputAudioCtx.current?.close();
    outputAudioCtx.current?.close();
    inputAudioCtx.current = null;
    outputAudioCtx.current = null;

    audioSources.current.forEach(s => s.stop());
    audioSources.current.clear();
    nextStartTime.current = 0;

    sessionPromiseRef.current?.then((s: any) => s.close?.());
    sessionPromiseRef.current = null;
    activeSessionRef.current = null;
  };

  /* -------------------- MAIN CONNECT -------------------- */
  const handleConnect = async () => {
    if (isConnected) {
      cleanup();
      return;
    }

    setError(null);
    setIsProcessing(true);

    // 1️⃣ MIC PERMISSION (ONLY mic error here)
    try {
      micStream.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      setError('Microphone access was denied.');
      setIsProcessing(false);
      return;
    }

    try {
      // 2️⃣ AUDIO CONTEXT (AFTER permission)
      inputAudioCtx.current = new AudioContext({ sampleRate: 16000 });
      outputAudioCtx.current = new AudioContext({ sampleRate: 24000 });

      await inputAudioCtx.current.resume();
      await outputAudioCtx.current.resume();

      const source = inputAudioCtx.current.createMediaStreamSource(micStream.current);
      processorNode.current = inputAudioCtx.current.createScriptProcessor(256, 1, 1);

      processorNode.current.onaudioprocess = e => {
        if (!activeSessionRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        activeSessionRef.current.sendRealtimeInput({
          media: createPcmBlob(input),
        });
      };

      source.connect(processorNode.current);
      processorNode.current.connect(inputAudioCtx.current.destination);

      // 3️⃣ GEMINI CONNECT
      const ai = new GoogleGenAI({
        apiKey: import.meta.env.VITE_GEMINI_API_KEY,
      });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setError(null);              // 🔥 FIX: clear old error
            setIsConnected(true);
            setIsProcessing(false);
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.serverContent?.outputTranscription)
              setCurrentOutput(p => p + m.serverContent.outputTranscription!.text);

            if (m.serverContent?.inputTranscription)
              setCurrentInput(p => p + m.serverContent.inputTranscription!.text);

            const audio = m.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && outputAudioCtx.current) {
              const ctx = outputAudioCtx.current;
              nextStartTime.current = Math.max(ctx.currentTime, nextStartTime.current);

              const buf = await decodeAudioData(decode(audio), ctx, 24000, 1);
              const src = ctx.createBufferSource();
              src.buffer = buf;
              src.connect(ctx.destination);
              src.start(nextStartTime.current);
              nextStartTime.current += buf.duration;
              audioSources.current.add(src);
              src.onended = () => audioSources.current.delete(src);
            }

            if (m.serverContent?.turnComplete) {
              setMessages(prev => [
                ...prev,
                { role: 'user', text: currentInput.trim() },
                { role: 'model', text: currentOutput.trim() },
              ]);
              setCurrentInput('');
              setCurrentOutput('');
            }
          },
          onclose: cleanup,
          onerror: () => {
            setError('Voice service is currently unavailable.');
            cleanup();
          },
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          safetySettings: SAFETY_SETTINGS,
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      sessionPromiseRef.current = sessionPromise;
      sessionPromise.then((s: any) => (activeSessionRef.current = s));
    } catch (err) {
      console.error(err);
      setError('Voice service is currently unavailable.');
      cleanup();
    }
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <header className="p-6 flex justify-between items-center">
        <h1 className="text-2xl font-black">
          Hey <span className="text-rose-500 italic">Buddy</span>
        </h1>
        <div className="flex gap-3">
          <span className="text-xs bg-rose-500/10 px-3 py-1 rounded-full">
            <Zap className="inline w-3 h-3 mr-1" /> Level {proLevel}%
          </span>
          <span className="text-xs bg-indigo-500/10 px-3 py-1 rounded-full">
            <Heart className="inline w-3 h-3 mr-1" /> Bond {bondScore}%
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 space-y-6">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-5 rounded-3xl ${
              m.role === 'user' ? 'bg-rose-600' : 'bg-white/10'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {currentInput && <div className="italic opacity-50">{currentInput}</div>}
        {currentOutput && <div className="opacity-70">{currentOutput}</div>}
        <div ref={transcriptEndRef} />
      </main>

      <footer className="p-8 flex flex-col items-center">
        <button
          onClick={() => setShowMicGate(true)}
          disabled={isProcessing}
          className="w-24 h-24 rounded-full bg-rose-600 flex items-center justify-center"
        >
          {isConnected ? <MicOff size={40} /> : <Mic size={40} />}
        </button>
        <p className="mt-4 text-xs uppercase tracking-widest">
          {isConnected ? 'Listening...' : 'Connect with Buddy'}
        </p>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </footer>

      {/* 🎤 SOFT MIC GATE */}
      {showMicGate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-[#0b0b0b] border border-white/10 rounded-3xl p-8 w-[90%] max-w-sm text-center space-y-6">
            <div className="text-5xl">🎤</div>
            <h2 className="text-xl font-black">Microphone Access Needed</h2>
            <p className="text-sm text-neutral-400">
              Your browser will ask for microphone permission on the next step.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setShowMicGate(false)}
                className="px-5 py-2 rounded-full bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowMicGate(false);
                  handleConnect();
                }}
                className="px-6 py-2 rounded-full bg-rose-600 font-bold"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
