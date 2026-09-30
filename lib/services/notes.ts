import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const noteSchema = z.object({
  title: z.string().trim().min(1, "Title is required"), content: z.string().default(""),
  category: z.string().optional(), tags: z.array(z.string()).default([]),
});
export type Note = { id: string; title: string; content: string; category: string | null; tags: string[]; updated_at: string };
const fail = (m: string): never => { throw new Error(m); };

export async function getNotes(db: SupabaseClient): Promise<Note[]> {
  const { data, error } = await db.from("notes").select("id,title,content,category,tags,updated_at").order("updated_at", { ascending: false });
  if (error) fail("Could not load notes.");
  return data as Note[];
}
export async function createNote(db: SupabaseClient, input: z.input<typeof noteSchema>) {
  const v = noteSchema.parse(input);
  const uid = (await db.auth.getUser()).data.user?.id ?? fail("Not signed in");
  if ((await db.from("notes").insert({ ...v, user_id: uid })).error) fail("Could not save note.");
}
export async function deleteNote(db: SupabaseClient, id: string) {
  if ((await db.from("notes").delete().eq("id", id)).error) fail("Could not delete note.");
}
