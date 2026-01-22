import React, { useState } from "react";

const API_BASE = "http://localhost:3001";

const App: React.FC = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "ai"; text: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    setError(null);
    setLoading(true);

    const userText = input;
    setInput("");

    setMessages((prev) => [...prev, { role: "user", text: userText }]);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: userText }),
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "ai", text: data.reply },
      ]);
    } catch (err) {
      console.error(err);
      setError("AI response failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold mb-6">
        Hey <span className="text-rose-500">Buddy</span>
      </h1>

      <div className="w-full max-w-xl space-y-4 mb-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl ${
              m.role === "user"
                ? "bg-rose-600 text-right"
                : "bg-white/10 text-left"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type something..."
        className="w-full max-w-xl p-4 rounded-xl bg-neutral-900 outline-none resize-none"
        rows={3}
      />

      <button
        onClick={sendMessage}
        disabled={loading}
        className="mt-4 px-8 py-3 rounded-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
      >
        {loading ? "Thinking..." : "Send"}
      </button>

      {error && <p className="text-red-500 mt-4">{error}</p>}
    </div>
  );
};

export default App;
