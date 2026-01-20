import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// 🔑 Load .env FIRST
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔍 Debug check (1 time)
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY missing");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/connect", async (req, res) => {
  try {
    const session = await ai.live.connect({
      model: "gemini-2.5-flash-native-audio-preview-12-2025",
      config: {
        responseModalities: ["AUDIO"],
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI connection failed" });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
