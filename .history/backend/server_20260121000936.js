import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// safety check
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY missing in .env");
  process.exit(1);
}

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// chat route (TEXT ONLY)
app.post("/chat", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        error: "Text is required",
      });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const result = await model.generateContent(text);
    const reply = result.response.text();

    res.json({ reply });
  } catch (error) {
    console.error("❌ Gemini Error:", error);
    res.status(500).json({
      error: "AI response failed",
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
