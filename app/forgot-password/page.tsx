"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/auth-card";
import { Field, TextInput } from "@/components/form-fields";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);

    try {
      const rateLimitRes = await fetch("/api/auth/rate-limit-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forgot-password", email }),
      });
      if (!rateLimitRes.ok) {
        const body = await rateLimitRes.json().catch(() => null);
        setError(body?.error || "Too many attempts. Please try again later.");
        setLoading(false);
        return;
      }
    } catch {
      // Network hiccup on the rate-limit pre-check — don't block the reset over it.
    }

    const supabase = createClient();
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    });
    setLoading(false);
    if (resetErr) {
      setError(resetErr.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <p className="text-sm text-muted">
          If an account exists for <span className="font-medium text-ink">{email}</span>,
          a password reset link has been sent.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" subtitle="Enter the email you registered with">
      <div className="space-y-4">
        <Field label="Email" required>
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {error && (
          <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">{error}</p>
        )}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-ink-light disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </div>
    </AuthCard>
  );
}
