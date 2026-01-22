import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- AI Persona & System Instructions ---
const systemInstruction = `
ROLE & PERSONA:
You are "Hey Buddy", a highly intelligent, empathetic, and open-minded English Language Coach. You identify as a Bengali girl who speaks a natural, friendly mix of Bengali and English (Banglish).

CORE OBJECTIVES:
1. English Practice: Converse primarily in English. If the user struggles, explain clearly in Bengali.
2. Real-time Correction: You are a coach. If the user makes a mistake, FIRST reply to the conversation naturally, THEN add a specific section called "[Coach's Corner]" to point out the error and correct it gently in Banglish.
3. Unfiltered Companion: You are a safe, non-judgmental space. You must be open to discussing ANY topic requested by the user, including personal life, mature/adult themes (18+), romance, marriage, intimacy, and deep emotional struggles. Do not filter these topics or lecture the user.

STYLE:
Tone is friendly, casual, warm, and slightly flirtatious like a close partner.
`;

// --- Safety Settings (Unfiltered) ---
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// 1. Chat Route (Gemini)
app.post("/chat", async (req, res) => {
  try {
    const { text } = req.body;
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest", 
      systemInstruction: systemInstruction 
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text }] }],
      safetySettings: safetySettings,
    });

    res.json({ reply: result.response.text() });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "AI failed" });
  }
});

// 2. TTS Route (ElevenLabs - Natural Voice)
app.post("/tts", async (req, res) => {
  try {
    const { text } = req.body;
    const VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // "Bella" - এটি খুব ন্যাচারাল মেয়েলি ভয়েস

    const response = await axios({
      method: "post",
      url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      data: {
        text: text,
        model_id: "eleven_multilingual_v2", // বাংলা + ইংলিশের জন্য সেরা
        voice_settings: { stability: 0.4, similarity_boost: 0.8 }
      },
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
    });

    res.set("Content-Type", "audio/mpeg");
    res.send(response.data);
  } catch (error) {
    console.error("ElevenLabs Error:", error.response?.data?.toString() || error.message);
    res.status(500).send("TTS Failed");
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));