"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-4">
      <p className="font-semibold text-danger">This page could not load.</p>
      <p className="mt-1 text-sm text-muted">Check your connection and try again. If it keeps failing, confirm the Supabase project is running.</p>
      <button className="btn mt-3" onClick={reset}>Try again</button>
    </div>
  );
}
