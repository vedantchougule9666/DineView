import { DISH_TRANSLATIONS, DishTranslation } from './dishTranslations';
import { TRANSLATIONS as LOCALES_TRANSLATIONS } from '../locales';

export interface DietaryTag {
  id: string;
  label: string;
  color: string;
}

export const DIETARY_TAGS: Record<string, DietaryTag> = {
  v: { id: 'v', label: 'Vegetarian', color: 'bg-green-100 text-green-800 border-green-200' },
  vg: { id: 'vg', label: 'Vegan', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  gf: { id: 'gf', label: 'Gluten Free', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  df: { id: 'df', label: 'Dairy Free', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  n: { id: 'n', label: 'Contains Nuts', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  spicy: { id: 'spicy', label: 'Spicy', color: 'bg-red-100 text-red-800 border-red-200' },
};

export interface MenuItemTranslation {
  name: string;
  description: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  calories: number;
  tags?: DietaryTag[];
  available?: boolean;
  maxPerOrder?: number;
  modelUrl?: string;
  translations?: Record<string, MenuItemTranslation>;
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

// Re-export full translations map for backwards compatibility
export const TRANSLATIONS = LOCALES_TRANSLATIONS;

export function getMenuItemName(item: MenuItem, lang: string): string {
  if (!item) return '';
  if (item.translations && item.translations[lang]?.name) {
    return item.translations[lang].name;
  }
  if (DISH_TRANSLATIONS[item.id] && DISH_TRANSLATIONS[item.id][lang]?.name) {
    return DISH_TRANSLATIONS[item.id][lang].name;
  }
  if (item.translations?.en?.name) {
    return item.translations.en.name;
  }
  return item.name || '';
}

export function getMenuItemDescription(item: MenuItem, lang: string): string {
  if (!item) return '';
  if (item.translations && item.translations[lang]?.description) {
    return item.translations[lang].description;
  }
  if (DISH_TRANSLATIONS[item.id] && DISH_TRANSLATIONS[item.id][lang]?.description) {
    return DISH_TRANSLATIONS[item.id][lang].description;
  }
  if (item.translations?.en?.description) {
    return item.translations.en.description;
  }
  return item.description || '';
}

export const MENU_DATA: MenuCategory[] = [
  {
    id: 'starters',
    name: 'starters',
    items: [
      {
        id: 's1',
        name: 'Truffle Arancini',
        description: 'Crispy risotto balls infused with black truffle and parmesan, served with a roasted garlic aioli.',
        price: 1500,
        calories: 420,
        image: 'https://images.unsplash.com/photo-1541529086526-db283c563270?q=80&w=2070&auto=format&fit=crop',
        tags: [DIETARY_TAGS.v],
        translations: DISH_TRANSLATIONS.s1,
      },
      {
        id: 's2',
        name: 'Tuna Tartare',
        description: 'Fresh Ahi tuna, avocado, cucumber, and a soy-ginger dressing, accompanied by crisp wonton chips.',
        price: 1800,
        calories: 310,
        image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=2069&auto=format&fit=crop',
        tags: [DIETARY_TAGS.df],
        translations: DISH_TRANSLATIONS.s2,
      },
      {
        id: 's3',
        name: 'Heirloom Tomato Bruschetta',
        description: 'Toasted artisanal sourdough topped with marinated heirloom tomatoes, fresh basil, and balsamic glaze.',
        price: 1200,
        calories: 250,
        image: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?q=80&w=2071&auto=format&fit=crop',
        tags: [DIETARY_TAGS.v, DIETARY_TAGS.vg],
        translations: DISH_TRANSLATIONS.s3,
      },
      {
        id: 's4',
        name: 'Burger',
        description: 'A premium Wagyu beef patty layered with aged cheddar, caramelized onions, and house-made truffle aioli on a toasted artisanal brioche bun.',
        price: 1800,
        calories: 850,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1999&auto=format&fit=crop',
        tags: [],
        available: true,
        maxPerOrder: 20,
        modelUrl: '/models/burger.glb',
        translations: DISH_TRANSLATIONS.s4,
      },
    ],
  },
  {
    id: 'main-courses',
    name: 'main-courses',
    items: [
      {
        id: 'm1',
        name: 'Pan-Seared Scallops',
        description: 'Jumbo sea scallops served over a bed of sweet corn puree, crispy pancetta, and micro-greens.',
        price: 3500,
        calories: 480,
        image: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?q=80&w=2070&auto=format&fit=crop',
        tags: [DIETARY_TAGS.gf],
        translations: DISH_TRANSLATIONS.m1,
      },
      {
        id: 'm2',
        name: 'Wagyu Ribeye Steak',
        description: '12oz Wagyu ribeye, perfectly marbled and grilled to order. Served with truffled mashed potatoes and asparagus.',
        price: 650,
        calories: 950,
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=2069&auto=format&fit=crop',
        tags: [DIETARY_TAGS.gf],
        translations: DISH_TRANSLATIONS.m2,
      },
      {
        id: 'm3',
        name: 'Wild Mushroom Risotto',
        description: 'Creamy Arborio rice with a blend of wild forest mushrooms, finished with white truffle oil and aged parmesan.',
        price: 2500,
        calories: 620,
        image: 'https://images.unsplash.com/photo-1633504581786-316c8002b1b9?q=80&w=2070&auto=format&fit=crop',
        tags: [DIETARY_TAGS.v, DIETARY_TAGS.gf],
        translations: DISH_TRANSLATIONS.m3,
      },
      {
        id: 'm4',
        name: 'Spicy Thai Basil Chicken',
        description: 'Wok-tossed chicken breast with fresh basil, bell peppers, and chili, served over jasmine rice.',
        price: 2000,
        calories: 540,
        image: 'https://images.unsplash.com/photo-1564834724105-918b73d1b9e0?q=80&w=1976&auto=format&fit=crop',
        tags: [DIETARY_TAGS.spicy, DIETARY_TAGS.df],
        modelUrl: '/models/roasted-chicken.glb',
        translations: DISH_TRANSLATIONS.m4,
      },
      {
        id: 'm5',
        name: 'Wood-Fired Margherita Pizza',
        description: 'San Marzano tomato sauce, fresh buffalo mozzarella, fresh basil, and extra virgin olive oil on a slow-fermented wood-fired crust.',
        price: 2200,
        calories: 780,
        image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=2070&auto=format&fit=crop',
        tags: [DIETARY_TAGS.v],
        available: true,
        maxPerOrder: 20,
        modelUrl: '/models/pizza.glb',
      },
    ],
  },
  {
    id: 'sides',
    name: 'sides',
    items: [
      {
        id: 'sd1',
        name: 'Roasted Brussels Sprouts',
        description: 'Caramelized with balsamic reduction and tossed with toasted almonds.',
        price: 850,
        calories: 180,
        image: 'https://images.unsplash.com/photo-1582515073490-39981397c445?q=80&w=2069&auto=format&fit=crop',
        tags: [DIETARY_TAGS.v, DIETARY_TAGS.vg, DIETARY_TAGS.gf, DIETARY_TAGS.n],
        translations: DISH_TRANSLATIONS.sd1,
      },
      {
        id: 'sd2',
        name: 'Pommes Frites',
        description: 'Thin-cut fries tossed in sea salt and rosemary, served with garlic aioli.',
        price: 750,
        calories: 380,
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=2070&auto=format&fit=crop',
        tags: [DIETARY_TAGS.v],
        translations: DISH_TRANSLATIONS.sd2,
      },
    ],
  },
  {
    id: 'desserts',
    name: 'desserts',
    items: [
      {
        id: 'd1',
        name: 'Valrhona Chocolate Fondant',
        description: 'Rich molten chocolate cake served with Madagascar vanilla bean gelato and raspberry coulis.',
        price: 1500,
        calories: 650,
        image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=2070&auto=format&fit=crop',
        tags: [DIETARY_TAGS.v],
        translations: DISH_TRANSLATIONS.d1,
      },
      {
        id: 'd2',
        name: 'Classic Tiramisu',
        description: 'Espresso-soaked ladyfingers layered with light mascarpone cream and dusted with cocoa powder.',
        price: 1200,
        calories: 450,
        image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?q=80&w=2070&auto=format&fit=crop',
        tags: [DIETARY_TAGS.v],
        translations: DISH_TRANSLATIONS.d2,
      },
    ],
  },
  {
    id: 'drinks',
    name: 'drinks',
    items: [
      {
        id: 'dr1',
        name: 'Artisan Crafted Lemonade',
        description: 'Freshly squeezed lemons with a hint of lavender and sparkling water.',
        price: 650,
        calories: 120,
        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=1976&auto=format&fit=crop',
        tags: [DIETARY_TAGS.v, DIETARY_TAGS.vg, DIETARY_TAGS.gf],
        translations: DISH_TRANSLATIONS.dr1,
      },
      {
        id: 'dr2',
        name: 'Signature Negroni',
        description: 'Gin, Campari, and sweet vermouth, garnished with an orange peel.',
        price: 1500,
        calories: 190,
        image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=2070&auto=format&fit=crop',
        tags: [DIETARY_TAGS.v, DIETARY_TAGS.vg],
        translations: DISH_TRANSLATIONS.dr2,
      },
    ],
  },
];
