import NotesView from "@/components/NotesView";
import { createClient } from "@/lib/supabase/server";
import { getNotes } from "@/lib/services/notes";

export default async function NotesPage() {
  try {
    return (<div className="space-y-4"><h1 className="text-2xl font-bold">Notes</h1><NotesView notes={await getNotes(await createClient())} /></div>);
  } catch (e) { return <p role="alert" className="text-danger">{(e as Error).message}</p>; }
}
