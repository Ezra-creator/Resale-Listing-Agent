import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const candidateModels = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash"
];

async function testMore() {
  for (const modelName of candidateModels) {
    try {
      console.log(`Testing model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Hello, reply with 1 short sentence.");
      console.log(`[OK] ${modelName} responded:`, result.response.text().trim());
    } catch (err) {
      console.log(`[ERROR] ${modelName} failed:`, err.message);
    }
  }
}

testMore();
