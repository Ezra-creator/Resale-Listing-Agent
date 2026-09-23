import { NextRequest } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import Groq from "groq-sdk";
import { ResaleReport } from "@/types/listing";

export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (data: Record<string, any>) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  (async () => {
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      const groqKey = process.env.GROQ_API_KEY;

      if (!geminiKey || geminiKey.includes("your_gemini_api_key")) {
        await sendEvent({
          type: "error",
          error: "Missing Gemini API Key. Please configure GEMINI_API_KEY in your .env file.",
        });
        await writer.close();
        return;
      }
      if (!groqKey || groqKey.includes("your_groq_api_key")) {
        await sendEvent({
          type: "error",
          error: "Missing Groq API Key. Please configure GROQ_API_KEY in your .env file.",
        });
        await writer.close();
        return;
      }

      const formData = await req.formData();
      const notes = (formData.get("notes") as string) || "";
      const files = formData.getAll("photos") as File[];

      if (!files || files.length === 0) {
        await sendEvent({ type: "error", error: "Please upload at least 1 item photo." });
        await writer.close();
        return;
      }
      if (files.length > 4) {
        await sendEvent({ type: "error", error: "Maximum of 4 photos allowed per item." });
        await writer.close();
        return;
      }

      // STEP 1 START: Inspect Photos & Labels
      await sendEvent({ type: "step_start", stepId: "step_photos" });

      const imageParts: { inlineData: { data: string; mimeType: string } }[] = [];
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
          await sendEvent({
            type: "error",
            error: `"${file.name}" exceeds the 10MB limit.`,
          });
          await writer.close();
          return;
        }

        let mime = file.type || detectMimeType(buffer);
        if (!mime || !ALLOWED_MIME_TYPES.includes(mime)) {
          await sendEvent({
            type: "error",
            error: `"${file.name}" is unsupported. Please upload JPG, PNG, or WebP.`,
          });
          await writer.close();
          return;
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
      };

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
          visible_size_or_tag: { type: SchemaType.STRING, nullable: true },
        },
        required: ["item_type", "color", "visible_condition_notes", "estimated_category"],
      };

      const visionPrompt = `Analyze these photos of a single resale item like an expert secondhand appraiser.
Extract:
1. item_type: Concise, factual product classification (e.g. Leather Bomber Jacket, High-Top Canvas Sneakers, Heavyweight Fleece Hoodie).
2. brand: Brand name identified on tag, hardware, or print (null if unbranded or unidentifiable).
3. color: Dominant colors (e.g. Vintage Washed Black, Olive Green).
4. material: Primary material (e.g. Full-Grain Leather, 100% Cotton, Heavy Canvas) or null if tag not visible.
5. visible_condition_notes: Concrete, objective observations of wear, distress, seams, fading, collar/cuff wear, zippers/hardware condition, or tag status.
6. estimated_category: Standard retail category hierarchy.
7. visible_size_or_tag: Size printed on visible tags (e.g. Large, Men's 34, Women's 8) or null.`;

      const itemAnalysis = await runGeminiWithFallback({
        schema: visionSchema,
        contents: [...imageParts, visionPrompt],
      });

      await sendEvent({ type: "step_done", stepId: "step_photos" });

      // STEP 2 START: Condition & Wear Details
      await sendEvent({ type: "step_start", stepId: "step_condition" });

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

      const conditionPrompt = `You are an honest, seasoned reseller grading this item for buyer trust.
Visual inspection observations:
${(itemAnalysis.visible_condition_notes || []).map((n: string) => `• ${n}`).join("\n")}

Seller notes:
${notes || "None provided."}

Assign exactly one standard grade: 'New with tags', 'Like new', 'Good', 'Fair', or 'Worn'.
List specific, transparent flaw bullet points (e.g. "Minor distressing along cuff edges", "Faint wash fade across shoulders", "All zippers and buttons fully functional"). Do not sugarcoat flaws.`;

      const conditionData = await runGeminiWithFallback({
        schema: conditionSchema,
        contents: [conditionPrompt],
      });

      await sendEvent({ type: "step_done", stepId: "step_condition" });

      // STEP 3 START: Price Valuation Comps
      await sendEvent({ type: "step_start", stepId: "step_price" });

      const priceCompletion = await groq.chat.completions.create({
        model: TEXT_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a secondary market resale pricing expert for eBay, Poshmark, and Mercari.
Estimate fair market secondary valuation in USD based on realistic sold comps and sell-through rates for secondhand goods.
Do NOT give absurdly high retail MSRP prices; give realistic cash/resale prices. Return ONLY JSON:
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
Condition Grade: ${conditionData.condition_grade}
Material: ${itemAnalysis.material || "Standard"}
Condition Details: ${(conditionData.flaws_to_disclose || []).join("; ") || "Normal pre-owned wear"}
Seller Notes: ${notes || "None"}

Provide realistic resale comps range and suggested target list price.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const priceData = parseJsonClean(priceCompletion.choices[0]?.message?.content || "{}");

      await sendEvent({ type: "step_done", stepId: "step_price" });

      // STEP 4 START: Base Listing Copy (Human Reseller Style)
      await sendEvent({ type: "step_start", stepId: "step_listing" });

      const listingCompletion = await groq.chat.completions.create({
        model: TEXT_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a top-rated individual reseller writing an authentic listing.
STRICT ANTI-AI RULES:
- NEVER use marketing buzzwords: "Elevate your wardrobe", "Must-have staple", "Timeless classic", "Turn heads", "Exquisite craftsmanship", "Chic piece", "Look no further", "Step out in style".
- Write factual, clean, concise copy that buyers respect.
- Start directly with the item brand, model, size, color, and physical specs.
- Include structured specs (Brand, Size, Material, Condition, Approximate Measurements placeholder if not specified).

Return ONLY JSON:
{
  "title": string (search-friendly, under 80 chars),
  "description": string (natural human reseller copy),
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
Size/Tag: ${itemAnalysis.visible_size_or_tag || "See photos"}
Flaws/Notes: ${(conditionData.flaws_to_disclose || []).join(", ")}
Seller Notes: ${notes}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.25,
      });

      const baseListing = parseJsonClean(listingCompletion.choices[0]?.message?.content || "{}");

      await sendEvent({ type: "step_done", stepId: "step_listing" });

      // STEP 5 START: Platform-Specific Adaptations
      await sendEvent({ type: "step_start", stepId: "step_platforms" });

      const platformCompletion = await groq.chat.completions.create({
        model: TEXT_MODEL,
        messages: [
          {
            role: "system",
            content: `You are an expert reseller adapting listings for eBay, Poshmark, and Facebook Marketplace.

AUTHENTIC PLATFORM GUIDELINES (DO NOT SOUND LIKE AN AI):

1. EBAY (Max 80 char title):
   - Title: Frontload high-value keywords for Cassini search (Brand + Style/Model + Gender/Fit + Size + Color + Material + Condition). NO filler words, NO punctuation spam.
   - Description: Factual and structured. Item specifics list, condition disclosure, flat-lay measurement lines (Pit-to-pit, Length), and clean shipping note.

2. POSHMARK (Max 50 char title):
   - Title: Clean, max 50 chars. Clear brand and style.
   - Description: Friendly reseller tone. Highlights styling / subcultures (#vintage, #streetwear, #minimalist). Mentions closet bundle discounts ("Bundle 2+ items from my closet for a discount! Open to reasonable offers & fast shipping."). NO emojis.

3. FACEBOOK MARKETPLACE (Max 100 char title):
   - Title: Plain English local title, under 100 chars.
   - Description: Direct local terms:
     "• Pickup in [Local Area] / Cash or Venmo upon pickup."
     "• Smoke-free, pet-free home."
     "• If this listing is up, it's still available."
     NO hashtags.

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
Condition Grade: ${conditionData.condition_grade}
Flaws: ${(conditionData.flaws_to_disclose || []).join(", ") || "Normal gentle pre-owned wear"}
Price Comps: Low $${priceData.price_range?.low || 45}, High $${priceData.price_range?.high || 95}, Target $${priceData.price_range?.suggested || 70}
Seller Notes: ${notes}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const platformListings = parseJsonClean(platformCompletion.choices[0]?.message?.content || "{}");

      if (platformListings.ebay?.title && platformListings.ebay.title.length > 80) {
        platformListings.ebay.title = platformListings.ebay.title.slice(0, 80).trim();
      }
      if (platformListings.poshmark?.title && platformListings.poshmark.title.length > 50) {
        platformListings.poshmark.title = platformListings.poshmark.title.slice(0, 50).trim();
      }
      if (platformListings.facebook_marketplace?.title && platformListings.facebook_marketplace.title.length > 100) {
        platformListings.facebook_marketplace.title = platformListings.facebook_marketplace.title.slice(0, 100).trim();
      }

      const report: ResaleReport = {
        item_type: itemAnalysis.item_type,
        brand: itemAnalysis.brand || null,
        condition_grade: conditionData.condition_grade,
        price_range: priceData.price_range || {
          low: 45,
          high: 95,
          suggested: 70,
        },
        title: baseListing.title || itemAnalysis.item_type,
        description: baseListing.description || "",
        category: itemAnalysis.estimated_category || baseListing.category || "General Resale",
        tags: baseListing.tags || [],
        flaws_to_disclose: conditionData.flaws_to_disclose || [],
        platform_listings: platformListings,
      };

      await sendEvent({ type: "step_done", stepId: "step_platforms" });
      await sendEvent({ type: "result", data: report });
    } catch (err: any) {
      console.error("Streaming generation error:", err);
      await sendEvent({
        type: "error",
        error: err?.message || "An unexpected error occurred while analyzing photos.",
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
