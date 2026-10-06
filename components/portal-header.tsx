"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HelpWidget } from "./help-widget";
import { ChangePasswordButton } from "./change-password-modal";

export function PortalHeader({
  portalLabel,
  name,
  roleLabel,
}: {
  portalLabel: string;
  name: string;
  roleLabel: string;
}) {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-marigold">
              I2I Portal · {portalLabel}
            </p>
            <p className="mt-0.5 font-display text-lg font-semibold text-ink">{name}</p>
            <p className="text-xs text-muted capitalize">{roleLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <ChangePasswordButton />
            <button
              onClick={logout}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-light transition hover:border-ink hover:text-ink"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <HelpWidget />
    </>
  );
}
