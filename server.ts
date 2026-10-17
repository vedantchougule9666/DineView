import "dotenv/config";
import express from "express";
import path from "path";
import os from "os";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

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

interface CatalogItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  calories: number;
  tags: string[];
  hasAR: boolean;
}

const menuCatalog: CatalogItem[] = [
  {
    id: "s1",
    name: "Truffle Arancini",
    category: "starters",
    description: "Crispy risotto balls infused with black truffle and parmesan, served with a roasted garlic aioli.",
    price: 1500,
    calories: 420,
    tags: ["Vegetarian"],
    hasAR: false,
  },
  {
    id: "s2",
    name: "Tuna Tartare",
    category: "starters",
    description: "Fresh Ahi tuna, avocado, cucumber, and a soy-ginger dressing, accompanied by crisp wonton chips.",
    price: 1800,
    calories: 310,
    tags: ["Dairy Free"],
    hasAR: false,
  },
  {
    id: "s3",
    name: "Heirloom Tomato Bruschetta",
    category: "starters",
    description: "Toasted artisanal sourdough topped with marinated heirloom tomatoes, fresh basil, and balsamic glaze.",
    price: 1200,
    calories: 250,
    tags: ["Vegetarian", "Vegan"],
    hasAR: false,
  },
  {
    id: "s4",
    name: "Burger",
    category: "starters",
    description: "A premium Wagyu beef patty layered with aged cheddar, caramelized onions, and house-made truffle aioli on a toasted artisanal brioche bun.",
    price: 1800,
    calories: 850,
    tags: [],
    hasAR: true,
  },
  {
    id: "m1",
    name: "Pan-Seared Scallops",
    category: "main-courses",
    description: "Jumbo sea scallops served over a bed of sweet corn puree, crispy pancetta, and micro-greens.",
    price: 3500,
    calories: 480,
    tags: ["Gluten Free"],
    hasAR: false,
  },
  {
    id: "m2",
    name: "Wagyu Ribeye Steak",
    category: "main-courses",
    description: "12oz Wagyu ribeye, perfectly marbled and grilled to order. Served with truffled mashed potatoes and asparagus.",
    price: 650,
    calories: 950,
    tags: ["Gluten Free"],
    hasAR: false,
  },
  {
    id: "m3",
    name: "Wild Mushroom Risotto",
    category: "main-courses",
    description: "Creamy Arborio rice with a blend of wild forest mushrooms, finished with white truffle oil and aged parmesan.",
    price: 2500,
    calories: 620,
    tags: ["Vegetarian", "Gluten Free"],
    hasAR: false,
  },
  {
    id: "m4",
    name: "Spicy Thai Basil Chicken",
    category: "main-courses",
    description: "Wok-tossed chicken breast with fresh basil, bell peppers, and chili, served over jasmine rice.",
    price: 2000,
    calories: 540,
    tags: ["Spicy", "Dairy Free"],
    hasAR: true,
  },
  {
    id: "m5",
    name: "Wood-Fired Margherita Pizza",
    category: "main-courses",
    description: "San Marzano tomato sauce, fresh buffalo mozzarella, fresh basil, and extra virgin olive oil on a slow-fermented wood-fired crust.",
    price: 2200,
    calories: 780,
    tags: ["Vegetarian"],
    hasAR: true,
  },
  {
    id: "sd1",
    name: "Roasted Brussels Sprouts",
    category: "sides",
    description: "Caramelized with balsamic reduction and tossed with toasted almonds.",
    price: 850,
    calories: 180,
    tags: ["Vegetarian", "Vegan", "Gluten Free", "Contains Nuts"],
    hasAR: false,
  },
  {
    id: "sd2",
    name: "Pommes Frites",
    category: "sides",
    description: "Thin-cut fries tossed in sea salt and rosemary, served with garlic aioli.",
    price: 750,
    calories: 380,
    tags: ["Vegetarian"],
    hasAR: false,
  },
  {
    id: "d1",
    name: "Valrhona Chocolate Fondant",
    category: "desserts",
    description: "Rich molten chocolate cake served with Madagascar vanilla bean gelato and raspberry coulis.",
    price: 1500,
    calories: 650,
    tags: ["Vegetarian"],
    hasAR: false,
  },
  {
    id: "d2",
    name: "Classic Tiramisu",
    category: "desserts",
    description: "Espresso-soaked ladyfingers layered with light mascarpone cream and dusted with cocoa powder.",
    price: 1200,
    calories: 450,
    tags: ["Vegetarian"],
    hasAR: false,
  },
  {
    id: "dr1",
    name: "Artisan Crafted Lemonade",
    category: "drinks",
    description: "Freshly squeezed lemons with a hint of lavender and sparkling water.",
    price: 650,
    calories: 120,
    tags: ["Vegetarian", "Vegan", "Gluten Free"],
    hasAR: false,
  },
  {
    id: "dr2",
    name: "Signature Negroni",
    category: "drinks",
    description: "Gin, Campari, and sweet vermouth, garnished with an orange peel.",
    price: 1500,
    calories: 190,
    tags: ["Vegetarian", "Vegan"],
    hasAR: false,
  },
];

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
6. If Customer Dining Profile (Returning Guest) is provided, acknowledge their return warmly and answer questions about their previous dining history (recent dishes ordered, favorite items, and suggest pairings).
7. Always return a valid JSON object matching this schema:
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
  const PORT = process.env.NODE_ENV === "production" ? (Number(process.env.PORT) || 3000) : 3000;

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

    const { message, history, lang, customerContext } = req.body;
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

    let customerInfoNotice = "";
    if (customerContext) {
      customerInfoNotice = `\nCustomer Dining Profile (Returning Guest):
- Phone: ${customerContext.phone || "Verified Guest"}
- Total Prior Orders: ${customerContext.totalOrders || 1}
- Recent Dishes Ordered: ${JSON.stringify(customerContext.recentDishes || [])}
- Favorite Dish IDs: ${JSON.stringify(customerContext.favoriteDishIds || [])}
If the guest asks "what did I order last time?", "reorder my favorites", or asks for pairings, reference their previous dishes directly!
`;
    }

    const userPromptWithContext = `User Request: "${message}"\n(Customer UI Language: ${lang || "en"})${customerInfoNotice}\n\nMenu Catalog:\n${JSON.stringify(menuCatalog, null, 2)}`;

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

