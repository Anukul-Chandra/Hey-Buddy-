import React, { useState } from "react";

interface Message {
  role: "user" | "model";
  text: string;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);

    const userMsg: Message = { role: "user", text: input };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch("http://localhost:3001/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });

      if (!res.ok) {
        throw new Error("Backend error");
      }

      const data = await res.json();

      setMessages(prev => [
        ...prev,
        { role: "model", text: data.reply },
      ]);
    } catch (err) {
      setError("AI response failed");
    } finally {
      setLoading(false);
      setInput("");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="p-6 text-2xl font-bold">
        Hey <span className="text-rose-500">Buddy</span>
      </header>

      <main className="flex-1 p-6 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-xl p-4 rounded-2xl ${
              m.role === "user"
                ? "bg-rose-600 ml-auto"
                : "bg-white/10"
            }`}
          >
            {m.text}
          </div>
        ))}
        {error && <p className="text-red-400">{error}</p>}
      </main>

      <footer className="p-6 flex gap-3">
        <input
          className="flex-1 p-3 rounded-xl text-black"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type something..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="px-6 py-3 bg-rose-600 rounded-xl"
        >
          {loading ? "..." : "Send"}
        </button>
      </footer>
    </div>
  );
};

export default App;
