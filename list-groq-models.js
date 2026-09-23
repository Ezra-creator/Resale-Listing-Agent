import "dotenv/config";
import Groq from "groq-sdk";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error("[ERROR] GROQ_API_KEY is not set in environment or .env file.");
  process.exit(1);
}

async function listGroqModels() {
  try {
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const response = await groq.models.list();

    const models = response.data || [];
    console.log(`\nFound ${models.length} total Groq models.\n`);

    console.log("=== GROQ MODELS (ACTIVE & AVAILABLE) ===");
    console.table(
      models.map((m) => ({
        ID: m.id,
        OwnedBy: m.owned_by,
        Active: m.active,
        ContextWindow: m.context_window
      }))
    );

    const llama33 = models.find((m) => m.id.includes("llama-3.3-70b-versatile"));
    console.log("\n=== TARGET MODEL CHECK: llama-3.3-70b-versatile ===");
    if (llama33) {
      console.log(`[OK] "llama-3.3-70b-versatile" is ACTIVE and AVAILABLE on Groq!`);
      console.log(`   - Context window: ${llama33.context_window} tokens`);
      console.log(`   - Owned by: ${llama33.owned_by}`);
    } else {
      console.log(`[WARN] "llama-3.3-70b-versatile" was not found in active models.`);
      const alternativeLlamas = models.filter((m) => m.id.includes("llama"));
      console.log("Available alternatives:", alternativeLlamas.map((m) => m.id).join(", "));
    }

    return models;
  } catch (error) {
    console.error("[ERROR] Failed to list Groq models:", error.message);
    process.exit(1);
  }
}

listGroqModels();
