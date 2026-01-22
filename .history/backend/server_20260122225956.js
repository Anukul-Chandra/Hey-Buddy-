import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ১. চেক করছি API KEY লোড হয়েছে কিনা
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ ERROR: .env ফাইলে GEMINI_API_KEY পাওয়া যাচ্ছে না!");
  process.exit(1);
} else {
  console.log(`🔑 API Key Loaded (Length: ${apiKey.length} characters)`);
}

const genAI = new GoogleGenerativeAI(apiKey);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/chat", async (req, res) => {
  try {
    const { text } = req.body;
    console.log("📨 মেসেজ আসছে:", text); // ফ্রন্টএন্ড থেকে মেসেজ আসছে কিনা চেক

    if (!text) return res.status(400).json({ error: "No text provided" });

    // ২. লেটেস্ট লাইব্রেরিতে এই মডেলটা বেস্ট
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(text);
    const response = await result.response;
    const reply = response.text();

    console.log("✅ রিপ্লাই তৈরি:", reply.slice(0, 50) + "..."); 
    res.json({ reply });

  } catch (error) {
    // ৩. এইখানে আসল এরর ধরা পরবে
    console.error("\n🔥 SERVER ERROR DETAIL:\n", error);
    
    // ব্রাউজারে এররটা পাঠানো যাতে দেখতে পারেন
    res.status(500).json({ 
        error: "Server Error", 
        details: error.message 
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});