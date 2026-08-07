import "dotenv/config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ Error: GEMINI_API_KEY is not set in environment or .env file.");
  process.exit(1);
}

async function listGeminiModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const models = data.models || [];

    console.log(`\nFound ${models.length} total Gemini models. Filtering for generateContent & Vision capability...\n`);

    const visionCapableModels = models.filter((model) => {
      const supportsGenerate = model.supportedGenerationMethods?.includes("generateContent");
      // All gemini multimodal/flash/pro models support image input
      // Check description or model name or supported generation methods
      const name = model.name.toLowerCase();
      const desc = (model.description || "").toLowerCase();
      
      const isGemini = name.includes("gemini");
      const isEmbedding = name.includes("embedding") || name.includes("aqa");
      const isImagen = name.includes("imagen") || name.includes("image-generation");

      return supportsGenerate && isGemini && !isEmbedding && !isImagen;
    });

    console.log("=== GEMINI MODELS SUPPORTING GENERATECONTENT & VISION ===");
    console.table(
      visionCapableModels.map((m) => ({
        Name: m.name.replace("models/", ""),
        DisplayName: m.displayName,
        InputTokenLimit: m.inputTokenLimit,
        OutputTokenLimit: m.outputTokenLimit,
        SupportedMethods: (m.supportedGenerationMethods || []).join(", "),
        Description: (m.description || "").slice(0, 70) + "..."
      }))
    );

    console.log("\n=== FLASH / FLASH-LITE MODELS (RECOMMENDED FOR VISION) ===");
    const flashModels = visionCapableModels.filter((m) => m.name.toLowerCase().includes("flash"));
    flashModels.forEach((m) => {
      const cleanName = m.name.replace("models/", "");
      const isExpOrPreview = cleanName.includes("exp") || cleanName.includes("preview");
      const status = isExpOrPreview ? "[Preview/Experimental]" : "[Generally Available / Stable]";
      console.log(`- ${cleanName.padEnd(30)} ${status.padEnd(35)} (Tokens: in=${m.inputTokenLimit}, out=${m.outputTokenLimit})`);
    });

    return visionCapableModels;
  } catch (error) {
    console.error("❌ Failed to list Gemini models:", error.message);
    process.exit(1);
  }
}

listGeminiModels();
