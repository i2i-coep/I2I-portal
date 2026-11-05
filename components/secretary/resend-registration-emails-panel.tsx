"use client";

import { useState } from "react";

export function ResendRegistrationEmailsPanel() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    if (
      !confirm(
        "This resends the registration confirmation email (with login ID + password) to every registered team. Anyone who already changed their password will see the original one, which no longer works for them. Continue?"
      )
    ) {
      return;
    }
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/secretary/resend-registration-emails", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
      setResult(json.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-base font-semibold text-ink">Resend Registration Confirmation Emails</h2>
      <p className="mt-1 text-xs text-muted">
        Re-sends the original registration email (project code + login ID + password) to every
        currently registered team. For anyone who has already changed their password since, the
        password shown will be the original one and will no longer work for them.
      </p>
      <button
        onClick={resend}
        disabled={sending}
        className="mt-3 rounded-lg bg-marigold px-3 py-2 text-xs font-semibold text-ink disabled:opacity-60"
      >
        {sending ? "Queuing..." : "Resend to All Registered Teams"}
      </button>
      {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
      {result && <p className="mt-2 text-xs font-medium text-green-500">{result}</p>}
    </div>
  );
}
