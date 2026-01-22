import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ API Key missing in .env!");
    process.exit(1);
}

// আপনার নতুন কি-টা আসলেই লোড হয়েছে কিনা চেক করার জন্য
console.log(`🔑 Using Key starting with: ${API_KEY.substring(0, 8)}...`);

const genAI = new GoogleGenerativeAI(API_KEY);

// আপনার লিস্টে থাকা সবচেয়ে সেফ মডেলগুলো
const modelsToTry = ["gemini-pro-latest", "gemini-flash-latest", "gemini-1.5-flash-latest"];

async function testModels() {
    for (const modelName of modelsToTry) {
        console.log(`\n🤖 Testing Model: ${modelName}`);
        console.log("⏳ Thinking...");
        
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Say 'System Online'");
            console.log(`✅ SUCCESS with ${modelName}:`, result.response.text());
            return; // একটা কাজ করলে বাকিগুলো আর চেক করবে না
        } catch (error) {
            console.error(`❌ FAILED with ${modelName}`);
            console.log(`Error Status: ${error.status || 'Unknown'}`);
            console.log(`Reason: ${error.message.split('\n')[0]}`);
        }
    }
    console.log("\n⚠️ কোনো মডেলই কাজ করেনি। এর মানে আপনার ইন্টারনেট আইপি (IP) সাময়িক ব্লক হতে পারে।");
}

testModels();