"use client";

import Image from "next/image";
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logos/i2i.png"
              alt="I2I"
              width={538}
              height={379}
              priority
              className="h-7 w-auto shrink-0 sm:h-9"
            />
            <div className="min-w-0 border-l border-line pl-3">
              <p className="truncate text-xs font-semibold uppercase tracking-widest text-marigold">
                I2I Portal · {portalLabel}
              </p>
              <p className="mt-0.5 truncate font-display text-lg font-semibold text-ink">{name}</p>
              <p className="truncate text-xs text-muted capitalize">{roleLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
