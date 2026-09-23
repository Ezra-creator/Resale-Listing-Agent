import "dotenv/config";
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { VISION_MODEL } from "./config.js";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY in environment or .env file.");
}

const genAI = new GoogleGenerativeAI(apiKey);

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Detects MIME type from Buffer magic bytes or file extension
 * @param {Buffer} buffer
 * @param {string} [filePath]
 * @returns {string | null}
 */
function detectMimeType(buffer, filePath) {
  if (buffer && buffer.length >= 12) {
    // JPEG magic bytes: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
    // PNG magic bytes: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return "image/png";
    }
    // WebP magic bytes: RIFF....WEBP
    if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
      return "image/webp";
    }
  }

  if (typeof filePath === "string") {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".png") return "image/png";
    if (ext === ".webp") return "image/webp";
  }

  return null;
}

/**
 * Converts either a file path string or a raw Buffer into Gemini inline base64 format.
 * Includes size (<=10MB) and MIME type validation (JPEG, PNG, WebP).
 *
 * @param {string | Buffer | { buffer: Buffer, mimeType?: string }} imageInput
 * @param {string} [mimeType]
 * @returns {{ inlineData: { data: string, mimeType: string } }}
 */
export function imageToGenerativePart(imageInput, mimeType) {
  let buffer;
  let detectedMime = mimeType;
  let label = "Raw Buffer";

  if (typeof imageInput === "string") {
    label = imageInput;
    const resolvedPath = path.resolve(imageInput);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Image file not found: "${resolvedPath}"`);
    }
    buffer = fs.readFileSync(resolvedPath);
    if (!detectedMime) {
      detectedMime = detectMimeType(buffer, resolvedPath);
    }
  } else if (Buffer.isBuffer(imageInput)) {
    buffer = imageInput;
    if (!detectedMime) {
      detectedMime = detectMimeType(buffer);
    }
  } else if (imageInput && typeof imageInput === "object" && Buffer.isBuffer(imageInput.buffer)) {
    buffer = imageInput.buffer;
    detectedMime = imageInput.mimeType || detectMimeType(buffer);
  } else {
    throw new Error("Invalid image input: Expected a file path string or Buffer instance.");
  }

  // Reject if image exceeds 10MB
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    throw new Error(`Image size exceeds 10MB limit (${sizeMB}MB): ${label}`);
  }

  // Reject unsupported formats
  if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
    throw new Error(
      `Unsupported image format (${detectedMime || "unknown"}). Only JPEG, PNG, and WebP are allowed: ${label}`
    );
  }

  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: detectedMime
    }
  };
}

// Backward-compatible alias
export const fileToGenerativePart = imageToGenerativePart;


/**
 * Schema definition for Step 1: Photo Analysis
 */
export const itemAnalysisSchema = {
  type: SchemaType.OBJECT,
  properties: {
    item_type: {
      type: SchemaType.STRING,
      description: "Specific type of item (e.g. Leather Bomber Jacket, Vintage Graphic T-Shirt, Sneaker)"
    },
    brand: {
      type: SchemaType.STRING,
      nullable: true,
      description: "Identified brand name or null if unbranded/unidentified"
    },
    color: {
      type: SchemaType.STRING,
      description: "Primary and secondary colors of the item"
    },
    material: {
      type: SchemaType.STRING,
      nullable: true,
      description: "Dominant material (e.g. Genuine Leather, 100% Cotton, Denim, Suede) or null"
    },
    visible_condition_notes: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Specific visible condition observations, wear, patina, distressing, marks, or zipper/hardware status"
    },
    estimated_category: {
      type: SchemaType.STRING,
      description: "Resale e-commerce category hierarchy (e.g. Men's Clothing > Coats & Jackets > Leather Jackets)"
    }
  },
  required: ["item_type", "color", "visible_condition_notes", "estimated_category"]
};

/**
 * Schema definition for Step 2: Condition Assessment
 */
export const conditionAssessmentSchema = {
  type: SchemaType.OBJECT,
  properties: {
    condition_grade: {
      type: SchemaType.STRING,
      description: "Condition rating strictly one of: 'New with tags', 'Like new', 'Good', 'Fair', 'Worn'"
    },
    condition_reasoning: {
      type: SchemaType.STRING,
      description: "Detailed professional rationale explaining why this grade was assigned"
    },
    flaws_to_disclose: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Bullet-point flaws or signs of wear that must be transparently disclosed to buyers"
    }
  },
  required: ["condition_grade", "condition_reasoning", "flaws_to_disclose"]
};

/**
 * Executes a structured Gemini multimodal prompt with retry for transient errors
 */
export async function generateGeminiStructured({ prompt, imageParts = [], schema, modelName = VISION_MODEL, retries = 2 }) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.2
        }
      });

      const contents = [...imageParts, prompt];
      const result = await model.generateContent(contents);
      const responseText = result.response.text();
      return JSON.parse(responseText);
    } catch (error) {
      lastError = error;
      const isTransient = error.message.includes("503") || error.message.includes("429") || error.message.includes("high demand");
      if (isTransient && attempt < retries) {
        const delayMs = (attempt + 1) * 1500;
        console.warn(`[WARN] [Gemini ${modelName}] Transient rate/service spike. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw new Error(`[Gemini API Error - ${modelName}]: ${error.message}`);
    }
  }
  throw lastError;
}

