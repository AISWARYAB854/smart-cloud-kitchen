export type Food = {
  id: number;
  category_id: number;
  name: string;
  description: string;
  ingredients: string;
  portion: string;
  price: number;
  sale_price: number;
  image: string;
  vegetarian: boolean;
  available: boolean;
  bestseller: boolean;
  special: boolean;
  preparation_minutes: number;
};
export type Addon = {
  id: number;
  food_id: number;
  name: string;
  price: number;
};
export type Catalog = {
  business: {
    name: string;
    tagline: string;
    phone: string;
    whatsapp: string;
    address: string;
    opening: string;
    closing: string;
    cutoff: string;
    preparation_minutes: number;
    tax_rate: number;
    payment_methods: string[];
    delivery_slots: string[];
  };
  categories: { id: number; name: string }[];
  foods: Food[];
  addons: Addon[];
  areas: { id: number; name: string; charge: number; minimum: number }[];
};
export type CartLine = {
  key: string;
  food_id: number;
  quantity: number;
  addon_ids: number[];
  instructions: string;
};
export type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
};
export type OrderDetail = {
  order: {
    number: string;
    status: string;
    total: number;
    created_at: string;
    address: string;
    scheduled_at: string | null;
  };
  items: {
    name: string;
    quantity: number;
    unit_price: number;
    instructions: string;
  }[];
  payment: { status: string; method: string };
  history: { status: string; created_at: string }[];
};
