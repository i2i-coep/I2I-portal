"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field, TextInput } from "@/components/form-fields";

const PORTAL_LABELS: Record<string, string> = {
  secretary: "Secretary",
  participant: "Participant",
  ambassador: "Ambassador",
  mentor: "Mentor",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portalHint = searchParams.get("portal");
  const portalLabel = portalHint ? PORTAL_LABELS[portalHint] : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); // real <form> submit -> lets the browser offer to save the password
    setError(null);
    setLoading(true);

    try {
      const rateLimitRes = await fetch("/api/auth/rate-limit-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email }),
      });
      if (!rateLimitRes.ok) {
        const body = await rateLimitRes.json().catch(() => null);
        setError(body?.error || "Too many attempts. Please try again later.");
        setLoading(false);
        return;
      }
    } catch {
      // Network hiccup on the rate-limit pre-check — don't block login over it.
    }

    const supabase = createClient(rememberMe);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInErr) {
      setError("Incorrect email or password.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-marigold">
          I2I Portal{portalLabel ? ` · ${portalLabel}` : ""}
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">Log in</h1>
        <p className="mt-2 text-sm text-muted">
          {portalLabel
            ? `Sign in with your ${portalLabel.toLowerCase()} account`
            : "You'll be sent to the right portal automatically"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-line bg-surface p-6 shadow-sm"
        autoComplete="on"
      >
        <div className="space-y-4">
          <Field label="Email" required>
            <TextInput
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password" required>
            <TextInput
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-marigold"
            />
            Remember me on this device
          </label>

          {error && (
            <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-ink-light disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <p className="text-center text-sm text-muted">
            <a href="/forgot-password" className="font-medium text-ink hover:text-marigold">
              Forgot your password?
            </a>
          </p>
        </div>
      </form>

      <p className="mt-4 text-center text-xs text-muted">
        Tip: your browser may offer to save this password for next time.
      </p>
    </div>
  );
}
