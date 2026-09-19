"use server";

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import Groq from "groq-sdk";
import { ResaleReport } from "@/types/listing";

const VISION_MODEL = "gemini-flash-latest";
const VISION_FALLBACK_MODEL = "gemini-3.5-flash";
const TEXT_MODEL = "openai/gpt-oss-120b";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function detectMimeType(buffer: Buffer): string | null {
  if (buffer && buffer.length >= 12) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return "image/png";
    }
    if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
      return "image/webp";
    }
  }
  return null;
}

function parseJsonClean(text: string): any {
  if (!text) return {};
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return JSON.parse(cleaned);
}

export type GenerateActionResult =
  | { success: true; data: ResaleReport }
  | { success: false; error: string };

export async function generateResaleListingAction(formData: FormData): Promise<GenerateActionResult> {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (!geminiKey || geminiKey.includes("your_gemini_api_key")) {
      return {
        success: false,
        error: "Missing Gemini API Key. Please configure GEMINI_API_KEY in your .env file.",
      };
    }
    if (!groqKey || groqKey.includes("your_groq_api_key")) {
      return {
        success: false,
        error: "Missing Groq API Key. Please configure GROQ_API_KEY in your .env file.",
      };
    }

    const notes = (formData.get("notes") as string) || "";
    const files = formData.getAll("photos") as File[];

    if (!files || files.length === 0) {
      return { success: false, error: "Please upload at least 1 item photo." };
    }
    if (files.length > 4) {
      return { success: false, error: "Maximum of 4 photos allowed per item." };
    }

    // Process and validate real image buffers
    const imageParts: { inlineData: { data: string; mimeType: string } }[] = [];
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
        return { success: false, error: `"${file.name}" exceeds the 10MB limit.` };
      }

      let mime = file.type || detectMimeType(buffer);
      if (!mime || !ALLOWED_MIME_TYPES.includes(mime)) {
        return {
          success: false,
          error: `"${file.name}" is unsupported. Please upload JPG, PNG, or WebP.`,
        };
      }

      imageParts.push({
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: mime,
        },
      });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const groq = new Groq({ apiKey: groqKey });

    // Helper to generate Gemini content with fallback & retry
    const runGeminiWithFallback = async (config: {
      schema: any;
      contents: any[];
      temperature?: number;
    }) => {
      const modelsToTry = [VISION_MODEL, VISION_FALLBACK_MODEL];
      let lastErr: any;

      for (const modelName of modelsToTry) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: config.schema,
                temperature: config.temperature ?? 0.2,
              },
            });
            const result = await model.generateContent(config.contents);
            return parseJsonClean(result.response.text());
          } catch (err: any) {
            lastErr = err;
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
      }
      throw lastErr;
    }

    // STEP 1: Vision Analysis
    const visionSchema = {
      type: SchemaType.OBJECT,
      properties: {
        item_type: { type: SchemaType.STRING },
        brand: { type: SchemaType.STRING, nullable: true },
        color: { type: SchemaType.STRING },
        material: { type: SchemaType.STRING, nullable: true },
        visible_condition_notes: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        estimated_category: { type: SchemaType.STRING },
      },
      required: ["item_type", "color", "visible_condition_notes", "estimated_category"],
    };

    const visionPrompt = `Analyze these photos of a single resale item.
Extract:
1. item_type: Concise, accurate product classification (e.g. Leather Bomber Jacket, High-Top Canvas Sneakers).
2. brand: Brand name identified on tag, hardware, or print (null if unbranded).
3. color: Dominant colors.
4. material: Primary material (e.g. Full-Grain Leather, 100% Cotton, Denim) or null.
5. visible_condition_notes: Specific observations regarding signs of wear, distressing, hardware function, stitching, and tags.
6. estimated_category: Standard retail category.`;

    const itemAnalysis = await runGeminiWithFallback({
      schema: visionSchema,
      contents: [...imageParts, visionPrompt],
    });

    // STEP 2: Condition Grade & Wear Details
    const conditionSchema = {
      type: SchemaType.OBJECT,
      properties: {
        condition_grade: {
          type: SchemaType.STRING,
          description: "Strictly one of: 'New with tags', 'Like new', 'Good', 'Fair', 'Worn'",
        },
        condition_reasoning: { type: SchemaType.STRING },
        flaws_to_disclose: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
      },
      required: ["condition_grade", "condition_reasoning", "flaws_to_disclose"],
    };

    const conditionPrompt = `Based on these item observations:
Visual notes:
${(itemAnalysis.visible_condition_notes || []).map((n: string) => `• ${n}`).join("\n")}

Seller notes:
${notes || "None provided."}

Assign exactly one standard grade: 'New with tags', 'Like new', 'Good', 'Fair', or 'Worn'.
List any specific flaws or wear points buyers will want to know about before purchasing.`;

    const conditionData = await runGeminiWithFallback({
      schema: conditionSchema,
      contents: [conditionPrompt],
    });

    // STEP 3: Market Pricing Comps
    const priceCompletion = await groq.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a resale market pricing specialist. Estimate fair secondary market comps in USD based on recent sales. Return ONLY JSON matching:
{
  "price_range": {
    "low": number,
    "high": number,
    "suggested": number
  },
  "reasoning": string
}`,
        },
        {
          role: "user",
          content: `Item: ${itemAnalysis.item_type}
Brand: ${itemAnalysis.brand || "Unbranded"}
Condition: ${conditionData.condition_grade}
Material: ${itemAnalysis.material || "Standard"}

Provide fair price range and target price.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    const priceData = parseJsonClean(priceCompletion.choices[0]?.message?.content || "{}");

    // STEP 4: High-Converting Seller Listing Copy
    const listingCompletion = await groq.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an experienced top-rated reseller. Write a clean, natural listing that feels written by a real human seller. Avoid robotic headings. Write clear descriptive paragraphs followed by specs. Return ONLY JSON:
{
  "title": string (search-friendly, under 80 chars),
  "description": string (natural, informative, seller-style copy),
  "category": string,
  "tags": string[]
}`,
        },
        {
          role: "user",
          content: `Item: ${itemAnalysis.item_type}
Brand: ${itemAnalysis.brand || "Unbranded"}
Color: ${itemAnalysis.color}
Material: ${itemAnalysis.material || "Standard"}
Condition: ${conditionData.condition_grade}
Notes/Flaws: ${(conditionData.flaws_to_disclose || []).join(", ")}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    const baseListing = parseJsonClean(listingCompletion.choices[0]?.message?.content || "{}");

    // STEP 5: Platform-Specific Tailored Copy
    const platformCompletion = await groq.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an expert reseller tailoring a product listing for eBay, Poshmark, and Facebook Marketplace.

STYLE GUIDELINES (DO NOT SOUND LIKE AN AI):
- eBay: Title under 80 characters (keyword-frontloaded with brand, style, size/color, condition). Description should be clean and concise with key details and condition notes.
- Poshmark: Title under 50 characters. Description should be friendly, clear, and mention closet bundle discounts. Max 1 or 2 emojis total.
- Facebook Marketplace: Title under 100 characters. Clean description with cash/Venmo upon pickup, smoke-free home mention, local area pickup terms. NO hashtags.

Return ONLY JSON:
{
  "ebay": {
    "title": string (max 80 chars),
    "description": string,
    "category_suggestion": string,
    "suggested_price": number
  },
  "poshmark": {
    "title": string (max 50 chars),
    "description": string,
    "category_suggestion": string,
    "suggested_price": number
  },
  "facebook_marketplace": {
    "title": string (max 100 chars),
    "description": string,
    "suggested_price": number
  }
}`,
        },
        {
          role: "user",
          content: `Item: ${itemAnalysis.item_type}
Brand: ${itemAnalysis.brand || "Unbranded"}
Color: ${itemAnalysis.color}
Material: ${itemAnalysis.material || "Standard"}
Condition: ${conditionData.condition_grade}
Flaws: ${(conditionData.flaws_to_disclose || []).join(", ")}
Price Comps: Low $${priceData.price_range?.low || 50}, High $${priceData.price_range?.high || 100}, Target $${priceData.price_range?.suggested || 75}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    const platformListings = parseJsonClean(platformCompletion.choices[0]?.message?.content || "{}");

    // Enforce character limits strictly
    if (platformListings.ebay?.title && platformListings.ebay.title.length > 80) {
      platformListings.ebay.title = platformListings.ebay.title.slice(0, 80);
    }
    if (platformListings.poshmark?.title && platformListings.poshmark.title.length > 50) {
      platformListings.poshmark.title = platformListings.poshmark.title.slice(0, 50);
    }
    if (platformListings.facebook_marketplace?.title && platformListings.facebook_marketplace.title.length > 100) {
      platformListings.facebook_marketplace.title = platformListings.facebook_marketplace.title.slice(0, 100);
    }

    const report: ResaleReport = {
      item_type: itemAnalysis.item_type,
      brand: itemAnalysis.brand || null,
      condition_grade: conditionData.condition_grade,
      price_range: priceData.price_range || {
        low: 50,
        high: 100,
        suggested: 75,
      },
      title: baseListing.title || itemAnalysis.item_type,
      description: baseListing.description || "",
      category: itemAnalysis.estimated_category || baseListing.category || "General",
      tags: baseListing.tags || [],
      flaws_to_disclose: conditionData.flaws_to_disclose || [],
      platform_listings: platformListings,
    };

    return {
      success: true,
      data: report,
    };
  } catch (err: any) {
    console.error("Listing generation server error:", err);
    return {
      success: false,
      error: err?.message || "An unexpected error occurred while generating the listing.",
    };
  }
}
