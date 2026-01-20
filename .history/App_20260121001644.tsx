import { useState } from "react";

const BACKEND_URL = "http://localhost:3001";

export default function App() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    setError("");
    setReply("");
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: input,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      setReply(data.reply);
    } catch (err: any) {
      setError(err.message || "AI response failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">
        Hey <span className="text-rose-500">Buddy</span>
      </h1>

      <textarea
        className="w-full max-w-md p-3 rounded bg-neutral-900 text-white outline-none"
        rows={3}
        placeholder="Type something..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <button
        onClick={sendMessage}
        disabled={loading || !input.trim()}
        className="px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
      >
        {loading ? "Thinking..." : "Send"}
      </button>

      {reply && (
        <div className="max-w-md bg-white/10 p-4 rounded-xl">
          <strong>Buddy:</strong>
          <p className="mt-2">{reply}</p>
        </div>
      )}

      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
