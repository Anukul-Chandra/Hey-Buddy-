import { useState, useEffect, useRef } from "react";

const BACKEND_URL = "http://127.0.0.1:3001";

// ব্রাউজারের Speech Recognition সাপোর্ট চেক
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
  recognition.continuous = false;
  recognition.lang = "en-US"; // ডিফল্ট ভাষা ইংলিশ, তবে সে বাংলাও বুঝবে
  recognition.interimResults = false;
}

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // অটো স্ক্রল নিচের দিকে রাখার জন্য
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // AI-কে কথা বলানোর ফাংশন (Text-to-Speech)
  const speak = (text: string) => {
    // আগের কোনো কথা চলতে থাকলে সেটা বন্ধ করা
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // ভয়েস লিস্ট থেকে বাংলাদেশী বা ইন্ডিয়ান ফিমেইল ভয়েস খোঁজা
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => 
      (v.name.includes("Google") || v.name.includes("Female") || v.name.includes("Bengali") || v.name.includes("India")) && 
      (v.lang.startsWith("bn") || v.lang.startsWith("en-IN"))
    );

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.pitch = 1.2; // একটু মিষ্টি গলার জন্য পিচ বাড়ানো
    utterance.rate = 1.0;  // কথা বলার গতি
    window.speechSynthesis.speak(utterance);
  };

  // কথা রেকর্ড শুরু করার ফাংশন (Speech-to-Text)
  const startListening = () => {
    if (!recognition) {
      alert("Your browser does not support Speech Recognition.");
      return;
    }
    setIsListening(true);
    recognition.start();
  };

  if (recognition) {
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      // কথা শেষ হলে অটোমেটিক মেসেজ পাঠিয়ে দিবে
      handleSendMessage(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setError("Mic error. Please try again.");
    };
  }

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    setError("");
    setLoading(true);
    setMessages((prev) => [...prev, `You: ${textToSend}`]);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, `Buddy: ${data.reply}`]);
        // AI-এর রিপ্লাই শোনানো
        speak(data.reply);
      } else {
        throw new Error("No reply");
      }
    } catch (err) {
      setError("AI failed to respond.");
    } finally {
      setLoading(false);
      setInput("");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px", fontFamily: "sans-serif" }}>
      
      <h1 style={{ fontSize: "2rem", marginBottom: "30px" }}>
        Hey <span style={{ color: "#ff0055" }}>Buddy</span> 🎤
      </h1>

      {/* চ্যাট এরিয়া */}
      <div style={{ width: "100%", maxWidth: "600px", flex: 1, overflowY: "auto", marginBottom: "20px", padding: "10px" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            background: msg.startsWith("You") ? "#ff0055" : "#222",
            padding: "15px", borderRadius: "15px", marginBottom: "15px", alignSelf: msg.startsWith("You") ? "flex-end" : "flex-start",
            lineHeight: "1.5", border: msg.includes("[Coach's Corner]") ? "1px solid #555" : "none"
          }}>
            {msg.split("\n").map((line, index) => (
              <p key={index} style={{ margin: 0 }}>{line}</p>
            ))}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* ইনপুট এবং কন্ট্রোলস */}
      <div style={{ width: "100%", maxWidth: "600px", display: "flex", flexDirection: "column", gap: "15px", position: "sticky", bottom: "20px", background: "#000", padding: "10px" }}>
        
        {error && <p style={{ color: "#ff4444", textAlign: "center" }}>{error}</p>}

        <div style={{ display: "flex", gap: "10px" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or use the mic..."
            style={{ flex: 1, padding: "15px", borderRadius: "15px", background: "#111", color: "#fff", border: "1px solid #333", resize: "none", fontSize: "16px" }}
          />
          
          <button
            onClick={startListening}
            style={{
              background: isListening ? "#fff" : "#ff0055",
              color: isListening ? "#000" : "#fff",
              border: "none", width: "60px", height: "60px", borderRadius: "50%", cursor: "pointer", fontSize: "24px", transition: "0.3s"
            }}
          >
            {isListening ? "🛑" : "🎤"}
          </button>
        </div>

        <button
          onClick={() => handleSendMessage(input)}
          disabled={loading}
          style={{
            background: "#fff", color: "#000", border: "none", padding: "15px", borderRadius: "30px", cursor: "pointer", fontWeight: "bold", fontSize: "16px"
          }}
        >
          {loading ? "Thinking..." : "Send Message"}
        </button>
      </div>
    </div>
  );
}