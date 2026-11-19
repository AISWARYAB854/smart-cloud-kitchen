import type { Food, Addon } from "../types";
export type AdminFood = Food & { archived: boolean };
export type Category = {
  id: number;
  name: string;
  position: number;
  active: boolean;
};
export type AdminMenu = {
  foods: AdminFood[];
  categories: Category[];
  addons: Addon[];
};
export type AdminOrder = {
  order: {
    id: number;
    number: string;
    customer_name: string;
    phone: string;
    address: string;
    landmark: string;
    instructions: string;
    status: string;
    subtotal: number;
    tax: number;
    delivery_charge: number;
    total: number;
    created_at: string;
    scheduled_at: string | null;
  };
  items: {
    name: string;
    quantity: number;
    unit_price: number;
    instructions: string;
    addons: { name: string; price: string }[];
  }[];
  payment: { status: string; method: string };
  history: {
    status: string;
    created_at: string;
    note: string;
    actor_id: number | null;
  }[];
};
export type Overview = {
  start: string;
  end: string;
  orders: number;
  pending: number;
  delivered: number;
  cancelled: number;
  revenue: number;
  collected: number;
  average_order: number;
  daily: { date: string; revenue: number; orders: number }[];
  best_sellers: { name: string; quantity: number; revenue: number }[];
};
export const statuses = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];
export const labels: Record<string, string> = {
  placed: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
export const transitions: Record<string, string[]> = {
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};
export function timestamp(s: string) {
  return new Date(
    s.endsWith("Z") || /[+-]\d\d:\d\d$/.test(s) ? s : s + "Z",
  ).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
