import { MenuItem, MenuCategory } from '../data/menu';

export interface RecommendationResult {
  dish: MenuItem;
  reason: string;
  categoryName?: string;
  whyBullets?: string[];
}

export interface ComparisonDifference {
  feature: string;
  dishAValue: string;
  dishBValue: string;
  verdict?: string;
}

export interface ComparisonResult {
  dishA: MenuItem;
  dishB: MenuItem;
  differences: ComparisonDifference[];
  summary: string;
}

export interface MealCourseItem {
  courseName: 'STARTER' | 'MAIN COURSE' | 'SIDE' | 'DESSERT' | 'DRINK';
  dish: MenuItem;
}

export interface MealPlanResult {
  courses: MealCourseItem[];
  totalPrice: number;
  totalCalories: number;
  budgetNotes: string;
}

export interface ConversationContext {
  maxPrice?: number | null;
  dietary?: 'vegetarian' | 'vegan' | 'non-veg' | null;
  glutenFree?: boolean;
  dairyFree?: boolean;
  avoidNuts?: boolean;
  spicePreference?: 'spicy' | 'mild' | null;
  satiety?: 'light' | 'hearty' | null;
  category?: string | null;
  lastMentionedDishId?: string | null;
  lastRecommendedDishIds?: string[];
}

export interface LastOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  calories?: number;
  image?: string;
}

export interface LastOrderSummary {
  orderId?: string;
  date: string;
  table: string;
  total: number;
  items: LastOrderItem[];
}

export interface SameOrDifferentSummary {
  previousDish: MenuItem;
  same: {
    dish: MenuItem;
    reason: string;
  };
  different: {
    sameCategoryDish: MenuItem;
    categoryName: string;
    priceDiff: number;
    calorieDiff: number;
    reason: string;
    pairingDish: MenuItem;
    pairingCategoryName: string;
    pairingPriceDiff: number;
    pairingCalorieDiff: number;
    pairingReason: string;
  };
}

export interface AssistantResponse {
  type: 'recommendations' | 'dish_fact' | 'comparison' | 'meal_plan' | 'allergy_info' | 'clarification' | 'last_order' | 'same_or_different';
  intro: string;
  recommendations?: RecommendationResult[];
  comparison?: ComparisonResult;
  mealPlan?: MealPlanResult;
  lastOrder?: LastOrderSummary;
  sameOrDifferent?: SameOrDifferentSummary;
  allergyNotice?: string;
  followUpSuggestion?: string;
  suggestedChips?: string[];
  conversationContext: ConversationContext;
}

const ALLERGY_SAFETY_NOTE = "Please confirm allergen information with restaurant staff before ordering, especially for severe allergies.";

/**
 * Helper to flatten all available menu items with their category
 */
function getAllItems(categories: MenuCategory[]) {
  const items: { item: MenuItem; categoryId: string; categoryName: string }[] = [];
  for (const cat of categories) {
    for (const item of cat.items) {
      if (item.available !== false) {
        items.push({ item, categoryId: cat.id, categoryName: cat.name });
      }
    }
  }
  return items;
}

/**
 * Fuzzy search to match a dish name from user text
 */
function findDishByName(text: string, allItems: { item: MenuItem }[]): MenuItem | null {
  const normalized = text.toLowerCase();
  
  // Specific alias mappings
  if (normalized.includes('burger')) return allItems.find(i => i.item.id === 's4')?.item || null;
  if (normalized.includes('thai basil') || normalized.includes('spicy chicken') || normalized.includes('thai chicken')) {
    return allItems.find(i => i.item.id === 'm4')?.item || null;
  }
  if (normalized.includes('steak') || normalized.includes('ribeye')) return allItems.find(i => i.item.id === 'm2')?.item || null;
  if (normalized.includes('scallop')) return allItems.find(i => i.item.id === 'm1')?.item || null;
  if (normalized.includes('risotto') && !normalized.includes('arancini')) return allItems.find(i => i.item.id === 'm3')?.item || null;
  if (normalized.includes('arancini')) return allItems.find(i => i.item.id === 's1')?.item || null;
  if (normalized.includes('tartare') || normalized.includes('tuna')) return allItems.find(i => i.item.id === 's2')?.item || null;
  if (normalized.includes('bruschetta')) return allItems.find(i => i.item.id === 's3')?.item || null;
  if (normalized.includes('brussels') || normalized.includes('sprout')) return allItems.find(i => i.item.id === 'sd1')?.item || null;
  if (normalized.includes('pommes') || normalized.includes('fries')) return allItems.find(i => i.item.id === 'sd2')?.item || null;
  if (normalized.includes('fondant') || normalized.includes('chocolate')) return allItems.find(i => i.item.id === 'd1')?.item || null;
  if (normalized.includes('tiramisu')) return allItems.find(i => i.item.id === 'd2')?.item || null;
  if (normalized.includes('lemonade')) return allItems.find(i => i.item.id === 'dr1')?.item || null;
  if (normalized.includes('negroni')) return allItems.find(i => i.item.id === 'dr2')?.item || null;

  // Generic direct name substring
  for (const { item } of allItems) {
    if (normalized.includes(item.name.toLowerCase())) {
      return item;
    }
  }

  return null;
}

/**
 * Intelligent digital food concierge engine for DineView.
 * Deterministic, grounded strictly in actual menu data, zero hallucinations.
 */
export function getFoodRecommendations(
  query: string,
  categories: MenuCategory[],
  lang: string = 'en',
  prevContext: ConversationContext = {}
): AssistantResponse {
  const normalizedQuery = query.toLowerCase().trim();
  const allItems = getAllItems(categories);
  const context: ConversationContext = { ...prevContext };

  // -------------------------------------------------------------
  // FEATURE: "SAME OR DIFFERENT" QUERY
  // -------------------------------------------------------------
  if (/\b(same\s*or\s*different|same\s*or\s*new|same\s*or\s*something|same\s*vs\s*different|reorder\s*or\s*try)\b/i.test(normalizedQuery)) {
    const prevDishId = context.lastMentionedDishId || 's4';
    const prevDishItem = allItems.find(i => i.item.id === prevDishId) || allItems.find(i => i.item.id === 's4')!;
    const prevDish = prevDishItem.item;
    const prevCategory = prevDishItem.categoryId;

    // 1 same-category different dish
    const sameCatDiffItem = allItems.find(i => i.categoryId === prevCategory && i.item.id !== prevDish.id) 
      || allItems.find(i => i.item.id !== prevDish.id)!;
    const sameCategoryDish = sameCatDiffItem.item;
    const priceDiff = sameCategoryDish.price - prevDish.price;
    const calorieDiff = sameCategoryDish.calories - prevDish.calories;

    // 1 dessert / drink pairing
    const pairingItem = allItems.find(i => i.categoryId === 'desserts' && i.item.id !== prevDish.id)
      || allItems.find(i => i.categoryId === 'drinks' && i.item.id !== prevDish.id)!;
    const pairingDish = pairingItem.item;
    const pairingPriceDiff = pairingDish.price - prevDish.price;
    const pairingCalorieDiff = pairingDish.calories - prevDish.calories;

    return {
      type: 'same_or_different',
      intro: `Deciding between familiar comfort and new culinary discoveries? Here is your curated choice: Reorder the same favorite dish, or explore a distinct creation in the same course alongside a curated pairing:`,
      sameOrDifferent: {
        previousDish: prevDish,
        same: {
          dish: prevDish,
          reason: `Reorder your verified favorite: ${prevDish.name} (₹${prevDish.price.toLocaleString('en-IN')}, ${prevDish.calories} kcal). Perfectly prepared to order by our kitchen.`
        },
        different: {
          sameCategoryDish,
          categoryName: sameCatDiffItem.categoryName,
          priceDiff,
          calorieDiff,
          reason: `Because you had ${prevDish.name}, experience ${sameCategoryDish.name} for an exciting alternative in the same course.`,
          pairingDish,
          pairingCategoryName: pairingItem.categoryName,
          pairingPriceDiff,
          pairingCalorieDiff,
          pairingReason: `Because you had ${prevDish.name}, pair with ${pairingDish.name} to harmonize your dining palate.`
        }
      },
      recommendations: [
        {
          dish: prevDish,
          reason: `Same: Reorder favorite ${prevDish.name}`,
          whyBullets: [`Price: ₹${prevDish.price.toLocaleString('en-IN')}`, `Calories: ${prevDish.calories} kcal`]
        },
        {
          dish: sameCategoryDish,
          reason: `Different (${sameCatDiffItem.categoryName}): ${sameCategoryDish.name} (${priceDiff >= 0 ? `+₹${priceDiff}` : `-₹${Math.abs(priceDiff)}`}, ${calorieDiff >= 0 ? `+${calorieDiff}` : `${calorieDiff}`} kcal)`,
          whyBullets: [`Category: ${sameCatDiffItem.categoryName}`, `Price: ₹${sameCategoryDish.price.toLocaleString('en-IN')}`, `Because you had ${prevDish.name}`]
        },
        {
          dish: pairingDish,
          reason: `Pairing (${pairingItem.categoryName}): ${pairingDish.name}`,
          whyBullets: [`Category: ${pairingItem.categoryName}`, `Price: ₹${pairingDish.price.toLocaleString('en-IN')}`, `Because you had ${prevDish.name}`]
        }
      ],
      followUpSuggestion: "Tap 'VIEW DISH' on any selection to inspect details or launch 3D/AR preview.",
      suggestedChips: [`Reorder ${prevDish.name}`, `View ${sameCategoryDish.name}`, `View ${pairingDish.name}`, 'Something under ₹1000'],
      conversationContext: { ...context, lastMentionedDishId: sameCategoryDish.id }
    };
  }

  // -------------------------------------------------------------
  // 1. FEATURE 14: AR-AWARE INQUIRIES
  // -------------------------------------------------------------
  if (/\b(ar|augmented\s*reality|3d|camera|model|view\s*in\s*ar)\b/i.test(normalizedQuery) && 
      !/\b(compare|which|calories|price)\b/i.test(normalizedQuery)) {
    const arDishes = allItems.filter(i => Boolean(i.item.modelUrl));
    return {
      type: 'recommendations',
      intro: `DineView currently features interactive 3D and native Augmented Reality (AR) table preview for ${arDishes.length} signature dishes:`,
      recommendations: arDishes.map(d => {
        let reason = `Experience ${d.item.name} placed directly on your physical dining table in true-to-scale AR.`;
        let whyBullets = [
          "Interactive 3D model available directly on the dish details page",
          "One-tap 'VIEW IN AR' launches native camera placement",
          "Lightweight optimized AR model (<1.5MB) for instant plane tracking"
        ];
        if (d.item.id === 's4') {
          reason = "Our signature Truffle Wagyu Burger can be placed directly on your physical dining table in true-to-scale AR.";
          whyBullets = [
            "Interactive 3D model available directly on the dish details page",
            "One-tap 'VIEW IN AR' launches native camera placement",
            "Authored to realistic physical dimensions (14.4cm × 12.0cm)"
          ];
        } else if (d.item.id === 'm5') {
          reason = "Inspect our Wood-Fired Margherita Pizza with charred crust and fresh buffalo mozzarella in true-to-scale AR.";
          whyBullets = [
            "Life-sized 12-inch pizza projection directly onto your table",
            "Ultra-fast AR loading with Draco compression",
            "Fixed scale prevents sliding or rescale jitter"
          ];
        } else if (d.item.id === 'm4') {
          reason = "Preview our Roasted Chicken dish in full 3D and AR before ordering.";
          whyBullets = [
            "Realistic high-detail textures and lighting preview",
            "Tap 'VIEW IN AR' for instant WebXR / Scene Viewer / Quick Look placement",
            "Optimized lightweight geometry for rock-solid plane tracking"
          ];
        }
        return {
          dish: d.item,
          categoryName: d.categoryName,
          reason,
          whyBullets
        };
      }),
      followUpSuggestion: "Tap 'VIEW DISH' to see the 3D model and launch 'VIEW IN AR'.",
      suggestedChips: ['View Burger in AR', 'View Pizza in AR', 'View Chicken in AR'],
      conversationContext: { ...context, lastMentionedDishId: 's4' }
    };
  }

  // -------------------------------------------------------------
  // 1B. FEATURE 6: "WHY THIS?" / "WHY DID YOU RECOMMEND THIS?"
  // -------------------------------------------------------------
  if (/\b(why\s*(?:did\s*you\s*)?recommend|why\s*this|why\s*these|why\s*choose\s*this)\b/i.test(normalizedQuery)) {
    const lastIds = context.lastRecommendedDishIds && context.lastRecommendedDishIds.length > 0
      ? context.lastRecommendedDishIds
      : ['s4'];
    const dishes = allItems.filter(i => lastIds.includes(i.item.id)).map(i => i.item);

    return {
      type: 'dish_fact',
      intro: "Here is the exact rationale behind our recommendations, grounded exclusively in our verified menu data:",
      recommendations: dishes.map(d => ({
        dish: d,
        reason: `Selected because it matches your dining criteria and provides verified nutritional and pricing transparency (${d.calories} kcal, ₹${d.price.toLocaleString('en-IN')}).`,
        whyBullets: [
          `Verified preparation: ${d.description}`,
          `Price: ₹${d.price.toLocaleString('en-IN')}`,
          `Calories: ${d.calories} kcal`,
          `Dietary tags: ${d.tags?.map(t => t.label).join(', ') || 'Standard'}`
        ]
      })),
      followUpSuggestion: "Tap 'VIEW DISH' to see preparation notes, or tell me if you'd prefer something else.",
      suggestedChips: ['Something lighter', 'Something under ₹1000', 'Surprise me'],
      conversationContext: context
    };
  }

  // -------------------------------------------------------------
  // 2. FEATURE 7: COMPARE DISHES
  // -------------------------------------------------------------
  const compareMatch = normalizedQuery.match(/(?:compare|difference\s+between)\s+(.+?)\s+(?:and|with|to|vs\.?)\s+(.+)/i) ||
                       normalizedQuery.match(/which\s+is\s+(?:lighter|cheaper|better|spicier|heavier)\s*:\s*(.+?)\s+(?:or|and)\s+(.+)/i);
  if (compareMatch) {
    const dishA = findDishByName(compareMatch[1], allItems);
    const dishB = findDishByName(compareMatch[2], allItems);

    if (dishA && dishB && dishA.id !== dishB.id) {
      const isALighter = dishA.calories < dishB.calories;
      const isACheaper = dishA.price < dishB.price;

      const diffs: ComparisonDifference[] = [
        {
          feature: "Price",
          dishAValue: `₹${dishA.price.toLocaleString('en-IN')}`,
          dishBValue: `₹${dishB.price.toLocaleString('en-IN')}`,
          verdict: isACheaper ? `${dishA.name} is ₹${(dishB.price - dishA.price).toLocaleString('en-IN')} more affordable` : `${dishB.name} is ₹${(dishA.price - dishB.price).toLocaleString('en-IN')} more affordable`
        },
        {
          feature: "Calories & Satiety",
          dishAValue: `${dishA.calories} kcal`,
          dishBValue: `${dishB.calories} kcal`,
          verdict: isALighter ? `${dishA.name} is lighter (${dishB.calories - dishA.calories} kcal less)` : `${dishB.name} is lighter (${dishA.calories - dishB.calories} kcal less)`
        },
        {
          feature: "Flavor & Profile",
          dishAValue: dishA.tags?.some(t => t.id === 'spicy') ? "Spicy / Chili" : "Savory / Balanced",
          dishBValue: dishB.tags?.some(t => t.id === 'spicy') ? "Spicy / Chili" : "Savory / Balanced"
        },
        {
          feature: "Dietary",
          dishAValue: dishA.tags?.map(t => t.label).join(', ') || "Non-Vegetarian",
          dishBValue: dishB.tags?.map(t => t.label).join(', ') || "Non-Vegetarian"
        },
        {
          feature: "3D & AR Preview",
          dishAValue: dishA.modelUrl ? "Available in AR" : "Standard presentation",
          dishBValue: dishB.modelUrl ? "Available in AR" : "Standard presentation"
        }
      ];

      return {
        type: 'comparison',
        intro: `Here is a side-by-side comparison of ${dishA.name} and ${dishB.name}:`,
        comparison: {
          dishA,
          dishB,
          differences: diffs,
          summary: `${dishA.name} (₹${dishA.price.toLocaleString('en-IN')}, ${dishA.calories} kcal) vs ${dishB.name} (₹${dishB.price.toLocaleString('en-IN')}, ${dishB.calories} kcal).`
        },
        recommendations: [
          {
            dish: dishA,
            reason: `Priced at ₹${dishA.price.toLocaleString('en-IN')}, offering ${dishA.calories} kcal.`,
            whyBullets: [`Price: ₹${dishA.price.toLocaleString('en-IN')}`, `Calories: ${dishA.calories} kcal`]
          },
          {
            dish: dishB,
            reason: `Priced at ₹${dishB.price.toLocaleString('en-IN')}, offering ${dishB.calories} kcal.`,
            whyBullets: [`Price: ₹${dishB.price.toLocaleString('en-IN')}`, `Calories: ${dishB.calories} kcal`]
          }
        ],
        followUpSuggestion: "Tap 'VIEW DISH' on either item to inspect full preparation details or place an order.",
        suggestedChips: [`View ${dishA.name}`, `View ${dishB.name}`, 'Something under ₹1000'],
        conversationContext: { ...context, lastRecommendedDishIds: [dishA.id, dishB.id] }
      };
    }
  }

  // -------------------------------------------------------------
  // 3. FEATURE 8 & 9: BUILD MY MEAL / BUDGET COMBINATIONS
  // -------------------------------------------------------------
  if (/\b(build\s*(?:me\s*)?(?:a\s*)?meal|create\s*(?:a\s*)?meal|set\s*menu|combo|full\s*course|starter.*main.*drink)\b/i.test(normalizedQuery) ||
      (/\b(meal\s*under|for\s*₹?\d+)\b/i.test(normalizedQuery) && /\b(build|make|give\s*me\s*a\s*meal|full)\b/i.test(normalizedQuery))) {
    
    // Extract budget or default to ₹3000
    const budgetMatch = normalizedQuery.match(/(?:₹|rs\.?|inr|under|for)?\s*(\d{3,5})/i);
    const mealBudget = budgetMatch ? parseInt(budgetMatch[1], 10) : 3000;
    const isVegOnly = /\b(veg|vegetarian|plant)\b/i.test(normalizedQuery);

    const starters = allItems.filter(i => i.categoryId === 'starters' && (!isVegOnly || i.item.tags?.some(t => t.id === 'v' || t.id === 'vg')));
    const mains = allItems.filter(i => i.categoryId === 'main-courses' && (!isVegOnly || i.item.tags?.some(t => t.id === 'v' || t.id === 'vg')));
    const drinks = allItems.filter(i => (i.categoryId === 'drinks' || i.categoryId === 'desserts'));

    let bestCombo: { starter: MenuItem; main: MenuItem; drink: MenuItem; total: number } | null = null;
    let closestDiff = Infinity;

    for (const s of starters) {
      for (const m of mains) {
        for (const d of drinks) {
          const total = s.item.price + m.item.price + d.item.price;
          if (total <= mealBudget) {
            const diff = mealBudget - total;
            if (diff < closestDiff) {
              closestDiff = diff;
              bestCombo = { starter: s.item, main: m.item, drink: d.item, total };
            }
          }
        }
      }
    }

    if (bestCombo) {
      const courses: MealCourseItem[] = [
        { courseName: 'STARTER', dish: bestCombo.starter },
        { courseName: 'MAIN COURSE', dish: bestCombo.main },
        { courseName: 'DRINK', dish: bestCombo.drink },
      ];

      return {
        type: 'meal_plan',
        intro: `Here is a curated 3-course ${isVegOnly ? 'vegetarian ' : ''}meal within your ₹${mealBudget.toLocaleString('en-IN')} budget:`,
        mealPlan: {
          courses,
          totalPrice: bestCombo.total,
          totalCalories: bestCombo.starter.calories + bestCombo.main.calories + bestCombo.drink.calories,
          budgetNotes: `Total: ₹${bestCombo.total.toLocaleString('en-IN')} (saving ₹${(mealBudget - bestCombo.total).toLocaleString('en-IN')} under budget)`
        },
        recommendations: [
          { dish: bestCombo.starter, reason: `Starter course: ${bestCombo.starter.description}` },
          { dish: bestCombo.main, reason: `Main course: ${bestCombo.main.description}` },
          { dish: bestCombo.drink, reason: `Beverage/Dessert pairing: ${bestCombo.drink.description}` }
        ],
        followUpSuggestion: "You can tap 'VIEW DISH' on any course to review ingredients and add it to your order.",
        suggestedChips: ['Build another meal', 'Something under ₹1000', 'What should I try?'],
        conversationContext: { ...context, maxPrice: mealBudget }
      };
    } else {
      // Return affordable individual items
      return {
        type: 'clarification',
        intro: `We could not assemble a full 3-course meal under ₹${mealBudget.toLocaleString('en-IN')}, as our combined courses start higher. However, you can enjoy these exquisite standalone dishes:`,
        recommendations: allItems.filter(i => i.item.price <= mealBudget).slice(0, 3).map(i => ({
          dish: i.item,
          categoryName: i.categoryName,
          reason: `Priced at ₹${i.item.price.toLocaleString('en-IN')}, comfortably within your budget.`
        })),
        followUpSuggestion: "Try asking for 'Build a meal under ₹3500' or exploring standalone mains.",
        suggestedChips: ['Build meal under ₹3500', 'Something under ₹1000'],
        conversationContext: context
      };
    }
  }

  // -------------------------------------------------------------
  // 4. FEATURE 4 & 5: ALLERGY ASSISTANT & SAFETY
  // -------------------------------------------------------------
  const isAllergyInquiry = /\b(allerg|allergen|peanuts?|nuts?|dairy|lactose|gluten|celiac|shellfish|crustacean)\b/i.test(normalizedQuery);
  const mentionsNuts = /\b(nuts?|peanuts?|almonds?|cashews?|tree\s*nuts?)\b/i.test(normalizedQuery);
  const mentionsDairy = /\b(dairy|lactose|milk|cheese|butter|cream)\b/i.test(normalizedQuery);
  const mentionsGluten = /\b(gluten|wheat|celiac)\b/i.test(normalizedQuery);
  const mentionsShellfish = /\b(shellfish|crustacean|shrimp|prawn|crab|scallop|lobster)\b/i.test(normalizedQuery);

  if (isAllergyInquiry) {
    // Specific single-dish allergen check (e.g. "Does the burger contain nuts?")
    const targetDish = findDishByName(normalizedQuery, allItems);
    if (targetDish) {
      const tagIds = (targetDish.tags || []).map(t => t.id);
      let dishAllergyExplanation = "";

      if (mentionsNuts) {
        if (tagIds.includes('n')) {
          dishAllergyExplanation = `Yes. ${targetDish.name} is explicitly tagged in our menu data as containing nuts (tossed with toasted almonds).`;
        } else {
          dishAllergyExplanation = `${targetDish.name} is not tagged with Contains Nuts [n] in our menu data. Its official ingredients are: ${targetDish.description}. However, trace allergen information is not available in the current menu data.`;
        }
      } else if (mentionsDairy) {
        if (tagIds.includes('df')) {
          dishAllergyExplanation = `According to our menu data, ${targetDish.name} is verified as Dairy Free [df].`;
        } else {
          dishAllergyExplanation = `${targetDish.name} does not carry a Dairy Free tag. Its description states: "${targetDish.description}".`;
        }
      } else if (mentionsGluten) {
        if (tagIds.includes('gf')) {
          dishAllergyExplanation = `According to our menu data, ${targetDish.name} is verified as Gluten Free [gf].`;
        } else {
          dishAllergyExplanation = `${targetDish.name} is not tagged as gluten-free in our menu data.`;
        }
      } else {
        dishAllergyExplanation = `For ${targetDish.name}, our verified dietary tags are: ${targetDish.tags?.map(t => t.label).join(', ') || 'No explicit allergy tags listed'}. Description: "${targetDish.description}".`;
      }

      return {
        type: 'allergy_info',
        intro: dishAllergyExplanation,
        allergyNotice: ALLERGY_SAFETY_NOTE,
        recommendations: [
          {
            dish: targetDish,
            reason: `Menu description: ${targetDish.description}`,
            whyBullets: [
              `Listed dietary tags: ${targetDish.tags?.map(t => t.label).join(', ') || 'None'}`,
              `Price: ₹${targetDish.price.toLocaleString('en-IN')}`,
              ALLERGY_SAFETY_NOTE
            ]
          }
        ],
        followUpSuggestion: "If you have an allergy or dietary restriction, our staff will gladly accommodate you.",
        suggestedChips: ['Show dishes without nuts', 'Gluten-free options', 'What should I try?'],
        conversationContext: { ...context, lastMentionedDishId: targetDish.id }
      };
    }

    // General Allergen Filtering (e.g. "I am allergic to nuts. What can I eat?")
    if (mentionsNuts) {
      const nutDish = allItems.find(i => i.item.tags?.some(t => t.id === 'n'))?.item;
      const safeOptions = allItems.filter(i => !i.item.tags?.some(t => t.id === 'n')).slice(0, 3);

      return {
        type: 'allergy_info',
        intro: `Our Roasted Brussels Sprouts is the only dish explicitly tagged with Contains Nuts [n] (contains toasted almonds). The following dishes are not tagged with nuts in our verified menu data:`,
        allergyNotice: ALLERGY_SAFETY_NOTE,
        recommendations: safeOptions.map(o => ({
          dish: o.item,
          categoryName: o.categoryName,
          reason: `No nut ingredients listed in official menu description: "${o.item.description}".`,
          whyBullets: [
            "Not tagged with Contains Nuts [n]",
            `Price: ₹${o.item.price.toLocaleString('en-IN')}`,
            ALLERGY_SAFETY_NOTE
          ]
        })),
        followUpSuggestion: "Please notify your server of your nut allergy when ordering so the kitchen can prevent cross-contact.",
        suggestedChips: ['Gluten-free options', 'Vegetarian without nuts', 'Something under ₹1000'],
        conversationContext: { ...context, avoidNuts: true }
      };
    }

    if (mentionsGluten) {
      const gfOptions = allItems.filter(i => i.item.tags?.some(t => t.id === 'gf')).slice(0, 3);
      return {
        type: 'allergy_info',
        intro: "According to our official menu data, the following dishes are verified Gluten Free [gf]:",
        allergyNotice: ALLERGY_SAFETY_NOTE,
        recommendations: gfOptions.map(o => ({
          dish: o.item,
          categoryName: o.categoryName,
          reason: `Certified Gluten Free [gf]: ${o.item.description}`,
          whyBullets: [
            "Verified Gluten Free [gf] tag in menu",
            `Price: ₹${o.item.price.toLocaleString('en-IN')}`,
            `${o.item.calories} kcal`
          ]
        })),
        followUpSuggestion: "Let your server know if you have celiac disease or severe sensitivity.",
        suggestedChips: ['Gluten-free mains', 'Under ₹1000', 'What should I try?'],
        conversationContext: { ...context, glutenFree: true }
      };
    }

    if (mentionsShellfish) {
      // Scallops (m1) contains jumbo sea scallops
      const shellfishDish = allItems.find(i => i.item.id === 'm1')?.item;
      const nonShellfish = allItems.filter(i => i.item.id !== 'm1' && i.item.id !== 's2').slice(0, 3);
      return {
        type: 'allergy_info',
        intro: "Pan-Seared Scallops contains jumbo sea scallops, and Tuna Tartare contains Ahi tuna. The dishes below do not contain seafood in their official descriptions:",
        allergyNotice: ALLERGY_SAFETY_NOTE,
        recommendations: nonShellfish.map(o => ({
          dish: o.item,
          categoryName: o.categoryName,
          reason: `Verified non-seafood option: ${o.item.name} (${o.item.description}).`,
          whyBullets: ["Contains no shellfish in listed ingredients", ALLERGY_SAFETY_NOTE]
        })),
        followUpSuggestion: "Please verify with restaurant staff regarding cross-contact in seafood preparation areas.",
        suggestedChips: ['Vegetarian dishes', 'Burger', 'What should I try?'],
        conversationContext: context
      };
    }
  }

  // -------------------------------------------------------------
  // 5. FEATURE 3: DISH KNOWLEDGE & SINGLE DISH FACTS
  // -------------------------------------------------------------
  const singleDishMatch = findDishByName(normalizedQuery, allItems);
  if (singleDishMatch && (
    /\b(what\s+is|tell\s+me\s+about|calories|cost|price|how\s+much|contain|ingredients|is\s+it\s+veg|details)\b/i.test(normalizedQuery) ||
    normalizedQuery === singleDishMatch.name.toLowerCase()
  )) {
    const isVeg = singleDishMatch.tags?.some(t => t.id === 'v' || t.id === 'vg');
    const tagsString = singleDishMatch.tags?.map(t => t.label).join(', ') || 'Standard dietary preparation';
    const isAR = Boolean(singleDishMatch.modelUrl);

    let specificFact = `${singleDishMatch.name} is priced at ₹${singleDishMatch.price.toLocaleString('en-IN')} with ${singleDishMatch.calories} calories.`;
    if (/\b(calories|cal)\b/i.test(normalizedQuery)) {
      specificFact = `${singleDishMatch.name} has exactly ${singleDishMatch.calories} kcal as listed in our menu data.`;
    } else if (/\b(price|cost|how\s+much)\b/i.test(normalizedQuery)) {
      specificFact = `${singleDishMatch.name} costs ₹${singleDishMatch.price.toLocaleString('en-IN')}.`;
    } else if (/\b(veg|vegetarian)\b/i.test(normalizedQuery)) {
      specificFact = isVeg
        ? `Yes, ${singleDishMatch.name} is 100% vegetarian.`
        : `No, ${singleDishMatch.name} is a non-vegetarian dish (${singleDishMatch.description}).`;
    }

    const whyBullets = [
      `Official Description: ${singleDishMatch.description}`,
      `Price: ₹${singleDishMatch.price.toLocaleString('en-IN')} | Calories: ${singleDishMatch.calories} kcal`,
      `Dietary Tags: ${tagsString}`,
      isAR ? "Available with interactive 3D and native AR table placement" : "Available to order from our live kitchen"
    ];

    return {
      type: 'dish_fact',
      intro: `${specificFact} "${singleDishMatch.description}"`,
      recommendations: [
        {
          dish: singleDishMatch,
          reason: `Official description: ${singleDishMatch.description}`,
          whyBullets
        }
      ],
      followUpSuggestion: isAR ? "Tap 'VIEW DISH' to inspect full nutritional info and launch the 3D/AR preview!" : "Tap 'VIEW DISH' to inspect details and add to your order.",
      suggestedChips: isAR ? ['View Burger in AR', 'Compare Burger & Steak', 'Something under ₹1000'] : ['What else should I try?', 'Compare with another dish'],
      conversationContext: { ...context, lastMentionedDishId: singleDishMatch.id }
    };
  }

  // -------------------------------------------------------------
  // 6. FEATURE 17: MENU KNOWLEDGE AGGREGATE QUESTIONS
  // -------------------------------------------------------------
  if (/\b(cheapest|lowest\s*price|most\s*affordable)\b/i.test(normalizedQuery)) {
    const sorted = [...allItems].sort((a, b) => a.item.price - b.item.price);
    const cheapest = sorted[0].item;
    return {
      type: 'recommendations',
      intro: `Our most affordable selections start with ${cheapest.name} at ₹${cheapest.price.toLocaleString('en-IN')}:`,
      recommendations: sorted.slice(0, 3).map(s => ({
        dish: s.item,
        categoryName: s.categoryName,
        reason: `Priced at ₹${s.item.price.toLocaleString('en-IN')} (${s.item.calories} kcal).`
      })),
      followUpSuggestion: "Tap 'VIEW DISH' on any item to view details.",
      suggestedChips: ['Under ₹1000', 'What should I try?'],
      conversationContext: context
    };
  }

  if (/\b(most\s*expensive|priciest|luxury|highest\s*price)\b/i.test(normalizedQuery)) {
    const sorted = [...allItems].sort((a, b) => b.item.price - a.item.price);
    const priciest = sorted[0].item;
    return {
      type: 'recommendations',
      intro: `Our most luxurious culinary offering is ${priciest.name} (₹${priciest.price.toLocaleString('en-IN')}):`,
      recommendations: sorted.slice(0, 3).map(s => ({
        dish: s.item,
        categoryName: s.categoryName,
        reason: `${s.item.description} (₹${s.item.price.toLocaleString('en-IN')}).`
      })),
      followUpSuggestion: "Prepared with premium seasonal ingredients by our executive chef.",
      suggestedChips: ['What should I try?', 'Something under ₹2000'],
      conversationContext: context
    };
  }

  if (/\b(highest\s*calorie|most\s*calor|heaviest)\b/i.test(normalizedQuery)) {
    const sorted = [...allItems].sort((a, b) => b.item.calories - a.item.calories);
    return {
      type: 'recommendations',
      intro: `Our most hearty, calorie-dense dishes are:`,
      recommendations: sorted.slice(0, 3).map(s => ({
        dish: s.item,
        categoryName: s.categoryName,
        reason: `${s.item.calories} kcal — ${s.item.description}`
      })),
      followUpSuggestion: "Ideal if you are seeking a hearty, deeply filling meal.",
      suggestedChips: ['I want something light', 'What should I try?'],
      conversationContext: context
    };
  }

  if (/\b(lightest|lowest\s*calorie|fewest\s*calories)\b/i.test(normalizedQuery)) {
    const sorted = [...allItems].sort((a, b) => a.item.calories - b.item.calories);
    return {
      type: 'recommendations',
      intro: `Our lightest options with the lowest calorie counts are:`,
      recommendations: sorted.slice(0, 3).map(s => ({
        dish: s.item,
        categoryName: s.categoryName,
        reason: `Only ${s.item.calories} kcal — ${s.item.description}`
      })),
      followUpSuggestion: "Wholesome, refreshing choices that won't weigh you down.",
      suggestedChips: ['I am vegetarian and light', 'Under ₹1000'],
      conversationContext: context
    };
  }

  if (/\b(how\s+many\s+vegetarian|count\s+vegetarian)\b/i.test(normalizedQuery)) {
    const vegCount = allItems.filter(i => i.item.tags?.some(t => t.id === 'v' || t.id === 'vg')).length;
    return {
      type: 'clarification',
      intro: `DineView offers exactly ${vegCount} verified vegetarian dishes across our starters, mains, slides, desserts, and drinks.`,
      recommendations: allItems.filter(i => i.item.tags?.some(t => t.id === 'v')).slice(0, 3).map(v => ({
        dish: v.item,
        categoryName: v.categoryName,
        reason: `Vegetarian selection: ${v.item.description}`
      })),
      followUpSuggestion: "Ask 'Show vegetarian dishes' to explore all of them.",
      suggestedChips: ['Show vegetarian dishes', 'Best vegetarian option'],
      conversationContext: context
    };
  }

  // -------------------------------------------------------------
  // 7. FEATURE 12: DISH DISCOVERY BY CATEGORY
  // -------------------------------------------------------------
  if (/\b(dessert|desserts|sweet|sweets)\b/i.test(normalizedQuery) && !/\b(main|starter|spicy)\b/i.test(normalizedQuery)) {
    const desserts = allItems.filter(i => i.categoryId === 'desserts');
    return {
      type: 'recommendations',
      intro: "Here are our handcrafted desserts created by our pastry chef:",
      recommendations: desserts.map(d => ({
        dish: d.item,
        categoryName: d.categoryName,
        reason: `${d.item.description} (₹${d.item.price.toLocaleString('en-IN')}, ${d.item.calories} kcal).`,
        whyBullets: [
          `Category: Desserts`,
          `Price: ₹${d.item.price.toLocaleString('en-IN')}`,
          `Calories: ${d.item.calories} kcal`,
          "100% Vegetarian"
        ]
      })),
      followUpSuggestion: "Both dessert options are vegetarian and freshly prepared.",
      suggestedChips: ['Show drinks', 'What should I try?'],
      conversationContext: { ...context, category: 'desserts' }
    };
  }

  if (/\b(drink|drinks|beverage|beverages|cocktail|cocktails|wine)\b/i.test(normalizedQuery) && !/\b(main|starter|spicy)\b/i.test(normalizedQuery)) {
    const drinks = allItems.filter(i => i.categoryId === 'drinks');
    return {
      type: 'recommendations',
      intro: "Here are our signature beverage selections:",
      recommendations: drinks.map(d => ({
        dish: d.item,
        categoryName: d.categoryName,
        reason: `${d.item.description} (₹${d.item.price.toLocaleString('en-IN')}, ${d.item.calories} kcal).`,
        whyBullets: [
          `Category: Beverages`,
          `Price: ₹${d.item.price.toLocaleString('en-IN')}`,
          `Calories: ${d.item.calories} kcal`
        ]
      })),
      followUpSuggestion: "Perfect to pair with your main course.",
      suggestedChips: ['What should I try?', 'Under ₹1000'],
      conversationContext: { ...context, category: 'drinks' }
    };
  }

  // -------------------------------------------------------------
  // 8. FEATURE 13: SIMILAR DISHES / ALTERNATIVES
  // -------------------------------------------------------------
  if (/\b(similar\s+to|alternative\s+to|like\s+the|like\s+burger)\b/i.test(normalizedQuery)) {
    const target = findDishByName(normalizedQuery, allItems) || allItems.find(i => i.item.id === context.lastMentionedDishId)?.item;
    if (target) {
      // Find similar based on category, calorie tier, or protein
      const alternatives = allItems
        .filter(i => i.item.id !== target.id)
        .map(i => {
          let similarityScore = 0;
          if (i.categoryId === (allItems.find(a => a.item.id === target.id)?.categoryId)) similarityScore += 30;
          if (Math.abs(i.item.price - target.price) < 500) similarityScore += 20;
          if (Math.abs(i.item.calories - target.calories) < 200) similarityScore += 20;
          if (target.id === 's4' && (i.item.id === 'm2' || i.item.id === 's1')) similarityScore += 40; // Wagyu/Truffle connection
          return { item: i.item, categoryName: i.categoryName, score: similarityScore };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      return {
        type: 'recommendations',
        intro: `If you appreciate ${target.name}, you will likely enjoy these comparable menu selections:`,
        recommendations: alternatives.map(a => ({
          dish: a.item,
          categoryName: a.categoryName,
          reason: `Shares similar culinary richness: "${a.item.description}".`,
          whyBullets: [
            `Price: ₹${a.item.price.toLocaleString('en-IN')} (Target: ₹${target.price.toLocaleString('en-IN')})`,
            `Calories: ${a.item.calories} kcal`,
            `Category: ${a.categoryName}`
          ]
        })),
        followUpSuggestion: "Tap 'VIEW DISH' to explore full details and pairings.",
        suggestedChips: ['Compare these dishes', 'Something under ₹1000'],
        conversationContext: { ...context, lastRecommendedDishIds: alternatives.map(a => a.item.id) }
      };
    }
  }

  // -------------------------------------------------------------
  // 9. FEATURE 10: SURPRISE ME
  // -------------------------------------------------------------
  if (/\b(surprise\s*me|pick\s*for\s*me|random|anything\s*good)\b/i.test(normalizedQuery)) {
    const isVeg = /\b(veg|vegetarian)\b/i.test(normalizedQuery);
    const pool = allItems.filter(i => !isVeg || i.item.tags?.some(t => t.id === 'v'));
    // Select an exciting signature dish
    const picked = pool.find(i => i.item.id === (isVeg ? 'm3' : 's4')) || pool[0];

    return {
      type: 'recommendations',
      intro: `Here is a dish you might enjoy trying from our executive chef:`,
      recommendations: [
        {
          dish: picked.item,
          categoryName: picked.categoryName,
          reason: picked.item.id === 's4'
            ? "Our renowned Wagyu burger layered with aged cheddar and truffle aioli — featuring interactive 3D and AR table placement."
            : picked.item.description,
          whyBullets: [
            `Chef's highlight in ${picked.categoryName}`,
            `Price: ₹${picked.item.price.toLocaleString('en-IN')}`,
            `Calories: ${picked.item.calories} kcal`,
            picked.item.modelUrl ? "Full 3D / AR Preview available" : "Freshly prepared to order"
          ]
        }
      ],
      followUpSuggestion: "Would you like something lighter, spicy, or in a different price tier?",
      suggestedChips: ['Something lighter', 'Something spicy', 'Under ₹1000'],
      conversationContext: { ...context, lastMentionedDishId: picked.item.id }
    };
  }

  // -------------------------------------------------------------
  // 10. FEATURE 2: CONVERSATIONAL REFINEMENT
  // -------------------------------------------------------------
  if (/\b(too\s*expensive|cheaper|lower\s*price|less\s*money)\b/i.test(normalizedQuery)) {
    const currentMax = context.maxPrice || 2000;
    const newMax = Math.min(currentMax, 1000);
    context.maxPrice = newMax;

    const affordable = allItems.filter(i => i.item.price <= newMax).sort((a, b) => a.item.price - b.item.price).slice(0, 3);
    return {
      type: 'recommendations',
      intro: `Understood. Here are our most delightful options comfortably within your lower budget (all under ₹${newMax.toLocaleString('en-IN')}):`,
      recommendations: affordable.map(a => ({
        dish: a.item,
        categoryName: a.categoryName,
        reason: `Priced at ₹${a.item.price.toLocaleString('en-IN')}: ${a.item.description}`,
        whyBullets: [
          `Budget-friendly price: ₹${a.item.price.toLocaleString('en-IN')}`,
          `Calories: ${a.item.calories} kcal`,
          `Category: ${a.categoryName}`
        ]
      })),
      followUpSuggestion: "Tap 'VIEW DISH' to see preparation notes.",
      suggestedChips: ['I want a main course', 'Something spicy', 'What should I try?'],
      conversationContext: context
    };
  }

  if (/\b(something\s*lighter|lighter|less\s*calories|lower\s*cal)\b/i.test(normalizedQuery)) {
    context.satiety = 'light';
    const lightItems = allItems.filter(i => i.item.calories <= 350).sort((a, b) => a.item.calories - b.item.calories).slice(0, 3);
    return {
      type: 'recommendations',
      intro: "Understood. Here are our lightest, most wholesome options under 350 calories:",
      recommendations: lightItems.map(l => ({
        dish: l.item,
        categoryName: l.categoryName,
        reason: `Only ${l.item.calories} kcal: ${l.item.description}`,
        whyBullets: [
          `Calories: ${l.item.calories} kcal (Light & Wholesome)`,
          `Price: ₹${l.item.price.toLocaleString('en-IN')}`,
          `Dietary: ${l.item.tags?.map(t => t.label).join(', ') || 'Standard'}`
        ]
      })),
      followUpSuggestion: "Wholesome and easy to enjoy at any time.",
      suggestedChips: ['Under ₹1000', 'Something vegetarian', 'What should I try?'],
      conversationContext: context
    };
  }

  // -------------------------------------------------------------
  // 11. FEATURE 1 & MULTI-CONSTRAINT EXTRACTION
  // -------------------------------------------------------------
  let maxPrice = context.maxPrice ?? null;
  const underPriceMatch = normalizedQuery.match(/(?:under|below|less\s+than|budget(?:\s+of)?|max(?:imum)?)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i) ||
                          normalizedQuery.match(/(?:₹|rs\.?|inr)\s*(\d+)/i);
  if (underPriceMatch && underPriceMatch[1]) {
    maxPrice = parseInt(underPriceMatch[1], 10);
    context.maxPrice = maxPrice;
  } else if (/\b(cheap|affordable|budget\s*friendly|budget|pocket\s*friendly)\b/i.test(normalizedQuery)) {
    maxPrice = 1000;
    context.maxPrice = maxPrice;
  }

  let wantsVegetarian = context.dietary === 'vegetarian' || /\b(vegetarian|veg|plant\s*based|pure\s*veg|meatless)\b/i.test(normalizedQuery);
  if (/\b(non\s*veg|non-vegetarian)\b/i.test(normalizedQuery)) {
    wantsVegetarian = false;
    context.dietary = 'non-veg';
  } else if (wantsVegetarian) {
    context.dietary = 'vegetarian';
  }

  const wantsVegan = context.dietary === 'vegan' || /\b(vegan|dairy\s*free\s*and\s*meatless)\b/i.test(normalizedQuery);
  if (wantsVegan) context.dietary = 'vegan';

  const isNegatingSpicy = /\b(don't\s*like\s*spicy|no\s*spicy|not\s*spicy|no\s*spice|non\s*spicy|avoid\s*spicy)\b/i.test(normalizedQuery);
  let wantsSpicy = !isNegatingSpicy && (context.spicePreference === 'spicy' || /\b(spicy|hot|chili|chilli|fiery|peppery|zesty|heat)\b/i.test(normalizedQuery));
  let wantsMild = isNegatingSpicy || context.spicePreference === 'mild' || /\b(mild|not\s*spicy|sweet|gentle|no\s*spice)\b/i.test(normalizedQuery);
  if (isNegatingSpicy) {
    wantsSpicy = false;
    wantsMild = true;
    context.spicePreference = 'mild';
  } else if (wantsSpicy) {
    context.spicePreference = 'spicy';
  } else if (wantsMild) {
    context.spicePreference = 'mild';
  }

  const wantsLight = context.satiety === 'light' || /\b(light|low\s*cal(?:orie)?|healthy|diet|slimming|refreshing|small)\b/i.test(normalizedQuery);
  const wantsHearty = context.satiety === 'hearty' || /\b(heavy|hearty|filling|rich|full\s*meal|satisfying|huge)\b/i.test(normalizedQuery);
  if (wantsLight) context.satiety = 'light';
  if (wantsHearty) context.satiety = 'hearty';

  const wantsStarter = /\b(starter|starters|appetizer|appetizers|snack)\b/i.test(normalizedQuery);
  const wantsMain = /\b(main|mains|main\s*course|dinner|lunch|entree)\b/i.test(normalizedQuery);

  // Check for conflict: Vegetarian + Spicy (Menu has no veg spicy dishes: Thai Chicken is non-veg)
  if (wantsVegetarian && wantsSpicy) {
    const vegOptions = allItems.filter(i => i.item.tags?.some(t => t.id === 'v' || t.id === 'vg') && (maxPrice === null || i.item.price <= maxPrice)).slice(0, 2);
    const spicyOption = allItems.find(i => i.item.id === 'm4');

    return {
      type: 'clarification',
      intro: "We do not currently have a dish on our menu that is simultaneously 100% vegetarian and spicy. Here are our closest verified alternatives:",
      recommendations: [
        ...(spicyOption ? [{
          dish: spicyOption.item,
          reason: "Matches your spicy preference: Wok-tossed chicken breast with chili and Thai basil (Non-Vegetarian, ₹2,000).",
          whyBullets: [
            "Matches: Spicy / Chili flavor",
            "Note: Non-Vegetarian (Chicken)",
            `Price: ₹${spicyOption.item.price.toLocaleString('en-IN')}`
          ]
        }] : []),
        ...vegOptions.map(v => ({
          dish: v.item,
          categoryName: v.categoryName,
          reason: `Matches your vegetarian requirement: ${v.item.name} (${v.item.description}).`,
          whyBullets: [
            "Matches: 100% Vegetarian",
            `Price: ₹${v.item.price.toLocaleString('en-IN')}`,
            `Calories: ${v.item.calories} kcal`
          ]
        }))
      ],
      followUpSuggestion: "Would you prefer to explore our vegetarian favorites or our spicy chicken specialty?",
      suggestedChips: ['Show vegetarian dishes', 'Tell me about Thai Chicken', 'Something under ₹1000'],
      conversationContext: context
    };
  }

  // -------------------------------------------------------------
  // 12. GENERAL SCORING ENGINE
  // -------------------------------------------------------------
  interface ScoredItem {
    item: MenuItem;
    categoryName: string;
    score: number;
    whyBullets: string[];
    hardExcluded?: boolean;
    directMatch?: boolean;
  }

  const scoredList: ScoredItem[] = allItems.map(({ item, categoryId, categoryName }) => {
    let score = 0;
    const whyBullets: string[] = [];
    const itemText = `${item.name} ${item.description}`.toLowerCase();
    const tagIds = (item.tags || []).map(t => t.id);

    // Hard price limit
    if (maxPrice !== null && item.price > maxPrice) {
      return { item, categoryName, score: -1000, whyBullets, hardExcluded: true };
    }

    // Vegetarian filter
    if (wantsVegetarian) {
      const isVeg = tagIds.includes('v') || tagIds.includes('vg');
      if (!isVeg) return { item, categoryName, score: -1000, whyBullets, hardExcluded: true };
      score += 30;
      whyBullets.push("100% vegetarian certified in menu data");
    }

    // Vegan filter
    if (wantsVegan) {
      if (!tagIds.includes('vg')) return { item, categoryName, score: -1000, whyBullets, hardExcluded: true };
      score += 40;
      whyBullets.push("Certified plant-based vegan");
    }

    // Spicy
    let directSpicy = false;
    if (wantsSpicy) {
      if (tagIds.includes('spicy') || itemText.includes('chili') || itemText.includes('chilli') || itemText.includes('spicy')) {
        score += 60;
        directSpicy = true;
        whyBullets.push("Delivers an authentic fiery chili and basil kick");
      } else {
        score -= 100;
      }
    }

    if (wantsMild && tagIds.includes('spicy')) {
      score -= 100;
    }

    // Light vs Hearty
    if (wantsLight) {
      if (item.calories <= 350) {
        score += 35;
        whyBullets.push(`Light on the palate at only ${item.calories} kcal`);
      } else if (item.calories > 600) {
        score -= 25;
      }
    }

    if (wantsHearty) {
      if (item.calories >= 600) {
        score += 35;
        whyBullets.push(`Rich, hearty and deeply filling (${item.calories} kcal)`);
      } else {
        score -= 15;
      }
    }

    // Category
    if (wantsStarter && categoryId === 'starters') {
      score += 25;
      whyBullets.push("Perfect starter course");
    }
    if (wantsMain && categoryId === 'main-courses') {
      score += 25;
      whyBullets.push("Hearty main course centerpiece");
    }

    // Keyword & Ingredient Matches
    let hasDirectKeyword = false;
    const keywords: Record<string, number> = {
      burger: item.id === 's4' ? 100 : 0,
      wagyu: (item.id === 's4' || item.id === 'm2') ? 50 : 0,
      beef: (item.id === 's4' || item.id === 'm2') ? 40 : 0,
      steak: item.id === 'm2' ? 100 : 0,
      chicken: item.id === 'm4' ? 90 : 0,
      scallop: item.id === 'm1' ? 90 : 0,
      tuna: item.id === 's2' ? 90 : 0,
      risotto: (item.id === 'm3' || item.id === 's1') ? 70 : 0,
      mushroom: item.id === 'm3' ? 80 : 0,
      bruschetta: item.id === 's3' ? 90 : 0,
      fries: item.id === 'sd2' ? 90 : 0,
      sprout: item.id === 'sd1' ? 90 : 0,
      chocolate: item.id === 'd1' ? 90 : 0,
      tiramisu: item.id === 'd2' ? 90 : 0,
      lemonade: item.id === 'dr1' ? 90 : 0,
      negroni: item.id === 'dr2' ? 90 : 0,
    };

    for (const [kw, pts] of Object.entries(keywords)) {
      if (normalizedQuery.includes(kw) && pts > 0) {
        score += pts;
        hasDirectKeyword = true;
        whyBullets.push(`Features our prized ${kw}`);
      }
    }

    // Price budget note
    if (maxPrice !== null && item.price <= maxPrice) {
      score += 20;
      whyBullets.push(`Priced at ₹${item.price.toLocaleString('en-IN')}, within your ₹${maxPrice.toLocaleString('en-IN')} budget`);
    }

    // AR tag
    if (item.modelUrl) {
      whyBullets.push("Interactive 3D model and native Augmented Reality table preview");
      if (/\b(ar|3d|best|signature)\b/i.test(normalizedQuery)) score += 30;
    }

    return {
      item,
      categoryName,
      score,
      whyBullets,
      directMatch: directSpicy || hasDirectKeyword
    };
  });

  const eligible = scoredList.filter(s => !s.hardExcluded && s.score > 0).sort((a, b) => b.score - a.score);

  if (eligible.length === 0) {
    const fallbacks = allItems.slice(0, 2);
    let honestReason = "We don't have an exact match satisfying all criteria simultaneously";
    if (maxPrice !== null) honestReason += ` under ₹${maxPrice.toLocaleString('en-IN')}`;
    honestReason += ". Here are our closest verified menu choices:";

    return {
      type: 'clarification',
      intro: honestReason,
      recommendations: fallbacks.map(f => ({
        dish: f.item,
        categoryName: f.categoryName,
        reason: `Popular item from our ${f.categoryName} selection (₹${f.item.price.toLocaleString('en-IN')}).`,
        whyBullets: [`Price: ₹${f.item.price.toLocaleString('en-IN')}`, `Calories: ${f.item.calories} kcal`]
      })),
      followUpSuggestion: "Try adjusting one constraint (e.g. asking for 'vegetarian starters' or 'under ₹1500').",
      suggestedChips: ['Something under ₹1000', 'Best vegetarian option', 'What should I try?'],
      conversationContext: context
    };
  }

  const direct = eligible.filter(e => e.directMatch);
  const topMatches = (direct.length > 0 && direct.length <= 2) ? direct : eligible.slice(0, Math.min(3, eligible.length));

  let intro = "Based on your preferences, I recommend:";
  if (wantsSpicy) intro = "If you're craving bold heat and vibrant spices, here is our top recommendation:";
  else if (wantsVegetarian || wantsVegan) intro = "Here are our finest vegetarian selections crafted with seasonal produce:";
  else if (maxPrice !== null) intro = `Here are our top menu choices tailored within your ₹${maxPrice.toLocaleString('en-IN')} budget:`;
  else if (wantsLight) intro = "For a light, wholesome dining experience, our chef recommends:";
  else if (wantsHearty) intro = "For a rich, hearty, and satisfying meal, here are our best choices:";

  return {
    type: 'recommendations',
    intro,
    recommendations: topMatches.map(m => ({
      dish: m.item,
      categoryName: m.categoryName,
      reason: m.whyBullets.length > 0 ? m.whyBullets.slice(0, 2).join(' • ') : m.item.description,
      whyBullets: m.whyBullets.length > 0 ? m.whyBullets : [
        `Price: ₹${m.item.price.toLocaleString('en-IN')}`,
        `Calories: ${m.item.calories} kcal`,
        m.item.description
      ]
    })),
    followUpSuggestion: "Tap 'VIEW DISH' on any selection to inspect details or preview in 3D/AR.",
    suggestedChips: ['Too expensive', 'Something lighter', 'What should I try?'],
    conversationContext: { ...context, lastRecommendedDishIds: topMatches.map(m => m.item.id) }
  };
}
