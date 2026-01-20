import { useState, useRef } from "react";

const BACKEND_URL = "http://localhost:3001/chat";

export default function App() {
  const [status, setStatus] = useState<
    "idle" | "requesting" | "listening" | "thinking" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const requestMicAndStart = async () => {
    try {
      setStatus("requesting");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = sendAudioToBackend;

      mediaRecorder.start();
      setStatus("listening");

      // auto stop after 4 seconds
      setTimeout(() => {
        mediaRecorder.stop();
        stream.getTracks().forEach((t) => t.stop());
        setStatus("thinking");
      }, 4000);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("Microphone permission denied.");
    }
  };

  const sendAudioToBackend = async () => {
    try {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      const formData = new FormData();
      formData.append("audio", audioBlob);

      const res = await fetch(BACKEND_URL, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Backend error");

      const data = await res.json();
      setMessage(data.reply || "No response");
      setStatus("idle");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("AI response failed.");
    }
  };

  return (
    <div
      style={{
        background: "#000",
        color: "#fff",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        fontFamily: "sans-serif",
      }}
    >
      <h1>
        Hey <span style={{ color: "#ff2d55" }}>Buddy</span>
      </h1>

      <button
        onClick={requestMicAndStart}
        disabled={status === "listening" || status === "thinking"}
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          border: "none",
          background: "#ff2d55",
          color: "#fff",
          fontSize: 30,
          cursor: "pointer",
        }}
      >
        🎤
      </button>

      {status === "idle" && <p>CONNECT WITH BUDDY</p>}
      {status === "requesting" && <p>Requesting microphone…</p>}
      {status === "listening" && <p>Listening…</p>}
      {status === "thinking" && <p>Thinking…</p>}
      {status === "error" && (
        <p style={{ color: "red" }}>{message}</p>
      )}

      {message && status === "idle" && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: "#111",
            borderRadius: 8,
            maxWidth: 400,
            textAlign: "center",
          }}
        >
          🤖 {message}
        </div>
      )}
    </div>
  );
}
