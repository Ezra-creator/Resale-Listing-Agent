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
    throw new Error("Missing Gemini API Key. Please add GEMINI_API_KEY to your .env file.");
  }
  if (!groqKey || groqKey.includes("your_groq_api_key")) {
    throw new Error("Missing Groq API Key. Please add GROQ_API_KEY to your .env file.");
  }

  const notes = (formData.get("notes") as string) || "";
  const files = formData.getAll("photos") as File[];

  if (!files || files.length === 0) {
    throw new Error("Please upload at least 1 item photo.");
  }
  if (files.length > 4) {
    throw new Error("Maximum of 4 photos allowed per item.");
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
      throw new Error(`"${file.name}" is unsupported. Please upload JPG, PNG, or WebP.`);
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

  // STEP 1: Vision Analysis
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

  const visionPrompt = `Analyze these photos of a single resale item.
Extract:
1. item_type: Concise, accurate product classification (e.g. Leather Bomber Jacket, High-Top Canvas Sneakers).
2. brand: Brand name identified on tag, hardware, or print (null if unbranded).
3. color: Dominant colors.
4. material: Primary material (e.g. Full-Grain Leather, 100% Cotton, Denim) or null.
5. visible_condition_notes: Specific observations regarding signs of wear, distressing, hardware function, stitching, and tags.
6. estimated_category: Standard retail category.`;

  const visionResult = await visionModel.generateContent([...imageParts, visionPrompt]);
  const itemAnalysis = JSON.parse(visionResult.response.text());

  // STEP 2: Condition Grade & Wear Details
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
Visual notes:
${(itemAnalysis.visible_condition_notes || []).map((n: string) => `• ${n}`).join("\n")}

Seller notes:
${notes || "None provided."}

Assign exactly one standard grade: 'New with tags', 'Like new', 'Good', 'Fair', or 'Worn'.
List any specific flaws or wear points buyers will want to know about before purchasing.`;

  const conditionResult = await conditionModel.generateContent([conditionPrompt]);
  const conditionData = JSON.parse(conditionResult.response.text());

  // STEP 3: Market Pricing Comps
  const priceCompletion = await groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a resale market pricing specialist. Estimate fair secondary market comps in USD based on recent sales. Return JSON matching:
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
  const priceData = JSON.parse(priceCompletion.choices[0]?.message?.content || "{}");

  // STEP 4: High-Converting Seller Listing Copy
  const listingCompletion = await groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are an experienced top-rated reseller. Write a clean, natural listing that feels written by a real human seller. Avoid robotic headings like "OVERVIEW:" or "ITEM SPECIFICATIONS:". Write clear descriptive paragraphs followed by specs. Return JSON:
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
  const baseListing = JSON.parse(listingCompletion.choices[0]?.message?.content || "{}");

  // STEP 5: Platform-Specific Tailored Copy
  const platformCompletion = await groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are an expert reseller tailoring a product listing for eBay, Poshmark, and Facebook Marketplace.

STYLE GUIDELINES (DO NOT SOUND LIKE AN AI):
- eBay: Title under 80 characters (keyword-frontloaded with brand, style, size/color, condition). Description should be clean and concise with key details and condition notes.
- Poshmark: Title under 50 characters. Description should be friendly, clear, and mention closet bundle discounts. DO NOT OVER-USE EMOJIS (maximum 1 or 2 subtle emojis total, do not stuff every sentence).
- Facebook Marketplace: Title under 100 characters. Clean description with cash/Venmo upon pickup, smoke-free home mention, local area pickup terms. NO hashtags.

Return JSON:
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
Price Comps: Low $${priceData.price_range?.low}, High $${priceData.price_range?.high}, Target $${priceData.price_range?.suggested}`,
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
