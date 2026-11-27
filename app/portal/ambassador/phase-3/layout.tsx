import { createClient } from "@/lib/supabase/server";

// Blocks direct navigation to /portal/ambassador/phase-3/* while the
// Secretary hasn't opened Phase 3 (phase_number 3, "Phase 3.1 –
// Mentorship") from the Phase Engine panel yet — the sidebar already hides
// these links in that state, but a bookmarked or typed URL would otherwise
// still reach the page underneath.
export default async function AmbassadorPhase3Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: phase3Settings } = await supabase
    .from("phase_settings")
    .select("is_open")
    .eq("phase_number", 3)
    .maybeSingle();

  if (!phase3Settings?.is_open) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Phase 3</p>
        <h1 className="mt-2 font-display text-xl font-bold text-ink">Mentorship hasn&apos;t started yet</h1>
        <p className="mt-2 text-sm text-muted">
          The Secretary will open this section from the Phase Engine once Phase 3 begins. Check back soon.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
