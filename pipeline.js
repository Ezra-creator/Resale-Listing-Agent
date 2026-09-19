import "dotenv/config";
import fs from "fs";
import path from "path";
import Groq from "groq-sdk";
import { VISION_MODEL, TEXT_MODEL } from "./lib/config.js";
import {
  imageToGenerativePart,
  itemAnalysisSchema,
  conditionAssessmentSchema,
  generateGeminiStructured
} from "./lib/gemini.js";
import { generateGroqStructured } from "./lib/groq.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ============================================================================
// CORE PIPELINE FUNCTIONS (Internals remain unchanged)
// ============================================================================

/**
 * STEP 1: Analyze 1-4 item photos using Gemini Vision Model
 * Accepts an array of 1 to 4 image inputs (file paths, Buffers, or { buffer, mimeType }).
 * Sends all images together as multiple angles/views of the SAME single item.
 *
 * @param {Array<string | Buffer | { buffer: Buffer, mimeType?: string }>} images
 * @returns {Promise<{
 *   item_type: string,
 *   brand: string | null,
 *   color: string,
 *   material: string | null,
 *   visible_condition_notes: string[],
 *   estimated_category: string
 * }>}
 */
export async function analyzeItemPhotos(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("analyzeItemPhotos: At least 1 image must be provided (received 0).");
  }
  if (images.length > 4) {
    throw new Error(`analyzeItemPhotos: A maximum of 4 images can be processed per item (received ${images.length}).`);
  }

  const imageParts = images.map((img) => imageToGenerativePart(img));

  const prompt = `You are a professional resale appraisal expert (eBay, Poshmark, Grailed, Mercari).
You are provided with ${imageParts.length} image(s) showing MULTIPLE ANGLES/VIEWS of the SAME SINGLE ITEM (front, back, tags, hardware, or close-up details).
DO NOT treat these as separate items. Combine all visual details across every provided photo into one unified appraisal analysis.

Identify:
1. item_type: The exact garment/item classification (e.g., 'Vintage Leather Bomber Jacket', 'High-Top Leather Sneakers').
2. brand: Brand name identified from tags, labels, or hardware logos across any angle. Return null if unbranded or unknown.
3. color: Primary and secondary colors observed across all views.
4. material: Dominant material observed (e.g., 'Genuine Full-Grain Leather', 'Heavyweight Cotton', 'Suede') or null.
5. visible_condition_notes: An array of specific visual observations across all angles regarding condition, creasing, patina, distressing, wear on cuffs/collar/edges, hardware condition, or tags.
6. estimated_category: The standard e-commerce resale category hierarchy (e.g., "Men's Clothing > Coats & Jackets > Leather Jackets").

Be precise, objective, and thorough.`;

  return await generateGeminiStructured({
    prompt,
    imageParts,
    schema: itemAnalysisSchema,
    modelName: VISION_MODEL
  });
}

/**
 * STEP 2: Assess condition grade and compile disclosure flaws
 *
 * @param {string[]} visualNotes - Array of visual condition observations from Step 1
 * @param {string} [userNotes=""] - Optional notes provided by seller
 * @returns {Promise<{
 *   condition_grade: "New with tags" | "Like new" | "Good" | "Fair" | "Worn",
 *   condition_reasoning: string,
 *   flaws_to_disclose: string[]
 * }>}
 */
export async function assessCondition(visualNotes, userNotes = "") {
  const prompt = `You are an expert resale condition grader for top resale platforms.
Standard resale condition grades are strictly one of:
- 'New with tags': Brand new, never worn/used, original tags or packaging intact.
- 'Like new': Minimal to no signs of wear, flawless condition but tags removed.
- 'Good': Gently used, minor signs of normal wear or light patina, fully functional with no major flaws.
- 'Fair': Noticeable wear, minor stains, scuffs, or light repairable flaws, but structurally sound.
- 'Worn': Heavy wear, distress, noticeable blemishes, or functional flaws that must be highlighted.

Based on the following item observations:
Visual condition notes:
${visualNotes.map((n) => `• ${n}`).join("\n")}

Seller's additional notes:
${userNotes ? userNotes : "None provided."}

Return a structured JSON object with:
1. condition_grade: Exactly one of the 5 grades above.
2. condition_reasoning: Clear, objective rationale for why this grade fits.
3. flaws_to_disclose: List of specific flaws or patina points that must be disclosed to buyers for full transparency.`;

  return await generateGeminiStructured({
    prompt,
    schema: conditionAssessmentSchema,
    modelName: VISION_MODEL
  });
}

/**
 * STEP 3: Suggest price range and optimal listing price using Groq LLM
 *
 * @param {string} itemType - Item type
 * @param {string | null} brand - Brand name
 * @param {string} conditionGrade - Condition grade
 * @returns {Promise<{
 *   price_range: { low: number, high: number, suggested: number },
 *   reasoning: string
 * }>}
 */
export async function suggestPrice(itemType, brand, conditionGrade) {
  const systemPrompt = `You are a senior secondary-market resale pricing strategist analyzing recent comps on eBay, Poshmark, Mercari, and Grailed.
Calculate realistic USD secondary market pricing. Return a JSON object matching this schema:
{
  "price_range": {
    "low": number (minimum fast-sale price),
    "high": number (maximum optimistic price),
    "suggested": number (optimal competitive listing price)
  },
  "reasoning": string (concise explanation referencing brand tier, item type, and condition demand)
}`;

  const userPrompt = `Item Details:
- Item Type: ${itemType}
- Brand: ${brand || "Unbranded / Unknown"}
- Condition Grade: ${conditionGrade}

Provide fair, data-backed secondary market price suggestions in USD.`;

  return await generateGroqStructured({
    systemPrompt,
    userPrompt,
    modelName: TEXT_MODEL
  });
}

/**
 * STEP 4: Generate optimized resale listing title, description, category, and tags
 *
 * @param {Object} itemData - Item visual details
 * @param {Object} condition - Condition details
 * @param {Object} price - Price details
 * @returns {Promise<{
 *   title: string,
 *   description: string,
 *   category: string,
 *   tags: string[]
 * }>}
 */
export async function generateListing(itemData, condition, price) {
  const systemPrompt = `You are an elite e-commerce resale copywriter specializing in high-converting, search-optimized listings.
Generate an engaging, professional resale listing.
Requirements:
1. title: Under 80 characters, keyword-rich with [Brand] + [Item Type] + [Key Details/Material] + [Color/Size/Condition].
2. description: Well-structured with bullet points covering:
   - Overview & key highlights
   - Materials & craftsmanship
   - Accurate condition summary & honest disclosure of all flaws
   - Suggested styling / buyer callout
3. category: Precise e-commerce category hierarchy.
4. tags: 8-12 relevant search tags / keywords (no # symbol).

Return ONLY a JSON object matching:
{
  "title": string,
  "description": string,
  "category": string,
  "tags": string[]
}`;

  const userPrompt = `Item Data:
${JSON.stringify(itemData, null, 2)}

Condition Assessment:
${JSON.stringify(condition, null, 2)}

Pricing Details:
${JSON.stringify(price, null, 2)}

Write the optimized listing.`;

  return await generateGroqStructured({
    systemPrompt,
    userPrompt,
    modelName: TEXT_MODEL
  });
}

const EBAY_TITLE_MAX = 80;
const POSHMARK_TITLE_MAX = 50;
const FB_TITLE_MAX = 100;

/**
 * STEP 5: Adapt consolidated listing into platform-specific versions (eBay, Poshmark, Facebook Marketplace)
 *
 * @param {Object} listingData - Consolidated item, condition, pricing, and base listing details
 * @returns {Promise<{
 *   ebay: { title: string, description: string, category_suggestion: string, suggested_price: number },
 *   poshmark: { title: string, description: string, category_suggestion: string, suggested_price: number },
 *   facebook_marketplace: { title: string, description: string, suggested_price: number }
 * }>}
 */
export async function formatForPlatforms(listingData) {
  const systemPrompt = `You are a cross-platform resale e-commerce specialist.
Adapt the provided item and listing into 3 platform-specific formats matching their distinct cultures, buyers, and algorithms:

1. ebay:
   - title: Max 80 characters. Keyword-front-loaded for search (Brand + Item Type + Material/Color + Size/Features). No spam punctuation.
   - description: Structured, factual tone with itemized specifications and condition bullet points.
   - category_suggestion: Standard eBay category path hierarchy (e.g., "Clothing, Shoes & Accessories > Men > Men's Clothing > Coats, Jackets & Vests").
   - suggested_price: Number in USD, set at the HIGHER end of the price range since eBay buyers frequently use "Best Offer" / negotiation.

2. poshmark:
   - title: Max 50 characters. Friendly, clean, and catchy.
   - description: Conversational tone, relevant emojis used tastefully (✨, 🧥, etc.), mentions bundle/closet discount culture ("Bundle & save! Fast shipping! Open to reasonable offers!"), highlights styling.
   - category_suggestion: Poshmark taxonomy path (e.g., "Men > Jackets & Coats > Bomber Jackets").
   - suggested_price: Number in USD, listed slightly higher than target to allow room for "Offer to Likers" discounts.

3. facebook_marketplace:
   - title: Max 100 characters. Direct, plain-English title suitable for local search.
   - description: Casual and direct. Mentions local pickup/meetup norms (cash/Venmo, smoke-free home, prompt pickup), NO hashtags.
   - suggested_price: Number in USD, set close to the realistic target price for local cash/quick sale.

Return ONLY a JSON object matching this schema:
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
}`;

  const userPrompt = `Consolidated Listing Data:
${JSON.stringify(listingData, null, 2)}

Format this listing for eBay, Poshmark, and Facebook Marketplace.`;

  const result = await generateGroqStructured({
    systemPrompt,
    userPrompt,
    modelName: TEXT_MODEL
  });

  // Enforce character limits in code with warnings
  if (result.ebay?.title && result.ebay.title.length > EBAY_TITLE_MAX) {
    console.warn(`⚠️ [Character Limit] eBay title exceeded ${EBAY_TITLE_MAX} chars (${result.ebay.title.length}). Truncating.`);
    result.ebay.title = result.ebay.title.slice(0, EBAY_TITLE_MAX).trim();
  }

  if (result.poshmark?.title && result.poshmark.title.length > POSHMARK_TITLE_MAX) {
    console.warn(`⚠️ [Character Limit] Poshmark title exceeded ${POSHMARK_TITLE_MAX} chars (${result.poshmark.title.length}). Truncating.`);
    result.poshmark.title = result.poshmark.title.slice(0, POSHMARK_TITLE_MAX).trim();
  }

  if (result.facebook_marketplace?.title && result.facebook_marketplace.title.length > FB_TITLE_MAX) {
    console.warn(`⚠️ [Character Limit] Facebook Marketplace title exceeded ${FB_TITLE_MAX} chars (${result.facebook_marketplace.title.length}). Truncating.`);
    result.facebook_marketplace.title = result.facebook_marketplace.title.slice(0, FB_TITLE_MAX).trim();
  }

  return result;
}

// ============================================================================
// GROQ OPENAI-COMPATIBLE TOOL DEFINITIONS
// ============================================================================

export const agentTools = [
  {
    type: "function",
    function: {
      name: "analyzeItemPhotos",
      description: "Analyzes uploaded item photos and extracts type, brand, color, material, and condition notes using multimodal vision inspection.",
      parameters: {
        type: "object",
        properties: {
          photo_session_id: {
            type: "string",
            description: "Session identifier for the uploaded photos."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "assessCondition",
      description: "Assesses item condition grade ('New with tags', 'Like new', 'Good', 'Fair', 'Worn'), rationale, and transparent flaws to disclose to buyers based on visual observations and seller notes.",
      parameters: {
        type: "object",
        properties: {
          visual_notes: {
            type: "array",
            items: { type: "string" },
            description: "Array of visual condition observations from photo analysis."
          },
          user_notes: {
            type: "string",
            description: "Optional notes or provenance provided by the seller."
          }
        },
        required: ["visual_notes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "suggestPrice",
      description: "Calculates realistic secondary market price range (low, high, suggested) and pricing reasoning based on item type, brand, and condition grade.",
      parameters: {
        type: "object",
        properties: {
          item_type: {
            type: "string",
            description: "Item classification or garment type (e.g. 'Vintage Leather Bomber Jacket')."
          },
          brand: {
            type: "string",
            description: "Identified brand name or null/empty if unbranded."
          },
          condition_grade: {
            type: "string",
            enum: ["New with tags", "Like new", "Good", "Fair", "Worn"],
            description: "Assigned condition grade."
          }
        },
        required: ["item_type", "condition_grade"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generateListing",
      description: "Generates high-converting, SEO-optimized base resale listing copy including title (<80 chars), formatted description, category, and tags.",
      parameters: {
        type: "object",
        properties: {
          item_data: {
            type: "object",
            description: "Item visual attributes (item_type, brand, color, material, estimated_category)."
          },
          condition: {
            type: "object",
            description: "Condition assessment details (condition_grade, condition_reasoning, flaws_to_disclose)."
          },
          price: {
            type: "object",
            description: "Pricing details (price_range, suggested, reasoning)."
          }
        },
        required: ["item_data", "condition", "price"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "formatForPlatforms",
      description: "Adapts the consolidated listing into platform-specific optimized versions for eBay (80 char search-optimized title, factual description), Poshmark (50 char title, conversational emoji description, bundle mentions), and Facebook Marketplace (100 char local-sale title, pickup/cash notes, no hashtags).",
      parameters: {
        type: "object",
        properties: {
          listing_data: {
            type: "object",
            description: "Consolidated listing details (item_data, condition, price, base_listing)."
          }
        },
        required: []
      }
    }
  }
];

// ============================================================================
// AGENTIC FUNCTION-CALLING ORCHESTRATOR LOOP
// ============================================================================

/**
 * Human-readable log formatting for tool calls
 */
function formatToolCallLog(name, args, sessionContext) {
  switch (name) {
    case "analyzeItemPhotos":
      return `[TOOL CALL] analyzeItemPhotos(using ${sessionContext.imageBuffers.length} in-memory photo buffers)`;
    case "assessCondition":
      const noteCount = args.visual_notes?.length || 0;
      const notePreview = args.user_notes ? `userNotes: "${args.user_notes.slice(0, 35)}..."` : "userNotes: none";
      return `[TOOL CALL] assessCondition(visualNotes: ${noteCount} items, ${notePreview})`;
    case "suggestPrice":
      return `[TOOL CALL] suggestPrice(itemType: "${args.item_type}", brand: "${args.brand || "None"}", grade: "${args.condition_grade}")`;
    case "generateListing":
      const brand = args.item_data?.brand || "Unbranded";
      const type = args.item_data?.item_type || "Item";
      const price = args.price?.price_range?.suggested || args.price?.suggested || "N/A";
      return `[TOOL CALL] generateListing(${brand} ${type}, suggestedPrice: $${price})`;
    case "formatForPlatforms":
      return `[TOOL CALL] formatForPlatforms(adapting for eBay, Poshmark, and Facebook Marketplace)`;
    default:
      return `[TOOL CALL] ${name}(${JSON.stringify(args).slice(0, 60)}...)`;
  }
}

/**
 * Human-readable log formatting for tool results
 */
function formatToolResultLog(name, result) {
  switch (name) {
    case "analyzeItemPhotos":
      return `[TOOL RESULT] Identified: ${result.brand || "Unbranded"} ${result.item_type} (${result.color}, ${result.material || "N/A"}) | Category: "${result.estimated_category}" | ${result.visible_condition_notes?.length || 0} visual notes`;
    case "assessCondition":
      return `[TOOL RESULT] Grade: "${result.condition_grade}" | Flaws to disclose: ${result.flaws_to_disclose?.length || 0} items | Rationale: ${(result.condition_reasoning || "").slice(0, 75)}...`;
    case "suggestPrice":
      return `[TOOL RESULT] Price Range: $${result.price_range?.low} - $${result.price_range?.high} (Suggested: $${result.price_range?.suggested}) | Rationale: ${(result.reasoning || "").slice(0, 70)}...`;
    case "generateListing":
      return `[TOOL RESULT] Title: "${result.title}" | Category: "${result.category}" | Tags: ${result.tags?.length || 0} keywords generated`;
    case "formatForPlatforms":
      return `[TOOL RESULT] Formatted for 3 platforms — eBay (${result.ebay?.title?.length || 0}/80 chars, $${result.ebay?.suggested_price}), Poshmark (${result.poshmark?.title?.length || 0}/50 chars, $${result.poshmark?.suggested_price}), FB Marketplace (${result.facebook_marketplace?.title?.length || 0}/100 chars, $${result.facebook_marketplace?.suggested_price})`;
    default:
      return `[TOOL RESULT] ${JSON.stringify(result).slice(0, 100)}...`;
  }
}

/**
 * Autonomous Agent Loop using Groq as orchestrator and Gemini as vision tool
 *
 * @param {Object} options
 * @param {Array<Buffer | string>} options.images - 1-4 image buffers or paths
 * @param {string} [options.userNotes=""] - Optional seller notes
 * @param {number} [options.maxIterations=8] - Maximum turns allowed
 * @param {boolean} [options.verbose=false] - Print raw request/response per turn
 * @returns {Promise<Object>} Consolidated resale listing report
 */
export async function runAgentLoop({ images, userNotes = "", maxIterations = 8, verbose = false }) {
  console.log("===============================================================");
  console.log("🤖 RESALE LISTING AGENT — FUNCTION-CALLING ORCHESTRATOR");
  console.log(`   • Orchestrator Model:  Groq (${TEXT_MODEL})`);
  console.log(`   • Vision Tool Provider: Google Gemini (${VISION_MODEL})`);
  console.log(`   • Max Turns:           ${maxIterations}`);
  console.log(`   • Verbose Debug:       ${verbose ? "ENABLED" : "DISABLED"}`);
  console.log("===============================================================\n");

  // In-memory session closure holding raw image data and tracking agent state
  const sessionContext = {
    sessionId: `session_${Date.now()}`,
    imageBuffers: images,
    userNotes: userNotes || "",
    itemAnalysis: null,
    condition: null,
    pricing: null,
    listing: null,
    platformListings: null
  };

  const messages = [
    {
      role: "system",
      content: `You are an autonomous Resale Listing Agent orchestrator.
Your goal is to inspect an item's uploaded photos and optional seller notes, and autonomously call the appropriate tools to:
1. Analyze the uploaded photos using 'analyzeItemPhotos'.
2. Assess the item condition grade and flaws to disclose using 'assessCondition'.
3. Suggest a data-backed secondary market price range using 'suggestPrice'.
4. Generate an SEO-optimized base resale listing with title, description, category, and tags using 'generateListing'.
5. Adapt the listing into platform-specific versions for eBay, Poshmark, and Facebook Marketplace using 'formatForPlatforms'.

Call tools in a logical, coherent order. Do not skip steps. Once all tools including platform formatting have been executed, provide a final concise summary confirming completion.`
    },
    {
      role: "user",
      content: `Analyze this item's photos and notes, produce a complete resale listing with price suggestion, and format it for eBay, Poshmark, and Facebook Marketplace.
Seller Notes: "${sessionContext.userNotes || "None provided"}"`
    }
  ];

  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`--- [Agent Turn ${iteration}/${maxIterations}] ---`);

    if (verbose) {
      console.log(`\n[VERBOSE Turn ${iteration}] Request Messages:`);
      console.log(JSON.stringify(messages, null, 2));
    }

    const response = await groq.chat.completions.create({
      model: TEXT_MODEL,
      messages,
      tools: agentTools,
      tool_choice: "auto",
      temperature: 0.2
    });

    const assistantMessage = response.choices[0]?.message;
    if (!assistantMessage) {
      throw new Error("Groq orchestrator returned an empty response.");
    }

    if (verbose) {
      console.log(`\n[VERBOSE Turn ${iteration}] Raw Response:`);
      console.log(JSON.stringify(assistantMessage, null, 2));
    }

    messages.push(assistantMessage);

    // If Groq did not request any tool calls, the agent has finished its work
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      console.log(`💬 [Agent Response]: ${assistantMessage.content || "Listing generation completed."}\n`);
      break;
    }

    // Execute requested tool calls
    for (const toolCall of assistantMessage.tool_calls) {
      const funcName = toolCall.function.name;
      let args = {};
      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch (err) {
        args = {};
      }

      console.log(formatToolCallLog(funcName, args, sessionContext));

      let result;
      try {
        switch (funcName) {
          case "analyzeItemPhotos": {
            // Access image buffers directly from session context closure
            result = await analyzeItemPhotos(sessionContext.imageBuffers);
            sessionContext.itemAnalysis = result;
            break;
          }

          case "assessCondition": {
            const visualNotes =
              args.visual_notes && Array.isArray(args.visual_notes)
                ? args.visual_notes
                : sessionContext.itemAnalysis?.visible_condition_notes || [];
            const notes = args.user_notes !== undefined ? args.user_notes : sessionContext.userNotes;
            result = await assessCondition(visualNotes, notes);
            sessionContext.condition = result;
            break;
          }

          case "suggestPrice": {
            const itemType = args.item_type || sessionContext.itemAnalysis?.item_type || "Vintage Item";
            const brand = args.brand !== undefined ? args.brand : sessionContext.itemAnalysis?.brand;
            const grade = args.condition_grade || sessionContext.condition?.condition_grade || "Good";
            result = await suggestPrice(itemType, brand, grade);
            sessionContext.pricing = result;
            break;
          }

          case "generateListing": {
            const itemData = args.item_data || sessionContext.itemAnalysis || {};
            const cond = args.condition || sessionContext.condition || {};
            const prc = args.price || sessionContext.pricing || {};
            result = await generateListing(itemData, cond, prc);
            sessionContext.listing = result;
            break;
          }

          case "formatForPlatforms": {
            const dataToFormat = {
              item_data: sessionContext.itemAnalysis || {},
              condition: sessionContext.condition || {},
              price: sessionContext.pricing || {},
              base_listing: sessionContext.listing || {}
            };
            result = await formatForPlatforms(dataToFormat);
            sessionContext.platformListings = result;
            break;
          }

          default:
            throw new Error(`Unknown tool requested: "${funcName}"`);
        }

        console.log(formatToolResultLog(funcName, result) + "\n");

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: funcName,
          content: JSON.stringify(result)
        });
      } catch (toolError) {
        console.error(`❌ Error executing tool "${funcName}":`, toolError.message);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: funcName,
          content: JSON.stringify({ error: toolError.message })
        });
      }
    }
  }

  if (iteration >= maxIterations) {
    console.warn(`⚠️ [WARNING] Agent reached the maximum limit of ${maxIterations} turns.`);
  }

  // Construct consolidated final report including platform_listings
  const consolidatedReport = {
    item_type: sessionContext.itemAnalysis?.item_type || "Unknown Item",
    brand: sessionContext.itemAnalysis?.brand || null,
    condition_grade: sessionContext.condition?.condition_grade || "Good",
    price_range: sessionContext.pricing?.price_range || { low: 0, high: 0, suggested: 0 },
    title: sessionContext.listing?.title || "",
    description: sessionContext.listing?.description || "",
    category: sessionContext.listing?.category || sessionContext.itemAnalysis?.estimated_category || "",
    tags: sessionContext.listing?.tags || [],
    flaws_to_disclose: sessionContext.condition?.flaws_to_disclose || [],
    platform_listings: sessionContext.platformListings || null
  };

  console.log("===============================================================");
  console.log("📋 CONSOLIDATED RESALE LISTING REPORT");
  console.log("===============================================================");
  console.log(JSON.stringify(consolidatedReport, null, 2));

  // Platform-specific comparison display
  if (sessionContext.platformListings) {
    const pl = sessionContext.platformListings;
    console.log("\n===============================================================");
    console.log("🏪 PLATFORM-SPECIFIC LISTINGS COMPARISON");
    console.log("===============================================================");

    if (pl.ebay) {
      console.log("\n🔵 [EBAY] — Search-Optimized & Structured Factual");
      console.log(`   • Title (${pl.ebay.title?.length || 0}/80 chars): ${pl.ebay.title}`);
      console.log(`   • Suggested Price:   $${pl.ebay.suggested_price} (Targeted higher for Best Offer / negotiation)`);
      console.log(`   • Category Path:     ${pl.ebay.category_suggestion}`);
      console.log("   • Description:");
      console.log(
        pl.ebay.description
          ? pl.ebay.description.split("\n").map((line) => `     ${line}`).join("\n")
          : "     N/A"
      );
    }

    if (pl.poshmark) {
      console.log("\n🟣 [POSHMARK] — Conversational, Emojis & Bundle-Friendly");
      console.log(`   • Title (${pl.poshmark.title?.length || 0}/50 chars): ${pl.poshmark.title}`);
      console.log(`   • Suggested Price:   $${pl.poshmark.suggested_price} (Listed higher for Closet Drops & Offers to Likers)`);
      console.log(`   • Category Path:     ${pl.poshmark.category_suggestion}`);
      console.log("   • Description:");
      console.log(
        pl.poshmark.description
          ? pl.poshmark.description.split("\n").map((line) => `     ${line}`).join("\n")
          : "     N/A"
      );
    }

    if (pl.facebook_marketplace) {
      console.log("\n🌐 [FACEBOOK MARKETPLACE] — Direct Local Sale & Pickup Norms");
      console.log(`   • Title (${pl.facebook_marketplace.title?.length || 0}/100 chars): ${pl.facebook_marketplace.title}`);
      console.log(`   • Suggested Price:   $${pl.facebook_marketplace.suggested_price} (Set close to target cash price)`);
      console.log("   • Description (No hashtags, includes local pickup/cash callouts):");
      console.log(
        pl.facebook_marketplace.description
          ? pl.facebook_marketplace.description.split("\n").map((line) => `     ${line}`).join("\n")
          : "     N/A"
      );
    }
  }

  console.log("===============================================================");
  console.log("✅ Agent loop completed successfully!\n");

  return consolidatedReport;
}

/**
 * Main entry point
 */
export async function main() {
  const isVerbose = process.argv.includes("--verbose") || process.argv.includes("-v");

  // Load sample photos from /samples as raw Buffers to test dynamic buffer ingestion
  const samplePhotoFiles = [
    path.join("samples", "item1.jpg"),
    path.join("samples", "item2.jpg"),
    path.join("samples", "item3.jpg")
  ];

  console.log("📂 Ingesting sample images into raw Buffers...");
  const samplePhotoBuffers = samplePhotoFiles.map((p) => {
    if (!fs.existsSync(p)) {
      throw new Error(`Sample photo file not found: "${p}". Please ensure samples/ contains test images.`);
    }
    const buf = fs.readFileSync(p);
    console.log(`   📄 Loaded "${p}" (${(buf.length / 1024).toFixed(1)} KB buffer)`);
    return buf;
  });

  const sampleUserNotes = "Found in estate sale. Zipper works smoothly, vintage Schott NYC tag intact, slight vintage distressing on leather sleeves.";

  try {
    await runAgentLoop({
      images: samplePhotoBuffers,
      userNotes: sampleUserNotes,
      maxIterations: 8,
      verbose: isVerbose
    });
  } catch (error) {
    console.error("\n❌ Agent Pipeline Execution Failed:");
    console.error(error.message);
    if (error.stack && isVerbose) {
      console.error("\nStack Trace:\n", error.stack);
    }
    process.exit(1);
  }
}

// Execute main when run directly
main();

