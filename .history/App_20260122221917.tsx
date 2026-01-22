import { useState } from "react";

const BACKEND_URL = "http://127.0.0.1:3001";
export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    setError("");
    setLoading(true);

    const userText = input;
    setInput("");
    setMessages((prev) => [...prev, `You: ${userText}`]);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: userText }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      if (!data.reply) {
        throw new Error("No reply from AI");
      }

      setMessages((prev) => [...prev, `Buddy: ${data.reply}`]);
    } catch (err) {
      console.error(err);
      setError("AI response failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        padding: "20px",
      }}
    >
      <h1>
        Hey <span style={{ color: "#ff0055" }}>Buddy</span>
      </h1>

      <div style={{ width: "100%", maxWidth: "600px" }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              background: msg.startsWith("You")
                ? "#ff0055"
                : "#222",
              padding: "14px",
              borderRadius: "14px",
              marginBottom: "10px",
            }}
          >
            {msg}
          </div>
        ))}
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type something..."
        style={{
          width: "100%",
          maxWidth: "600px",
          padding: "14px",
          borderRadius: "14px",
          background: "#111",
          color: "#fff",
          border: "none",
          resize: "none",
        }}
      />

      <button
        onClick={sendMessage}
        disabled={loading}
        style={{
          background: "#ff0055",
          color: "#fff",
          border: "none",
          padding: "14px 30px",
          borderRadius: "30px",
          cursor: "pointer",
          fontSize: "16px",
        }}
      >
        {loading ? "Thinking..." : "Send"}
      </button>

      {error && (
        <p style={{ color: "red", marginTop: "10px" }}>{error}</p>
      )}
    </div>
  );
}
