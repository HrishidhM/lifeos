import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { logActivity } from "./activity";

export const STATUSES = ["Considering", "Planned", "Ordered", "Purchased", "Cancelled"] as const;
const price = z.number().min(0, "Price cannot be negative").max(1e10, "Price is too large");
export const itemSchema = z.object({
  item: z.string().trim().min(1, "Item name is required"),
  category: z.string().optional(),
  estimated_price: price.optional(),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium"),
  planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date").optional(),
  purchase_url: z.string().url("Enter a full URL, e.g. https://…").optional(),
});
export type Item = {
  id: string; item: string; estimated_price: number | null; actual_price: number | null;
  priority: string; planned_date: string | null; status: string; purchase_url: string | null;
};

const fail = (m: string): never => { throw new Error(m); };
const userId = async (db: SupabaseClient) => (await db.auth.getUser()).data.user?.id ?? fail("Not signed in");

export async function getItems(db: SupabaseClient): Promise<Item[]> {
  const { data, error } = await db.from("shopping_items").select("*").order("planned_date", { nullsFirst: false });
  if (error) fail(`Could not load shopping items: ${error.code} ${error.message}`);;
  return (data as Item[]).map((i) => ({ ...i, estimated_price: i.estimated_price == null ? null : Number(i.estimated_price), actual_price: i.actual_price == null ? null : Number(i.actual_price) }));
}
export async function createItem(db: SupabaseClient, input: z.infer<typeof itemSchema>) {
  const v = itemSchema.parse(input);
  if ((await db.from("shopping_items").insert({ ...v, status: "Planned", user_id: await userId(db) })).error) fail("Could not save item.");
}
export async function setStatus(db: SupabaseClient, it: Item, status: (typeof STATUSES)[number], actualPrice?: number) {
  const patch: Record<string, unknown> = { status };
  if (status === "Purchased") patch.actual_price = price.parse(actualPrice ?? it.estimated_price ?? 0);
  if ((await db.from("shopping_items").update(patch).eq("id", it.id)).error) fail("Could not update item.");
  if (status === "Purchased") await logActivity(db, { type: "PURCHASE_COMPLETED", entityType: "shopping_item", entityId: it.id, description: `Purchased "${it.item}"` });
}
export async function deleteItem(db: SupabaseClient, id: string) {
  if ((await db.from("shopping_items").delete().eq("id", id)).error) fail("Could not delete item.");
}
