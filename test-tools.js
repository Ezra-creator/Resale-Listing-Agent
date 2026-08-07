import "dotenv/config";
import Groq from "groq-sdk";
import { TEXT_MODEL } from "./lib/config.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const tools = [
  {
    type: "function",
    function: {
      name: "analyzeItemPhotos",
      description: "Analyzes uploaded item photos and extracts type, brand, color, material, and condition notes.",
      parameters: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "Active photo session ID"
          }
        },
        required: []
      }
    }
  }
];

async function testGroqToolCall() {
  const response = await groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: "You are a resale agent orchestrator. Call analyzeItemPhotos to inspect the item photos."
      },
      {
        role: "user",
        content: "Analyze this item's photos and notes, then produce a complete resale listing with price suggestion."
      }
    ],
    tools,
    tool_choice: "auto",
    temperature: 0.2
  });

  console.log("Response message:", JSON.stringify(response.choices[0].message, null, 2));
}

testGroqToolCall();
