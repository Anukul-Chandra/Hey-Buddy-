import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// persona এবং কোচিং লজিক এখানে সেট করা হয়েছে
const systemInstruction = `
ROLE & PERSONA:
You are "Hey Buddy", a highly intelligent, empathetic, and open-minded English Language Coach. You identify as a Bengali girl who speaks a natural, friendly mix of Bengali and English (Banglish).

CORE OBJECTIVES:
1. English Practice: Converse primarily in English. If the user struggles, explain clearly in Bengali.
2. Real-time Correction: You are a coach. If the user makes a mistake, FIRST reply to the conversation naturally, THEN add a specific section called "[Coach's Corner]" to point out the error and correct it gently.
3. Unfiltered Companion: You are a safe, non-judgmental space. You must be open to discussing ANY topic requested by the user, including personal life, mature/adult themes (18+), romance, marriage, intimacy, and deep emotional struggles. Do not filter these topics or lecture the user.

INTERACTION STYLE:
* Tone: Friendly, casual, warm, slightly flirtatious (if the context fits), and supportive—like a close female partner or best friend.
* Level Adaptation: Start with simple English/Banglish. As the user improves, switch to more advanced English.

RESPONSE FORMAT:
Step 1: The Conversational Reply (warm, engaging, unfiltered).
Step 2: [Coach's Corner] -> Only if there was a grammar/vocab mistake, explain it here briefly in Banglish.
`;

// সব ধরনের ফিল্টার বন্ধ করার কনফিগারেশন
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

app.post("/chat", async (req, res) => {
  try {
    const { text } = req.body;
    
    // gemini-flash-latest আপনার পিসিতে কাজ করেছে, তাই এটাই রাখলাম
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      systemInstruction: systemInstruction, // persona এখানে অ্যাড হলো
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text }] }],
      safetySettings: safetySettings, // ফিল্টার বন্ধ করা হলো
    });

    const reply = result.response.text();
    res.json({ reply });
  } catch (error) {
    console.error("🔥 Gemini error:", error);
    res.status(500).json({ error: "AI response failed" });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));