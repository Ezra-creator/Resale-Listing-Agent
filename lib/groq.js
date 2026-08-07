import "dotenv/config";
import Groq from "groq-sdk";
import { TEXT_MODEL } from "./config.js";

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  throw new Error("Missing GROQ_API_KEY in environment or .env file.");
}

const groq = new Groq({ apiKey });

/**
 * Executes a structured Groq LLM completion with json_object enforcement
 * @param {Object} options
 * @param {string} options.systemPrompt
 * @param {string} options.userPrompt
 * @param {string} [options.modelName]
 * @returns {Promise<any>}
 */
export async function generateGroqStructured({ systemPrompt, userPrompt, modelName = TEXT_MODEL }) {
  try {
    const response = await groq.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nCRITICAL: Return ONLY a valid, parseable JSON object matching the requested schema. Do not enclose in markdown fences or include explanations outside the JSON.`
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Groq returned an empty response.");
    }

    return JSON.parse(content);
  } catch (error) {
    throw new Error(`[Groq API Error - ${modelName}]: ${error.message}`);
  }
}
