import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// একদম লেটেস্ট এবং ফ্রি টায়ার ফ্রেন্ডলি মডেল
const MODEL_NAME = "gemini-2.0-flash-exp"; 

const model = genAI.getGenerativeModel({ model: MODEL_NAME });

async function run() {
  console.log(`🤖 Testing Model: ${MODEL_NAME}`);
  console.log("⏳ Thinking...");
  
  try {
    const result = await model.generateContent("Just say 'Hello Works!'");
    console.log("✅ SUCCESS:", result.response.text());
  } catch (error) {
    console.error("❌ FAILED. Model used:", MODEL_NAME);
    // যদি কোটা এরর আসে, তাহলে নিচের মেসেজ প্রিন্ট হবে
    if (error.status === 429) {
      console.log("⚠️ এই API Key দিয়ে Free Quota শেষ অথবা এই মডেলে অ্যাক্সেস নেই।");
      console.log("💡 সমাধান: একটি সম্পূর্ণ নতুন জিমেইল আইডি দিয়ে Key খুলতে হবে।");
    } else {
      console.error(error);
    }
  }
}

run();