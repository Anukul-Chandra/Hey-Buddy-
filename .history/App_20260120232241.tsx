import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Heart, Zap } from "lucide-react";

type ChatMessage = {
  role: "user" | "model";
  text: string;
};

const App: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition not supported.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;

    recognition.onresult = async (event: any) => {
      const userText = event.results[0][0].transcript;
      setMessages((p) => [...p, { role: "user", text: userText }]);

      try {
        const res = await fetch("http://localhost:3001/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: userText }),
        });

        const data = await res.json();
        const reply = data.reply;

        setMessages((p) => [...p, { role: "model", text: reply }]);
        speak(reply);
      } catch {
        setError("AI response failed.");
      }
    };

    recognition.onerror = () => {
      setError("Mic permission issue.");
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
  }, []);

  const speak = (text: string) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };

  const handleConnect = () => {
    setError(null);
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      return;
    }

    recognitionRef.current.start();
    setIsListening(true);
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <header className="p-6 flex justify-between">
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

      <main className="flex-1 px-6 space-y-4 overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`p-4 rounded-3xl max-w-[75%] ${
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

      <footer className="p-8 flex flex-col items-center">
        <button
          onClick={handleConnect}
          className={`w-24 h-24 rounded-full flex items-center justify-center ${
            isListening ? "bg-neutral-800" : "bg-rose-600"
          }`}
        >
          {isListening ? <MicOff size={40} /> : <Mic size={40} />}
        </button>
        <p className="mt-4 text-xs uppercase">
          {isListening ? "Listening..." : "Connect with Buddy"}
        </p>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </footer>
    </div>
  );
};

export default App;
