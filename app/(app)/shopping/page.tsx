import ShoppingView from "@/components/ShoppingView";
import { createClient } from "@/lib/supabase/server";
import { getItems } from "@/lib/services/shopping";
import { getContext } from "@/lib/services/profile";

export default async function ShoppingPage() {
  const db = await createClient();
  const [items, ctx] = await Promise.all([getItems(db), getContext(db)]);
  return (<div className="space-y-4"><h1 className="text-2xl font-bold">Shopping</h1><ShoppingView items={items} currency={ctx.currency} today={ctx.today} /></div>);
}
