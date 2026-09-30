import ShoppingView from "@/components/ShoppingView";
import { createClient } from "@/lib/supabase/server";
import { getItems } from "@/lib/services/shopping";

export default async function ShoppingPage() {
  const db = await createClient();
  try {
    const [items, prof] = await Promise.all([getItems(db), db.from("profiles").select("currency").maybeSingle()]);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Shopping</h1>
        <ShoppingView items={items} currency={(prof.data?.currency as string | undefined) ?? "INR"} />
      </div>
    );
  } catch (e) {
    return <p role="alert" className="text-danger">{(e as Error).message}</p>;
  }
}
