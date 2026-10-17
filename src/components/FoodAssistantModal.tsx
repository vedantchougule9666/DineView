import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Send, 
  Sparkles, 
  ArrowRight, 
  RotateCcw, 
  AlertTriangle, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Scale, 
  UtensilsCrossed,
  Calendar,
  MapPin,
  CreditCard,
  Repeat,
  Shuffle
} from 'lucide-react';
import { useMenu } from '../context/MenuContext';
import { useLanguage } from '../context/LanguageContext';
import { getMenuItemName, MENU_DATA } from '../data/menu';
import { formatCurrency } from '../utils/currency';
import { 
  getFoodRecommendations, 
  AssistantResponse, 
  RecommendationResult,
  ConversationContext,
  ComparisonResult,
  MealPlanResult,
  LastOrderSummary,
  SameOrDifferentSummary,
} from '../services/recommendationEngine';
import { saveMenuScrollPosition } from '../utils/scrollRestoration';
import { 
  getCustomerProfile, 
  maskPhone, 
  CustomerProfile, 
  fetchLastCustomerOrder 
} from '../services/customerService';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text?: string;
  response?: AssistantResponse;
  timestamp: Date;
}

const DEFAULT_SUGGESTED_PROMPTS = [
  'Recommend something spicy',
  'Best vegetarian option',
  'Something under ₹1000',
  'What should I try?',
  'Build me a meal under ₹3000',
  'What can I view in AR?'
];

export const FoodAssistantModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [expandedWhyIds, setExpandedWhyIds] = useState<Record<string, boolean>>({});
  const contextRef = useRef<ConversationContext>({});
  
  const { categories } = useMenu();
  const { lang, t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initial greeting
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      response: {
        type: 'recommendations',
        intro: "Welcome to DineView. I am your Gemini-powered culinary concierge. I can recommend dishes based on flavors, dietary needs, allergens, or budget, compare menu items, and construct full meals.",
        recommendations: [],
        followUpSuggestion: "You can ask for spicy dishes, vegetarian options, meal combos, or tap a suggestion below:",
        suggestedChips: DEFAULT_SUGGESTED_PROMPTS,
        conversationContext: {}
      },
      timestamp: new Date()
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    if (isOpen) {
      try {
        const phone = localStorage.getItem('dineview_phone');
        if (phone) {
          getCustomerProfile(phone).then((prof) => {
            if (prof) {
              setCustomerProfile(prof);
              // If returning guest, personalize the welcome greeting if still on default
              if (prof.recentDishes && prof.recentDishes.length > 0) {
                const topDish = prof.recentDishes[0]?.name;
                setMessages((prev) => {
                  if (prev.length === 1 && prev[0].id === 'welcome') {
                    return [
                      {
                        id: 'welcome',
                        sender: 'assistant',
                        response: {
                          type: 'recommendations',
                          intro: `Welcome back to DineView (${maskPhone(prof.phone)})! On your previous order, you enjoyed the ${topDish}. Would you like to reorder, find pairing suggestions, or explore our chef's newest creations?`,
                          recommendations: [],
                          followUpSuggestion: "Tap a quick prompt or ask any question:",
                          suggestedChips: [
                            'What did I order last time?',
                            'Same or different?',
                            `Recommend pairing for my ${topDish}`,
                            'Recommend something spicy',
                            'Build me a meal under ₹3000',
                          ],
                          conversationContext: {},
                        },
                        timestamp: new Date(),
                      },
                    ];
                  }
                  return prev;
                });
              }
            }
          });
        }
      } catch {}
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, isTyping]);

  const handleSend = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    const userMsgId = 'user-' + Date.now();
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        sender: 'user',
        text: trimmed,
        timestamp: new Date()
      }
    ];

    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      // 1. "LAST TIME" QUERY:
      // Fetch last order by orderedAt desc from customers/{phone}.recentDishes + orders where phone==,
      // render items + date + table + total + View buttons.
      const isLastOrderQuery = /\b(last\s*time|last\s*order|previous\s*order|past\s*order|what\s*(?:did\s*i|have\s*i)\s*order|what\s*was\s*my\s*last|order(?:ed)?\s*last\s*time)\b/i.test(trimmed);

      if (isLastOrderQuery) {
        const phone = localStorage.getItem('dineview_phone') || customerProfile?.phone || '';
        if (!phone) {
          const assistantResponse: AssistantResponse = {
            type: 'clarification',
            intro: "To view your previous order history, please place an order with your mobile number at checkout. Once recorded, I'll remember your exact dishes, table, and dining preferences right here!",
            recommendations: [],
            followUpSuggestion: "Would you like me to recommend our most popular chef selections today?",
            suggestedChips: DEFAULT_SUGGESTED_PROMPTS,
            conversationContext: contextRef.current,
          };
          setMessages((prev) => [
            ...prev,
            {
              id: 'assistant-' + Date.now(),
              sender: 'assistant',
              response: assistantResponse,
              timestamp: new Date()
            }
          ]);
          setIsTyping(false);
          return;
        }

        const lastOrder = await fetchLastCustomerOrder(phone);
        if (lastOrder && lastOrder.items && lastOrder.items.length > 0) {
          contextRef.current = {
            ...contextRef.current,
            lastMentionedDishId: lastOrder.items[0].id,
            lastRecommendedDishIds: lastOrder.items.map(i => i.id)
          };

          const allItems = categories.flatMap(c => c.items);
          const recs: RecommendationResult[] = lastOrder.items.map((item): RecommendationResult | null => {
            const dish = allItems.find(d => d.id === item.id) || MENU_DATA.flatMap(c => c.items).find(d => d.id === item.id);
            if (!dish) return null;
            return {
              dish,
              reason: `Quantity: ${item.quantity} • Total: ${formatCurrency(item.price * item.quantity)}`,
              whyBullets: [
                `Ordered on ${new Date(lastOrder.date).toLocaleDateString()}`,
                `Table: ${lastOrder.table}`,
                `Calories: ${dish.calories} kcal`,
                dish.modelUrl ? '3D & AR table preview available' : 'Prepared fresh to order'
              ]
            };
          }).filter((r): r is RecommendationResult => r !== null);

          const assistantResponse: AssistantResponse = {
            type: 'last_order',
            intro: `Here is your last verified order at DineView (${maskPhone(phone)}):`,
            lastOrder: {
              orderId: lastOrder.orderId,
              date: lastOrder.date,
              table: lastOrder.table,
              total: lastOrder.total,
              items: lastOrder.items,
            },
            recommendations: recs,
            followUpSuggestion: "Would you like to reorder the same favorites or explore something different?",
            suggestedChips: [
              'Same or different?',
              'Recommend pairing for this',
              'Something lighter',
              'What should I try?'
            ],
            conversationContext: contextRef.current
          };

          setMessages((prev) => [
            ...prev,
            {
              id: 'assistant-' + Date.now(),
              sender: 'assistant',
              response: assistantResponse,
              timestamp: new Date()
            }
          ]);
          setIsTyping(false);
          return;
        } else {
          const assistantResponse: AssistantResponse = {
            type: 'clarification',
            intro: `We don't have a recorded order history for ${maskPhone(phone)} yet. Once you place an order, your dining history and favorite dishes will appear here!`,
            recommendations: [],
            followUpSuggestion: "Would you like recommendations based on your taste preferences?",
            suggestedChips: DEFAULT_SUGGESTED_PROMPTS,
            conversationContext: contextRef.current
          };

          setMessages((prev) => [
            ...prev,
            {
              id: 'assistant-' + Date.now(),
              sender: 'assistant',
              response: assistantResponse,
              timestamp: new Date()
            }
          ]);
          setIsTyping(false);
          return;
        }
      }

      // 2. "SAME OR DIFFERENT" QUERY:
      // Render Same (fav reorder) + Different (1 same-category different dish + 1 dessert/drink pairing with price/kcal diff + Because you had X). Ground only in MENU_DATA.
      const isSameOrDifferentQuery = /\b(same\s*or\s*different|same\s*or\s*new|same\s*or\s*something|same\s*vs\s*different|reorder\s*or\s*try)\b/i.test(trimmed);

      if (isSameOrDifferentQuery) {
        const allFlatItems = categories.flatMap(c => c.items);
        const prevId = contextRef.current.lastMentionedDishId 
          || customerProfile?.favoriteDishIds?.[0] 
          || customerProfile?.recentDishes?.[0]?.id 
          || 's4';
        
        const dishX = allFlatItems.find(i => i.id === prevId) 
          || allFlatItems.find(i => i.id === 's4') 
          || MENU_DATA[0].items[0];

        // Category of dishX
        const catX = categories.find(c => c.items.some(i => i.id === dishX.id)) || categories[0];

        // 1 same-category different dish
        const sameCatCandidates = catX.items.filter(i => i.id !== dishX.id);
        const sameCategoryDish = sameCatCandidates[0] || allFlatItems.find(i => i.id !== dishX.id) || dishX;
        const priceDiff = sameCategoryDish.price - dishX.price;
        const calorieDiff = sameCategoryDish.calories - dishX.calories;

        // 1 dessert / drink pairing
        const dessertCat = categories.find(c => c.id === 'desserts');
        const drinksCat = categories.find(c => c.id === 'drinks');
        const isDessertX = catX.id === 'desserts';
        const pairingPool = isDessertX ? (drinksCat?.items || []) : (dessertCat?.items || drinksCat?.items || []);
        const pairingDish = pairingPool.find(i => i.id !== dishX.id && i.id !== sameCategoryDish.id)
          || allFlatItems.find(i => i.id !== dishX.id && i.id !== sameCategoryDish.id)
          || allFlatItems[0];
        const pairingCat = categories.find(c => c.items.some(i => i.id === pairingDish.id))?.name || 'Pairing';
        const pairingPriceDiff = pairingDish.price - dishX.price;
        const pairingCalorieDiff = pairingDish.calories - dishX.calories;

        contextRef.current = {
          ...contextRef.current,
          lastMentionedDishId: sameCategoryDish.id,
          lastRecommendedDishIds: [dishX.id, sameCategoryDish.id, pairingDish.id]
        };

        const assistantResponse: AssistantResponse = {
          type: 'same_or_different',
          intro: `Deciding between familiar comfort and new culinary discoveries? Here is your curated choice: Reorder the same favorite dish you enjoyed, or explore a distinct creation in the same course alongside a complementary pairing:`,
          sameOrDifferent: {
            previousDish: dishX,
            same: {
              dish: dishX,
              reason: `Reorder your favorite ${dishX.name} (${formatCurrency(dishX.price)}, ${dishX.calories} kcal). Perfectly prepared to order just as you enjoyed last time.`
            },
            different: {
              sameCategoryDish,
              categoryName: catX.name,
              priceDiff,
              calorieDiff,
              reason: `Because you had ${dishX.name}, experience ${sameCategoryDish.name} (${formatCurrency(sameCategoryDish.price)}, ${sameCategoryDish.calories} kcal) for a fresh take in ${catX.name}.`,
              pairingDish,
              pairingCategoryName: pairingCat,
              pairingPriceDiff,
              pairingCalorieDiff,
              pairingReason: `Because you had ${dishX.name}, pair with ${pairingDish.name} (${formatCurrency(pairingDish.price)}, ${pairingDish.calories} kcal) for a harmonious multi-course finish.`
            }
          },
          recommendations: [
            {
              dish: dishX,
              reason: `Same: Reorder favorite ${dishX.name}`,
              whyBullets: [`Price: ${formatCurrency(dishX.price)}`, `${dishX.calories} kcal`, `Previous favorite`]
            },
            {
              dish: sameCategoryDish,
              reason: `Different (${catX.name}): ${sameCategoryDish.name} (${priceDiff >= 0 ? `+${formatCurrency(priceDiff)}` : `-${formatCurrency(Math.abs(priceDiff))}`}, ${calorieDiff >= 0 ? `+${calorieDiff}` : `${calorieDiff}`} kcal)`,
              whyBullets: [`Course: ${catX.name}`, `Price: ${formatCurrency(sameCategoryDish.price)}`, `Because you had ${dishX.name}`]
            },
            {
              dish: pairingDish,
              reason: `Pairing (${pairingCat}): ${pairingDish.name}`,
              whyBullets: [`Course: ${pairingCat}`, `Price: ${formatCurrency(pairingDish.price)}`, `Because you had ${dishX.name}`]
            }
          ],
          followUpSuggestion: "Tap 'VIEW DISH' on any card to inspect ingredients or preview in 3D/AR.",
          suggestedChips: [
            `Reorder ${dishX.name}`,
            `View ${sameCategoryDish.name}`,
            `View ${pairingDish.name}`,
            'Something under ₹1000'
          ],
          conversationContext: contextRef.current
        };

        setMessages((prev) => [
          ...prev,
          {
            id: 'assistant-' + Date.now(),
            sender: 'assistant',
            response: assistantResponse,
            timestamp: new Date()
          }
        ]);
        setIsTyping(false);
        return;
      }

      // Build conversation history for context
      const history = newMessages
        .filter(m => (m.sender === 'user' && m.text) || (m.sender === 'assistant' && m.response?.intro))
        .slice(-6)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          content: m.sender === 'user' ? m.text! : m.response!.intro
        }));

      const customerCtx = customerProfile
        ? {
            phone: maskPhone(customerProfile.phone),
            totalOrders: customerProfile.totalOrders,
            recentDishes: customerProfile.recentDishes,
            favoriteDishIds: customerProfile.favoriteDishIds,
          }
        : undefined;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history,
          lang,
          customerContext: customerCtx,
        })
      });

      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const allItems = categories.flatMap(c => c.items);

      const recommendations: RecommendationResult[] = Array.isArray(data.recommendedDishIds)
        ? data.recommendedDishIds
            .map((dishId: string) => {
              const dish = allItems.find(d => d.id === dishId);
              if (!dish) return null;
              const reason = data.dishReasons?.[dishId] || dish.description;
              const whyBullets = [
                `Price: ${formatCurrency(dish.price)}`,
                `Calories: ${dish.calories} kcal`,
                dish.modelUrl ? 'Interactive 3D and native AR table placement' : 'Prepared fresh to order by our kitchen'
              ];
              return {
                dish,
                reason,
                whyBullets
              };
            })
            .filter((item): item is RecommendationResult => item !== null)
        : [];

      // Update conversation context
      if (recommendations.length > 0) {
        contextRef.current = {
          ...contextRef.current,
          lastMentionedDishId: recommendations[0]?.dish?.id || contextRef.current.lastMentionedDishId,
          lastRecommendedDishIds: recommendations.map(r => r.dish.id)
        };
      }

      const assistantResponse: AssistantResponse = {
        type: 'recommendations',
        intro: data.intro || "Here are our chef's recommendations:",
        recommendations,
        allergyNotice: data.allergyNotice || undefined,
        followUpSuggestion: data.followUpSuggestion,
        suggestedChips: Array.isArray(data.suggestedChips) && data.suggestedChips.length > 0 
          ? data.suggestedChips 
          : DEFAULT_SUGGESTED_PROMPTS,
        conversationContext: contextRef.current
      };

      setMessages((prev) => [
        ...prev,
        {
          id: 'assistant-' + Date.now(),
          sender: 'assistant',
          response: assistantResponse,
          timestamp: new Date()
        }
      ]);
    } catch (err) {
      console.warn('Gemini AI endpoint unavailable or error, falling back to local culinary engine:', err);
      // Graceful local engine fallback
      const fallbackResult = getFoodRecommendations(trimmed, categories, lang, contextRef.current);
      contextRef.current = fallbackResult.conversationContext;

      setMessages((prev) => [
        ...prev,
        {
          id: 'assistant-' + Date.now(),
          sender: 'assistant',
          response: fallbackResult,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    handleSend(prompt);
  };

  const handleViewDish = (dishId: string) => {
    if (window.location.pathname === '/' || window.location.pathname === '/menu') {
      saveMenuScrollPosition();
    }
    setIsOpen(false);
    navigate(`/item/${dishId}`);
  };

  const toggleWhy = (cardId: string) => {
    setExpandedWhyIds(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const handleResetChat = () => {
    contextRef.current = {};
    setExpandedWhyIds({});
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        sender: 'assistant',
        response: {
          type: 'recommendations',
          intro: "Conversation refreshed. What flavors, dietary requirements, or budget would you like to explore?",
          recommendations: [],
          followUpSuggestion: "Tap any suggestion below or type your request in natural language.",
          suggestedChips: DEFAULT_SUGGESTED_PROMPTS,
          conversationContext: {}
        },
        timestamp: new Date()
      }
    ]);
  };

  // Get active suggested chips from the last assistant message
  const lastAssistantMessage = [...messages].reverse().find(m => m.sender === 'assistant');
  const activeSuggestedChips = lastAssistantMessage?.response?.suggestedChips || DEFAULT_SUGGESTED_PROMPTS;

  return (
    <>
      {/* Floating Concierge Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-3 px-4 sm:px-5 py-3 bg-bg-primary text-text-primary rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_36px_rgb(0,0,0,0.18)] border-2 border-accent/80 hover:border-accent hover:bg-white transition-all duration-300 hover:scale-105 active:scale-95 group"
          aria-label="Open Food Assistant"
        >
          <div className="relative flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-accent absolute -top-0.5 -end-0.5 animate-ping opacity-75" />
            <span className="w-2 h-2 rounded-full bg-accent absolute -top-0.5 -end-0.5" />
            <Sparkles className="w-4 h-4 text-accent transition-transform duration-300 group-hover:rotate-12" />
          </div>
          <div className="flex flex-col text-start">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-text-primary leading-tight">
              {t.ai_assistant || 'Food Assistant'}
            </span>
            <span className="hidden sm:inline-block text-[9px] text-text-muted tracking-wider font-serif italic">
              "Let us help you choose"
            </span>
          </div>
        </button>
      )}

      {/* Slide-over / Modal Chat Window */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          {/* Concierge Container */}
          <div 
            className="relative w-full sm:w-[480px] h-full sm:h-[94vh] sm:my-auto sm:me-6 bg-bg-primary sm:border border-border shadow-2xl flex flex-col sm:rounded-lg overflow-hidden z-10 animate-in slide-in-from-bottom-4 sm:slide-in-from-right-4 duration-300"
            role="dialog"
            aria-label="Food Assistant"
          >
            {/* Header */}
            <div className="px-6 py-5 bg-white border-b border-border flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-accent block">
                    DineView Concierge
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/25">
                    <Sparkles className="w-2.5 h-2.5 animate-pulse" />
                    Gemini AI
                  </span>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl text-text-primary font-normal leading-tight mt-0.5">
                  Food Assistant
                </h3>
                <p className="font-serif text-xs text-text-secondary italic mt-0.5">
                  "Let us help you choose."
                </p>
                {customerProfile && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent/10 border border-accent/25 text-[10px] font-bold text-accent">
                    <UtensilsCrossed className="w-3 h-3" />
                    <span>Welcome back ({maskPhone(customerProfile.phone)}) • {customerProfile.totalOrders} {customerProfile.totalOrders === 1 ? 'visit' : 'visits'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleResetChat}
                  className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-primary rounded-full transition-colors"
                  title="Reset conversation"
                  aria-label="Reset conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-primary rounded-full transition-colors"
                  aria-label="Close assistant"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
              {messages.map((msg, msgIdx) => (
                <div key={msg.id} className="space-y-3">
                  {msg.sender === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] bg-text-primary text-bg-primary px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs sm:text-sm leading-relaxed shadow-xs">
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3.5">
                      {/* Intro Text */}
                      {msg.response?.intro && (
                        <div className="max-w-[98%] bg-white border border-border px-4 py-3 rounded-2xl rounded-tl-xs shadow-2xs text-xs sm:text-sm text-text-primary leading-relaxed font-sans">
                          {msg.response.intro}
                        </div>
                      )}

                      {/* FEATURE 4 & 5: Allergy Safety Banner */}
                      {msg.response?.allergyNotice && (
                        <div className="flex items-start gap-2.5 p-3 rounded-sm bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <p className="font-sans leading-relaxed">
                            {msg.response.allergyNotice}
                          </p>
                        </div>
                      )}

                      {/* FEATURE 7: Side-by-Side Comparison Card */}
                      {msg.response?.comparison && (
                        <div className="bg-white border border-border rounded-sm p-4 shadow-sm space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b border-border">
                            <Scale className="w-4 h-4 text-accent" />
                            <h4 className="font-serif text-sm font-bold text-text-primary uppercase tracking-wider">
                              Direct Comparison
                            </h4>
                          </div>

                          <div className="divide-y divide-border/60 text-xs">
                            {msg.response.comparison.differences.map((diff, dIdx) => (
                              <div key={dIdx} className="py-2.5 flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                  {diff.feature}
                                </span>
                                <div className="grid grid-cols-2 gap-2 text-text-primary font-medium">
                                  <div className="p-2 bg-bg-primary rounded-xs border border-border/50">
                                    <span className="block text-[10px] text-text-secondary">{msg.response?.comparison?.dishA.name}</span>
                                    <span className="font-serif font-bold text-xs">{diff.dishAValue}</span>
                                  </div>
                                  <div className="p-2 bg-bg-primary rounded-xs border border-border/50">
                                    <span className="block text-[10px] text-text-secondary">{msg.response?.comparison?.dishB.name}</span>
                                    <span className="font-serif font-bold text-xs">{diff.dishBValue}</span>
                                  </div>
                                </div>
                                {diff.verdict && (
                                  <p className="text-[11px] text-accent italic mt-0.5">
                                    • {diff.verdict}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* FEATURE 8 & 9: Meal Plan Course Breakdown */}
                      {msg.response?.mealPlan && (
                        <div className="bg-white border border-border rounded-sm p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-border">
                            <div className="flex items-center gap-2">
                              <UtensilsCrossed className="w-4 h-4 text-accent" />
                              <h4 className="font-serif text-sm font-bold text-text-primary uppercase tracking-wider">
                                Curated Meal Combination
                              </h4>
                            </div>
                            <span className="font-serif text-sm font-bold text-accent">
                              {formatCurrency(msg.response.mealPlan.totalPrice)}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {msg.response.mealPlan.courses.map((course, cIdx) => (
                              <div key={cIdx} className="flex items-center justify-between p-2.5 bg-bg-primary rounded-xs border border-border/60">
                                <div>
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted block">
                                    {course.courseName}
                                  </span>
                                  <span className="font-serif text-xs font-bold text-text-primary">
                                    {course.dish.name}
                                  </span>
                                </div>
                                <div className="text-end">
                                  <span className="font-serif text-xs font-bold text-text-primary block">
                                    {formatCurrency(course.dish.price)}
                                  </span>
                                  <span className="text-[10px] text-text-muted">
                                    {course.dish.calories} kcal
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="p-2.5 bg-accent/10 border border-accent/30 rounded-xs text-xs font-medium text-text-primary flex justify-between items-center">
                            <span>{msg.response.mealPlan.budgetNotes}</span>
                            <span className="text-text-muted text-[11px]">{msg.response.mealPlan.totalCalories} total kcal</span>
                          </div>
                        </div>
                      )}

                      {/* FEATURE: Previous Order Card (Last Time Query) */}
                      {msg.response?.lastOrder && (
                        <div className="bg-white border border-border rounded-sm p-4 shadow-sm space-y-3.5">
                          {/* Header */}
                          <div className="flex items-center justify-between pb-2.5 border-b border-border">
                            <div className="flex items-center gap-2">
                              <UtensilsCrossed className="w-4 h-4 text-accent" />
                              <h4 className="font-serif text-sm font-bold text-text-primary uppercase tracking-wider">
                                Previous Dining Record
                              </h4>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/25">
                              {msg.response.lastOrder.orderId ? `Order #${msg.response.lastOrder.orderId}` : 'Last Order'}
                            </span>
                          </div>

                          {/* Metadata: Date, Table, Total */}
                          <div className="grid grid-cols-3 gap-2 p-2.5 bg-bg-primary rounded-xs border border-border/60 text-xs">
                            <div className="flex flex-col">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-text-muted flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5 text-accent" /> Date
                              </span>
                              <span className="font-medium text-text-primary text-[11px] truncate mt-0.5">
                                {new Date(msg.response.lastOrder.date).toLocaleDateString('en-IN', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            <div className="flex flex-col">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-text-muted flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5 text-accent" /> Table
                              </span>
                              <span className="font-medium text-text-primary text-[11px] truncate mt-0.5">
                                {msg.response.lastOrder.table}
                              </span>
                            </div>

                            <div className="flex flex-col text-end">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-text-muted flex items-center justify-end gap-1">
                                <CreditCard className="w-2.5 h-2.5 text-accent" /> Total
                              </span>
                              <span className="font-serif font-bold text-accent text-xs mt-0.5">
                                {formatCurrency(msg.response.lastOrder.total)}
                              </span>
                            </div>
                          </div>

                          {/* Ordered Items List with View Buttons */}
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-text-muted block">
                              Ordered Items ({msg.response.lastOrder.items.length})
                            </span>
                            <div className="divide-y divide-border/60">
                              {msg.response.lastOrder.items.map((item, idx) => (
                                <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {item.image && (
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-11 h-11 rounded-xs object-cover shrink-0 border border-border/70"
                                      />
                                    )}
                                    <div className="min-w-0">
                                      <span className="font-serif text-xs font-bold text-text-primary block truncate">
                                        {item.name}
                                      </span>
                                      <span className="text-[10px] text-text-muted block">
                                        Qty: {item.quantity} {item.price ? `• ${formatCurrency(item.price)}` : ''} {item.calories ? `• ${item.calories} kcal` : ''}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleViewDish(item.id)}
                                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-border hover:border-accent hover:bg-accent hover:text-white text-text-primary text-[9px] font-bold uppercase tracking-wider transition-all"
                                  >
                                    <span>View</span>
                                    <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* FEATURE: Same or Different Card */}
                      {msg.response?.sameOrDifferent && (
                        <div className="bg-white border border-border rounded-sm p-4 shadow-sm space-y-4">
                          {/* 1. THE SAME (Favorite Reorder) */}
                          <div className="space-y-2 pb-3.5 border-b border-border">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Repeat className="w-3.5 h-3.5 text-accent" />
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-accent">
                                  Same • Favorite Reorder
                                </h4>
                              </div>
                              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                                Proven Classic
                              </span>
                            </div>

                            <div className="p-3 bg-bg-primary rounded-xs border border-border/70 flex gap-3 items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                {msg.response.sameOrDifferent.same.dish.image && (
                                  <img
                                    src={msg.response.sameOrDifferent.same.dish.image}
                                    alt={msg.response.sameOrDifferent.same.dish.name}
                                    className="w-12 h-12 rounded-xs object-cover shrink-0 border border-border/80"
                                  />
                                )}
                                <div className="min-w-0">
                                  <h5 className="font-serif text-xs sm:text-sm font-bold text-text-primary truncate">
                                    {msg.response.sameOrDifferent.same.dish.name}
                                  </h5>
                                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-secondary">
                                    <span className="font-semibold text-text-primary">
                                      {formatCurrency(msg.response.sameOrDifferent.same.dish.price)}
                                    </span>
                                    <span>•</span>
                                    <span>{msg.response.sameOrDifferent.same.dish.calories} kcal</span>
                                  </div>
                                  <p className="text-[10px] text-text-muted italic mt-0.5 line-clamp-1">
                                    "{msg.response.sameOrDifferent.same.reason}"
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleViewDish(msg.response!.sameOrDifferent!.same.dish.id)}
                                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-border hover:border-text-primary hover:bg-text-primary hover:text-white text-text-primary text-[9px] font-bold uppercase tracking-wider transition-all"
                              >
                                <span>View</span>
                                <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                              </button>
                            </div>
                          </div>

                          {/* 2. SOMETHING DIFFERENT */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Shuffle className="w-3.5 h-3.5 text-accent" />
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-accent">
                                  Something Different
                                </h4>
                              </div>
                              <span className="text-[9px] font-medium text-text-muted italic">
                                Because you had {msg.response.sameOrDifferent.previousDish.name}
                              </span>
                            </div>

                            {/* 1 Same-Category Different Dish */}
                            <div className="p-3 bg-bg-primary rounded-xs border border-border/70 space-y-2">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-bold uppercase tracking-wider text-text-muted">
                                  1. Alternative in {msg.response.sameOrDifferent.different.categoryName}
                                </span>
                                <div className="flex items-center gap-1.5 font-sans font-semibold">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                    msg.response.sameOrDifferent.different.priceDiff > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {msg.response.sameOrDifferent.different.priceDiff === 0
                                      ? 'Same price'
                                      : msg.response.sameOrDifferent.different.priceDiff > 0
                                      ? `+${formatCurrency(msg.response.sameOrDifferent.different.priceDiff)}`
                                      : `-${formatCurrency(Math.abs(msg.response.sameOrDifferent.different.priceDiff))}`}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                    msg.response.sameOrDifferent.different.calorieDiff > 0 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {msg.response.sameOrDifferent.different.calorieDiff === 0
                                      ? 'Same kcal'
                                      : msg.response.sameOrDifferent.different.calorieDiff > 0
                                      ? `+${msg.response.sameOrDifferent.different.calorieDiff} kcal`
                                      : `${msg.response.sameOrDifferent.different.calorieDiff} kcal`}
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-3 items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                  {msg.response.sameOrDifferent.different.sameCategoryDish.image && (
                                    <img
                                      src={msg.response.sameOrDifferent.different.sameCategoryDish.image}
                                      alt={msg.response.sameOrDifferent.different.sameCategoryDish.name}
                                      className="w-11 h-11 rounded-xs object-cover shrink-0 border border-border/80"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <h5 className="font-serif text-xs sm:text-sm font-bold text-text-primary truncate">
                                      {msg.response.sameOrDifferent.different.sameCategoryDish.name}
                                    </h5>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-secondary">
                                      <span className="font-semibold text-text-primary">
                                        {formatCurrency(msg.response.sameOrDifferent.different.sameCategoryDish.price)}
                                      </span>
                                      <span>•</span>
                                      <span>{msg.response.sameOrDifferent.different.sameCategoryDish.calories} kcal</span>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleViewDish(msg.response!.sameOrDifferent!.different.sameCategoryDish.id)}
                                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-border hover:border-text-primary hover:bg-text-primary hover:text-white text-text-primary text-[9px] font-bold uppercase tracking-wider transition-all"
                                >
                                  <span>View</span>
                                  <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                                </button>
                              </div>

                              <p className="text-[10px] text-text-secondary italic pt-1 border-t border-border/50">
                                "{msg.response.sameOrDifferent.different.reason}"
                              </p>
                            </div>

                            {/* 1 Dessert / Drink Pairing */}
                            <div className="p-3 bg-bg-primary rounded-xs border border-border/70 space-y-2">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-bold uppercase tracking-wider text-text-muted">
                                  2. Curated {msg.response.sameOrDifferent.different.pairingCategoryName} Pairing
                                </span>
                                <div className="flex items-center gap-1.5 font-sans font-semibold">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                    msg.response.sameOrDifferent.different.pairingPriceDiff > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {msg.response.sameOrDifferent.different.pairingPriceDiff === 0
                                      ? 'Same price'
                                      : msg.response.sameOrDifferent.different.pairingPriceDiff > 0
                                      ? `+${formatCurrency(msg.response.sameOrDifferent.different.pairingPriceDiff)}`
                                      : `-${formatCurrency(Math.abs(msg.response.sameOrDifferent.different.pairingPriceDiff))}`}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                    msg.response.sameOrDifferent.different.pairingCalorieDiff > 0 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {msg.response.sameOrDifferent.different.pairingCalorieDiff === 0
                                      ? 'Same kcal'
                                      : msg.response.sameOrDifferent.different.pairingCalorieDiff > 0
                                      ? `+${msg.response.sameOrDifferent.different.pairingCalorieDiff} kcal`
                                      : `${msg.response.sameOrDifferent.different.pairingCalorieDiff} kcal`}
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-3 items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                  {msg.response.sameOrDifferent.different.pairingDish.image && (
                                    <img
                                      src={msg.response.sameOrDifferent.different.pairingDish.image}
                                      alt={msg.response.sameOrDifferent.different.pairingDish.name}
                                      className="w-11 h-11 rounded-xs object-cover shrink-0 border border-border/80"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <h5 className="font-serif text-xs sm:text-sm font-bold text-text-primary truncate">
                                      {msg.response.sameOrDifferent.different.pairingDish.name}
                                    </h5>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-secondary">
                                      <span className="font-semibold text-text-primary">
                                        {formatCurrency(msg.response.sameOrDifferent.different.pairingDish.price)}
                                      </span>
                                      <span>•</span>
                                      <span>{msg.response.sameOrDifferent.different.pairingDish.calories} kcal</span>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleViewDish(msg.response!.sameOrDifferent!.different.pairingDish.id)}
                                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-border hover:border-text-primary hover:bg-text-primary hover:text-white text-text-primary text-[9px] font-bold uppercase tracking-wider transition-all"
                                >
                                  <span>View</span>
                                  <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                                </button>
                              </div>

                              <p className="text-[10px] text-text-secondary italic pt-1 border-t border-border/50">
                                "{msg.response.sameOrDifferent.different.pairingReason}"
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Recommendation Cards */}
                      {msg.response?.recommendations && msg.response.recommendations.length > 0 && !msg.response.lastOrder && !msg.response.sameOrDifferent && (
                        <div className="space-y-3.5 pt-1">
                          {msg.response.recommendations.map((rec: RecommendationResult, rIdx: number) => {
                            const displayName = getMenuItemName(rec.dish, lang);
                            const hasAR = Boolean(rec.dish.modelUrl);
                            const cardKey = `${msg.id}-${rec.dish.id}-${rIdx}`;
                            const isWhyExpanded = expandedWhyIds[cardKey] || false;

                            return (
                              <div
                                key={cardKey}
                                className="bg-white border border-border rounded-sm p-4 shadow-sm hover:border-accent/60 transition-all flex flex-col gap-3 group"
                              >
                                <div className="flex gap-3.5">
                                  {/* Dish Image */}
                                  <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-sm bg-border overflow-hidden shrink-0 relative">
                                    <img
                                      src={rec.dish.image}
                                      alt={displayName}
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      loading="lazy"
                                    />
                                    {hasAR && (
                                      <span className="absolute bottom-1 end-1 bg-black/85 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wider">
                                        3D / AR
                                      </span>
                                    )}
                                  </div>

                                  {/* Dish Info */}
                                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                    <div>
                                      <h4 className="font-serif text-base sm:text-lg text-text-primary font-normal leading-snug truncate">
                                        {displayName}
                                      </h4>
                                      <p className="font-serif text-sm font-semibold text-text-primary/90 mt-0.5">
                                        {formatCurrency(rec.dish.price)}
                                      </p>
                                    </div>

                                    {/* Dietary Tags */}
                                    {rec.dish.tags && rec.dish.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {rec.dish.tags.map((tag) => (
                                          <span
                                            key={tag.id}
                                            className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs border border-border/80 text-text-secondary bg-bg-primary"
                                          >
                                            {t[`tag_${tag.id}`] || tag.label}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Recommendation Reason */}
                                <div className="bg-bg-primary border-s-2 border-accent px-3 py-2 text-xs text-text-secondary leading-relaxed font-sans italic">
                                  "{rec.reason}"
                                </div>

                                {/* FEATURE 6: "Why this?" Expandable Explanation */}
                                {rec.whyBullets && rec.whyBullets.length > 0 && (
                                  <div className="border-t border-border/50 pt-1.5">
                                    <button
                                      type="button"
                                      onClick={() => toggleWhy(cardKey)}
                                      className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-accent transition-colors py-1"
                                    >
                                      <span className="flex items-center gap-1.5">
                                        <HelpCircle className="w-3 h-3 text-accent" />
                                        Why this dish?
                                      </span>
                                      {isWhyExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>

                                    {isWhyExpanded && (
                                      <div className="mt-1.5 p-2.5 bg-bg-secondary/60 rounded-xs text-[11px] text-text-secondary space-y-1 font-sans animate-in fade-in duration-150">
                                        {rec.whyBullets.map((bullet, bIdx) => (
                                          <div key={bIdx} className="flex items-start gap-1.5 leading-snug">
                                            <span className="text-accent">•</span>
                                            <span>{bullet}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* VIEW DISH Action */}
                                <button
                                  onClick={() => handleViewDish(rec.dish.id)}
                                  className="w-full mt-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full border border-border hover:border-text-primary hover:bg-text-primary hover:text-bg-primary text-text-primary text-[10px] font-bold uppercase tracking-widest transition-all duration-200"
                                >
                                  <span>{hasAR ? (t.view_dish_ar || 'VIEW DISH & AR PREVIEW') : (t.view_dish || 'VIEW DISH')}</span>
                                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Follow-up Note */}
                      {msg.response?.followUpSuggestion && (
                        <p className="text-[11px] text-text-muted px-1 font-sans">
                          {msg.response.followUpSuggestion}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex items-center gap-1.5 bg-white border border-border px-3.5 py-2.5 rounded-2xl rounded-tl-xs w-16">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Prompts */}
            <div className="px-5 py-3 border-t border-border bg-white shrink-0">
              <span className="text-[9px] uppercase tracking-[0.2em] text-text-muted font-bold block mb-2">
                Suggested Requests
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {activeSuggestedChips.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptClick(prompt)}
                    className="whitespace-nowrap px-3.5 py-1.5 bg-bg-primary border border-border hover:border-accent hover:text-accent rounded-full text-[11px] text-text-secondary transition-all shrink-0 font-medium active:scale-95"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputValue);
              }}
              className="p-4 bg-bg-primary border-t border-border flex items-center gap-2.5 shrink-0"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="What are you in the mood for?"
                className="flex-1 bg-white border border-border rounded-full px-4 py-2.5 text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="w-10 h-10 rounded-full bg-text-primary disabled:opacity-40 text-bg-primary flex items-center justify-center shrink-0 hover:bg-accent transition-colors shadow-xs"
                aria-label="Send message"
              >
                <Send className="w-4 h-4 rtl:rotate-180" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
