import { useState, useEffect, useRef } from "react";

const BACKEND_URL = "http://127.0.0.1:3001";

// Speech Recognition Setup
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{sender: string, text: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Natural Voice Output (ElevenLabs) ---
  const playNaturalVoice = async (text: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS failed");
      
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (err) {
      console.error("TTS Error:", err);
    }
  };

  // --- Speech to Text Logic ---
  const startListening = () => {
    if (!recognition) return alert("Browser not supported");
    setIsListening(true);
    recognition.start();
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      handleSendMessage(transcript);
    };
    recognition.onerror = () => setIsListening(false);
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    setLoading(true);
    setMessages(prev => [...prev, { sender: "You", text: textToSend }]);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend }),
      });
      const data = await res.json();
      
      if (data.reply) {
        setMessages(prev => [...prev, { sender: "Buddy", text: data.reply }]);
        playNaturalVoice(data.reply); // ElevenLabs ভয়েস প্লে হবে
      }
    } catch (err) {
      console.error("Chat Error:", err);
    } finally {
      setLoading(false);
      setInput("");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px" }}>
      <h1 style={{ color: "#ff0055" }}>Hey Buddy 🎤</h1>

      <div style={{ width: "100%", maxWidth: "600px", flex: 1, overflowY: "auto", padding: "10px" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            background: msg.sender === "You" ? "#ff0055" : "#222",
            padding: "15px", borderRadius: "15px", marginBottom: "15px", whiteSpace: "pre-wrap"
          }}>
            <strong>{msg.sender}:</strong> {msg.text}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div style={{ width: "100%", maxWidth: "600px", display: "flex", gap: "10px", padding: "20px", background: "#000", position: "sticky", bottom: 0 }}>
        <textarea 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type something..."
          style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#111", color: "#fff", border: "1px solid #333" }}
        />
        <button onClick={startListening} style={{ width: "50px", height: "50px", borderRadius: "50%", border: "none", background: isListening ? "#fff" : "#ff0055", cursor: "pointer", fontSize: "20px" }}>
          {isListening ? "🛑" : "🎤"}
        </button>
        <button onClick={() => handleSendMessage(input)} disabled={loading} style={{ padding: "0 20px", borderRadius: "10px", border: "none", background: "#fff", fontWeight: "bold", cursor: "pointer" }}>
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}