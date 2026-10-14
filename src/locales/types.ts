export type LanguageCode = 
  | 'en' 
  | 'fr' 
  | 'es' 
  | 'hi' 
  | 'ta' 
  | 'mr' 
  | 'bn' 
  | 'te' 
  | 'gu' 
  | 'kn' 
  | 'ml' 
  | 'pa' 
  | 'ur';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

export interface Translations {
  // Navigation
  nav_menu: string;
  nav_gallery: string;
  nav_locations: string;
  nav_cart: string;
  nav_book: string;

  // Hero
  hero_title: string;
  hero_subtitle: string;

  // Restaurant Info
  location: string;
  directions: string;
  daily: string;
  open_time: string;

  // Categories
  starters: string;
  'main-courses': string;
  sides: string;
  desserts: string;
  drinks: string;

  // Dish Card & Modals
  kcal: string;
  walk_min: string;
  view_ar: string;
  view_3d: string;
  in_3d: string;
  close_3d: string;
  instructions_3d: string;
  add: string;
  added: string;
  add_to_cart: string;
  view_cart: string;
  back_to_menu: string;
  item_not_found: string;
  go_back: string;

  // Dietary Tags
  tag_v: string;
  tag_vg: string;
  tag_gf: string;
  tag_df: string;
  tag_n: string;
  tag_spicy: string;

  // Cart Page
  cart_title: string;
  cart_empty_title: string;
  cart_empty_desc: string;
  cart_view_menu: string;
  cart_continue_browsing: string;
  cart_order_summary: string;
  cart_subtotal: string;
  cart_taxes: string;
  cart_taxes_notice: string;
  cart_total: string;
  cart_place_order: string;
  cart_pay_at_counter: string;

  // Order Status Page
  order_loading: string;
  order_not_found: string;
  order_return_to_menu: string;
  order_number: string;
  order_pay_counter_desc: string;
  order_step_placed: string;
  order_step_preparing: string;
  order_step_ready: string;
  order_step_completed: string;
  order_details: string;
  order_total: string;

  // Gallery & Locations & About
  about_title: string;
  about_desc: string;
  our_story: string;
  locations_title: string;
  locations_book: string;
  reservation_coming_soon: string;
  book: string;

  // Additional
  select_language?: string;

  // Footer
  vegan_gf: string;
  all_prices: string;
  footer_rights: string;
  footer_tagline?: string;
  footer_explore?: string;
  footer_information?: string;
  footer_follow?: string;
  footer_home?: string;
  footer_about?: string;
  footer_contact?: string;
  footer_privacy?: string;

  // Additional index signature for dynamic access
  [key: string]: string;
}
