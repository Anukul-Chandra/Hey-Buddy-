import React, { useEffect, useRef, useState } from "react";
import { GoogleGenAI } from "@google/genai";
import { Mic, MicOff, Heart, Zap } from "lucide-react";

/* ---------------- TYPES ---------------- */
type ChatMessage = {
  role: "user" | "model";
  text: string;
};

/* ---------------- API KEY SAFE GUARD ---------------- */
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌ VITE_GEMINI_API_KEY is missing");
}

/* ---------------- APP ---------------- */
const App: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const recognitionRef = useRef<any>(null);

  /* ---------------- INIT GEMINI ---------------- */
  const ai = new GoogleGenAI({
    apiKey: API_KEY,
  });

  /* ---------------- INIT SPEECH RECOGNITION ---------------- */
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = async (event: any) => {
      const userText = event.results[0][0].transcript;

      setMessages((prev) => [...prev, { role: "user", text: userText }]);

      try {
        const model = ai.getGenerativeModel({
          model: "gemini-1.5-flash",
        });

        const result = await model.generateContent(userText);
        const reply = result.response.text();

        setMessages((prev) => [
          ...prev,
          { role: "model", text: reply },
        ]);

        speak(reply);
      } catch (err) {
        console.error(err);
        setError("AI response failed.");
      }
    };

    recognition.onerror = () => {
      setError("Microphone permission denied or unavailable.");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  /* ---------------- TEXT TO SPEECH ---------------- */
  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  /* ---------------- MIC BUTTON ---------------- */
  const handleConnect = () => {
    setError(null);

    if (!API_KEY) {
      setError("API key is missing. Please check .env.local");
      return;
    }

    if (!recognitionRef.current) {
      setError("Speech recognition not available.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setError("Unable to access microphone.");
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Header */}
      <header className="p-6 flex justify-between items-center">
        <h1 className="text-2xl font-black">
          Hey <span className="text-rose-500 italic">Buddy</span>
        </h1>
        <div className="flex gap-3">
          <span className="text-xs bg-rose-500/10 px-3 py-1 rounded-full">
            <Zap className="inline w-3 h-3 mr-1" /> Level 5%
          </span>
          <span className="text-xs bg-indigo-500/10 px-3 py-1 rounded-full">
            <Heart className="inline w-3 h-3 mr-1" /> Bond 10%
          </span>
        </div>
      </header>

      {/* Chat */}
      <main className="flex-1 overflow-y-auto px-6 space-y-6">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] p-5 rounded-3xl ${
                m.role === "user"
                  ? "bg-rose-600"
                  : "bg-white/10"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </main>

      {/* Footer */}
      <footer className="p-8 flex flex-col items-center">
        <button
          onClick={handleConnect}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
            isListening ? "bg-neutral-800" : "bg-rose-600"
          }`}
        >
          {isListening ? <MicOff size={40} /> : <Mic size={40} />}
        </button>

        <p className="mt-4 text-xs uppercase tracking-widest">
          {isListening ? "Listening..." : "Connect with Buddy"}
        </p>

        {error && (
          <p className="text-red-400 text-xs mt-2 text-center">
            {error}
          </p>
        )}
      </footer>
    </div>
  );
};

export default App;
