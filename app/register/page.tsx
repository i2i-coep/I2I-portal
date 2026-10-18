import { RegistrationWizard } from "@/components/registration-wizard";
import { PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";

export default async function RegisterPage() {
  const supabase = await createClient();
  const { data: phase1 } = await supabase
    .from("phase_settings")
    .select("is_open, opens_at, closes_at")
    .eq("phase_number", 1)
    .maybeSingle();

  const now = Date.now();
  const isOpen =
    !!phase1?.is_open &&
    (!phase1.opens_at || new Date(phase1.opens_at).getTime() <= now) &&
    (!phase1.closes_at || new Date(phase1.closes_at).getTime() >= now);

  if (!isOpen) {
    return (
      <PageShell particles={false} theme="v0" className="flex-1 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-marigold">
            I2I 2026-27 Registrations
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
            Registrations are closed
          </h1>
          <p className="mt-4 text-sm text-muted">
            Registration for the I2I 2026-27 cycle has closed. If you already registered, log in to
            your portal to continue — otherwise, keep an eye out for the next cycle.
          </p>
          <a
            href="/login"
            className="mt-6 inline-block rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-ink-light"
          >
            Go to login
          </a>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell particles={false} theme="v0" className="flex-1 px-4 py-12 sm:py-16">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-marigold">
          I2I 2026-27 Registrations
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
          Register your project
        </h1>
        <p className="mt-3 text-sm text-muted">
          Ignited Innovators of India — Bhau Institute, COEP Technological University
        </p>
      </div>
      <RegistrationWizard />
    </PageShell>
  );
}
