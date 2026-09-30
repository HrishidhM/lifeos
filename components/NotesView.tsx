"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createNote, deleteNote, type Note } from "@/lib/services/notes";

export default function NotesView({ notes }: { notes: Note[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const term = q.toLowerCase();
  const shown = notes.filter((n) => [n.title, n.content, ...n.tags].join(" ").toLowerCase().includes(term));
  async function run(fn: () => Promise<unknown>, form?: HTMLFormElement) {
    try { await fn(); setError(null); form?.reset(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
  }
  return (
    <div className="space-y-4">
      <form className="grid gap-2 bg-panel border border-line rounded-lg p-3" onSubmit={(e) => {
        e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
        run(() => createNote(createClient(), {
          title: String(f.get("title")), content: String(f.get("content")), category: (f.get("category") as string) || undefined,
          tags: String(f.get("tags")).split(",").map((t) => t.trim()).filter(Boolean),
        }), form);
      }}>
        <label><span className="sr-only">Title</span><input name="title" className="input" placeholder="Note title" required /></label>
        <label><span className="sr-only">Content</span><textarea name="content" rows={4} className="input" placeholder="Write in Markdown…" /></label>
        <div className="flex flex-wrap gap-2"><input name="category" aria-label="Category" className="input flex-1" placeholder="Category" /><input name="tags" aria-label="Tags" className="input flex-1" placeholder="Tags, comma separated" /><button className="btn">Save note</button></div>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <label><span className="sr-only">Search notes</span><input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Search notes and tags" /></label>
      {shown.length === 0 ? <p className="text-sm text-muted">{notes.length ? "No notes match." : "No notes yet. Capture your first idea above."}</p> : (
        <ul className="grid sm:grid-cols-2 gap-3">{shown.map((n) => (
          <li key={n.id} className="bg-panel border border-line rounded-lg p-4">
            <div className="flex justify-between gap-2"><h2 className="font-semibold">{n.title}</h2>
              <button className="text-xs text-muted hover:text-danger" onClick={() => confirm(`Delete note "${n.title}"?`) && run(() => deleteNote(createClient(), n.id))}>Delete</button></div>
            <p className="text-sm whitespace-pre-wrap mt-1 line-clamp-6">{n.content}</p>
            <p className="text-xs text-muted mt-2">{[n.category, ...n.tags.map((t) => `#${t}`)].filter(Boolean).join(" · ")}</p>
          </li>))}</ul>)}
    </div>
  );
}
