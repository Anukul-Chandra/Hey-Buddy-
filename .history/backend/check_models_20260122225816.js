import dotenv from "dotenv";
import fetch from "node-fetch"; // যদি এটি না থাকে, বিল্ট-ইন fetch ব্যবহার হবে (Node 18+)

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

console.log("🔍 Checking available models for your API Key...");

async function listModels() {
  try {
    const response = await fetch(URL);
    const data = await response.json();

    if (data.error) {
        console.error("❌ Google API Error:", data.error.message);
    } else {
        console.log("✅ Available Models for YOU:");
        // আমরা শুধু মডেলের নামগুলো প্রিন্ট করব
        const validModels = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
        validModels.forEach(m => console.log(`👉 ${m.name.replace("models/", "")}`));
    }
  } catch (error) {
    console.error("🔥 Network Error:", error.message);
  }
}

listModels();