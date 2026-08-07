"use server";

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import Groq from "groq-sdk";
import { ResaleReport } from "@/types/listing";

const VISION_MODEL = "gemini-flash-latest";
const TEXT_MODEL = "llama-3.3-70b-versatile";

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

export async function generateResaleListingAction(formData: FormData): Promise<ResaleReport> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!geminiKey || geminiKey.includes("your_gemini_api_key")) {
    throw new Error("GEMINI_API_KEY is not configured. Please add your key to the .env file.");
  }
  if (!groqKey || groqKey.includes("your_groq_api_key")) {
    throw new Error("GROQ_API_KEY is not configured. Please add your key to the .env file.");
  }

  const notes = (formData.get("notes") as string) || "";
  const files = formData.getAll("photos") as File[];

  if (!files || files.length === 0) {
    throw new Error("Please upload at least 1 item photo.");
  }
  if (files.length > 4) {
    throw new Error("A maximum of 4 photos can be analyzed at once.");
  }

  // Process and validate real image buffers
  const imageParts: { inlineData: { data: string; mimeType: string } }[] = [];
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`"${file.name}" exceeds the 10MB limit.`);
    }

    let mime = file.type || detectMimeType(buffer);
    if (!mime || !ALLOWED_MIME_TYPES.includes(mime)) {
      throw new Error(`"${file.name}" is not a supported format. Only JPG, PNG, and WebP are allowed.`);
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

  // STEP 1: Gemini Multimodal Vision Analysis
  const visionModel = genAI.getGenerativeModel({
    model: VISION_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
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
      },
      temperature: 0.2,
    },
  });

  const visionPrompt = `You are a professional resale appraisal expert.
You are given ${imageParts.length} photo(s) of the SAME SINGLE ITEM from various angles (front, back, labels, hardware, flaws).
Extract:
1. item_type: Specific garment or item classification (e.g. Leather Bomber Jacket, High-Top Sneakers).
2. brand: Brand name identified on tags or logos (or null if unbranded).
3. color: Dominant colors.
4. material: Primary material (e.g. Genuine Leather, Cotton, Suede, Denim) or null.
5. visible_condition_notes: Array of specific observations across all photos (creasing, distressing, edge wear, hardware condition, tags).
6. estimated_category: Standard e-commerce category hierarchy.`;

  const visionResult = await visionModel.generateContent([...imageParts, visionPrompt]);
  const itemAnalysis = JSON.parse(visionResult.response.text());

  // STEP 2: Condition Assessment & Buyer Disclosures
  const conditionModel = genAI.getGenerativeModel({
    model: VISION_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
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
      },
      temperature: 0.2,
    },
  });

  const conditionPrompt = `Based on these item observations:
Visual condition notes:
${(itemAnalysis.visible_condition_notes || []).map((n: string) => `• ${n}`).join("\n")}

Seller's additional notes:
${notes || "None provided."}

Assign exactly one condition grade from: 'New with tags', 'Like new', 'Good', 'Fair', 'Worn'.
List flaws to disclose to buyers for full transparency.`;

  const conditionResult = await conditionModel.generateContent([conditionPrompt]);
  const conditionData = JSON.parse(conditionResult.response.text());

  // STEP 3: Groq Secondary Market Price Comps
  const priceCompletion = await groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a resale market pricing strategist analyzing real secondary market comps on eBay, Poshmark, and Grailed. Return JSON matching:
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
        content: `Item Type: ${itemAnalysis.item_type}
Brand: ${itemAnalysis.brand || "Unbranded / Unknown"}
Condition Grade: ${conditionData.condition_grade}
Material: ${itemAnalysis.material || "Standard"}

Provide fair secondary market price range and optimal target listing price in USD.`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  const priceData = JSON.parse(priceCompletion.choices[0]?.message?.content || "{}");

  // STEP 4: Groq Base Listing Copy & SEO Tags
  const listingCompletion = await groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are an elite e-commerce resale copywriter. Return JSON matching:
{
  "title": string (keyword-rich, under 80 chars),
  "description": string (structured, highlighting materials, condition, styling),
  "category": string,
  "tags": string[] (5-8 relevant search tags)
}`,
      },
      {
        role: "user",
        content: `Item: ${itemAnalysis.item_type}
Brand: ${itemAnalysis.brand || "Unbranded"}
Color: ${itemAnalysis.color}
Material: ${itemAnalysis.material || "Standard"}
Condition: ${conditionData.condition_grade} (${conditionData.condition_reasoning})
Flaws: ${(conditionData.flaws_to_disclose || []).join("; ")}
Price Range: $${priceData.price_range?.low} - $${priceData.price_range?.high} (Suggested: $${priceData.price_range?.suggested})`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });
  const baseListing = JSON.parse(listingCompletion.choices[0]?.message?.content || "{}");

  // STEP 5: Groq Platform Adaptation (eBay, Poshmark, FB Marketplace)
  const platformCompletion = await groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a cross-platform marketplace formatting specialist. Format the listing into three platform-specific versions. Return JSON matching:
{
  "ebay": {
    "title": string (max 80 chars, keyword-frontloaded),
    "description": string (structured with bullet specs and condition details),
    "category_suggestion": string (eBay taxonomy path),
    "suggested_price": number (higher end of price range for Best Offer negotiation)
  },
  "poshmark": {
    "title": string (max 50 chars, casual/friendly with emojis),
    "description": string (conversational, includes bundle discount and styling callouts),
    "category_suggestion": string (Poshmark category path),
    "suggested_price": number (marked up for Offer to Likers drops)
  },
  "facebook_marketplace": {
    "title": string (max 100 chars, straightforward with size/color),
    "description": string (local pickup, cash/Venmo terms, smoke-free home note, NO hashtags),
    "suggested_price": number (realistic cash target)
  }
}`,
      },
      {
        role: "user",
        content: `Item Type: ${itemAnalysis.item_type}
Brand: ${itemAnalysis.brand || "Unbranded"}
Base Title: ${baseListing.title}
Base Description: ${baseListing.description}
Condition: ${conditionData.condition_grade}
Flaws: ${(conditionData.flaws_to_disclose || []).join(", ")}
Price Range: Low: $${priceData.price_range?.low}, High: $${priceData.price_range?.high}, Suggested: $${priceData.price_range?.suggested}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  const platformListings = JSON.parse(platformCompletion.choices[0]?.message?.content || "{}");

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

  return {
    item_type: itemAnalysis.item_type,
    brand: itemAnalysis.brand,
    condition_grade: conditionData.condition_grade,
    price_range: priceData.price_range || {
      low: 50,
      high: 100,
      suggested: 75,
    },
    title: baseListing.title,
    description: baseListing.description,
    category: itemAnalysis.estimated_category || baseListing.category,
    tags: baseListing.tags || [],
    flaws_to_disclose: conditionData.flaws_to_disclose || [],
    platform_listings: platformListings,
  };
}
