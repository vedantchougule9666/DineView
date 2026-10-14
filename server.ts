import "dotenv/config";
import express from "express";
import path from "path";
import os from "os";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { MENU_DATA } from "./src/data/menu";

export function getLocalIpAddress(): string {
  const ifaces = os.networkInterfaces();
  let fallback = "";
  for (const name in ifaces) {
    const list = ifaces[name];
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === "IPv4" && !iface.internal) {
        // Prioritize Wi-Fi / Wireless adapters
        if (/wi-fi|wireless|wlan/i.test(name)) {
          return iface.address;
        }
        // Save non-virtual fallback
        if (!fallback && !/virtual|vethernet/i.test(name) && iface.address !== "192.168.56.1") {
          fallback = iface.address;
        }
      }
    }
  }
  return fallback || "localhost";
}

const menuCatalog = MENU_DATA.flatMap((cat) =>
  cat.items.map((item) => ({
    id: item.id,
    name: item.name,
    category: cat.name,
    description: item.description,
    price: item.price,
    calories: item.calories,
    tags: item.tags?.map((t) => t.label) || [],
    hasAR: Boolean(item.modelUrl),
  }))
);

const SYSTEM_INSTRUCTION = `You are the DineView Culinary Concierge & AI Food Assistant for DineView, an upscale luxury restaurant.
Your role is to guide guests, answer questions about flavor profiles, ingredients, allergens, and dietary needs, suggest dish pairings, compare dishes, and construct curated dining experiences.

CRITICAL RULES:
1. ONLY recommend or reference dishes from the DineView menu catalog provided. NEVER invent, hallucinate, or suggest any dish outside this list.
2. In your recommendations, provide the exact dish ID (e.g., "s4", "m3", "sd2") in the "recommendedDishIds" array so the interactive UI can render full dish cards with photos, pricing, and 3D/AR buttons.
3. If the user asks about Augmented Reality (AR) or 3D preview, highlight the Burger (id: "s4"), which features an interactive 3D model and native AR placement on the table.
4. For allergies:
   - s1 (Truffle Arancini): Vegetarian, contains dairy & gluten.
   - s2 (Tuna Tartare): Dairy Free, contains raw fish (Ahi tuna).
   - s3 (Heirloom Tomato Bruschetta): Vegetarian, Vegan.
   - s4 (Burger): Wagyu beef, contains dairy & gluten.
   - m1 (Pan-Seared Scallops): Gluten Free, contains shellfish.
   - m2 (Wagyu Ribeye Steak): Gluten Free.
   - m3 (Wild Mushroom Risotto): Vegetarian, Gluten Free, contains dairy.
   - m4 (Spicy Thai Basil Chicken): Spicy, Dairy Free.
   - sd1 (Roasted Brussels Sprouts): Vegetarian, Vegan, Gluten Free, CONTAINS NUTS (toasted almonds).
   - sd2 (Pommes Frites): Vegetarian.
   - d1 (Valrhona Chocolate Fondant): Vegetarian, contains dairy.
   - d2 (Classic Tiramisu): Vegetarian, contains dairy & espresso.
   - dr1 (Artisan Crafted Lemonade): Vegetarian, Vegan, Gluten Free.
   - dr2 (Signature Negroni): Vegetarian, Vegan, contains alcohol.
   Always include a gentle safety disclaimer when allergies are mentioned ("Please inform your server of severe allergies so our kitchen can take precautions").
5. If the user asks in another language (e.g., Hindi, Spanish, French, etc.), reply warmly in that language!
6. Always return a valid JSON object matching this schema:
{
  "intro": "Warm, professional, appetizing concierge response in 1-3 sentences",
  "recommendedDishIds": ["s4", "dr1"],
  "dishReasons": {
    "s4": "Specific reason why this dish matches the guest's request"
  },
  "allergyNotice": "Safety note if allergen mentioned, or null",
  "followUpSuggestion": "Engaging follow-up question or tip",
  "suggestedChips": ["3 concise follow-up prompt suggestions"]
}
`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Network info endpoint for mobile QR code generation (supports both public online URL and local Wi-Fi IP)
  app.get("/api/network-info", (_req, res) => {
    const ip = getLocalIpAddress();
    const envUrl = process.env.VITE_APP_URL || process.env.APP_URL;
    const isPublicOnline = envUrl && envUrl.startsWith("http") && !envUrl.includes("localhost") && !envUrl.includes("MY_APP_URL");
    const publicUrl = isPublicOnline ? envUrl.replace(/\/$/, "") : null;
    const localUrl = `http://${ip}:${PORT}`;
    const url = publicUrl || localUrl;
    res.json({
      ip,
      port: PORT,
      url,
      publicUrl,
      tunnelUrl: publicUrl,
      localUrl,
      lanUrl: localUrl,
    });
  });

  // AI Food Assistant Chat endpoint powered by Gemini
  app.post("/api/chat", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }

    const { message, history, lang } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message string" });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelsToTry = [
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
      "gemini-3.5-flash",
      "gemini-flash-latest",
    ];

    const conversationParts: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history)) {
      for (const h of history) {
        if (h && h.role && h.content) {
          conversationParts.push({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: String(h.content) }],
          });
        }
      }
    }

    const userPromptWithContext = `User Request: "${message}"\n(Customer UI Language: ${lang || "en"})\n\nMenu Catalog:\n${JSON.stringify(menuCatalog, null, 2)}`;

    conversationParts.push({
      role: "user",
      parts: [{ text: userPromptWithContext }],
    });

    let lastError: any = null;
    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: conversationParts,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        });

        const responseText = response.text;
        if (responseText) {
          try {
            const parsed = JSON.parse(responseText);
            return res.json(parsed);
          } catch {
            return res.json({
              intro: responseText,
              recommendedDishIds: [],
              dishReasons: {},
              followUpSuggestion: "Would you like to explore other options?",
              suggestedChips: [
                "Recommend something spicy",
                "Best vegetarian option",
                "Something under ₹1000",
              ],
            });
          }
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed, trying fallback:`, err?.message || err);
      }
    }

    console.error("All Gemini models failed:", lastError?.message || lastError);
    return res.status(502).json({
      error: "AI service temporarily unavailable",
      details: lastError?.message || "All models failed",
    });
  });

  // Vite middleware for development vs static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    const localIp = getLocalIpAddress();
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`📱 Mobile Wi-Fi Access: http://${localIp}:${PORT}`);
  });
}

startServer();

