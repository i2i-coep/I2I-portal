import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Login and password-reset call Supabase Auth directly from the browser
// (the SSR-recommended pattern, so the session cookie gets set correctly) —
// there's no server route in the normal flow to attach the register/
// raise-query-style rate limiting to. This route is called as a pre-flight
// check before either of those client-side calls: it's advisory, not a hard
// enforcement boundary (a determined attacker could skip straight to
// Supabase's own endpoint), but it meaningfully raises the bar against
// scripted guessing for the realistic threat here, and Supabase's own
// platform-level Auth throttling still applies underneath regardless.
const LIMITS: Record<string, { ipMax: number; ipWindow: number; emailMax: number; emailWindow: number }> = {
  login: { ipMax: 15, ipWindow: 600, emailMax: 8, emailWindow: 900 },
  "forgot-password": { ipMax: 5, ipWindow: 3600, emailMax: 3, emailWindow: 3600 },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "");
    const limits = LIMITS[action];
    if (!limits) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const ip = getClientIp(req);
    if (!(await checkRateLimit(`${action}:ip:${ip}`, limits.ipMax, limits.ipWindow))) {
      return NextResponse.json(
        { error: "Too many attempts from this network. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const email = String(body?.email ?? "").trim().toLowerCase();
    if (email && !(await checkRateLimit(`${action}:email:${email}`, limits.emailMax, limits.emailWindow))) {
      return NextResponse.json(
        { error: "Too many attempts for this account. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Same fail-open posture as checkRateLimit itself — a hiccup here must
    // never be the reason someone can't log in.
    console.error("Auth rate-limit check failed unexpectedly, allowing request:", e);
    return NextResponse.json({ ok: true });
  }
}
