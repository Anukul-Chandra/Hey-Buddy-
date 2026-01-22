import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ API Key Missing! .env file check korun.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// আপনার লিস্টে এই মডেলটি আছে, তাই এটি কাজ করবেই
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function run() {
  console.log("Thinking... (Please wait)");
  try {
    const result = await model.generateContent("Hello Gemini, are you working?");
    const response = await result.response;
    const text = response.text();
    console.log("✅ SUCCESS! AI says:");
    console.log(text);
  } catch (error) {
    console.error("❌ FAILED. Error details:");
    console.log(error);
  }
}

run();