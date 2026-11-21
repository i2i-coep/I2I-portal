import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotification } from "@/lib/notifications";

// Lets the Secretary force an immediate send for one team or staff member
// instead of waiting for the daily /api/notifications/process cron to drain
// the queue — same dispatch function the cron uses, just scoped to one
// recipient and triggered synchronously from the portal.
export async function POST(request: Request) {
  try {
    const authed = await createClient();
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { data: staff } = await authed
      .from("staff_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (!staff || staff.role !== "secretary") {
      return NextResponse.json({ error: "Only the Secretary can send emails directly" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const teamId = body?.teamId;
    const staffId = body?.staffId;
    if ((!teamId || typeof teamId !== "string") && (!staffId || typeof staffId !== "string")) {
      return NextResponse.json({ error: "Missing teamId or staffId" }, { status: 400 });
    }

    const admin = createAdminClient();
    let query = admin
      .from("notification_queue")
      .select("*")
      .eq("status", "pending")
      .eq("channel", "email")
      .order("created_at", { ascending: true });
    query = teamId ? query.eq("team_id", teamId) : query.eq("staff_id", staffId);
    const { data: pending, error } = await query;

    if (error) {
      console.error("Send notification now: queue lookup failed:", error);
      return NextResponse.json({ error: "Couldn't read the notification queue." }, { status: 500 });
    }
    if (!pending || pending.length === 0) {
      return NextResponse.json({ error: "No pending email queued for this recipient." }, { status: 404 });
    }

    let sent = 0;
    const errors: string[] = [];
    for (const item of pending) {
      try {
        await dispatchNotification(item, admin);
        await admin
          .from("notification_queue")
          .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
          .eq("id", item.id);
        sent++;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        await admin
          .from("notification_queue")
          .update({ attempts: item.attempts + 1, error: message })
          .eq("id", item.id);
        errors.push(message);
      }
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: "Secretary",
      action: "notification_sent_now",
      target_type: teamId ? "team" : "staff_profiles",
      target_id: teamId || staffId,
      details: { sent, failed: errors.length },
    });

    if (sent === 0) {
      return NextResponse.json({ error: errors[0] ?? "Send failed." }, { status: 502 });
    }

    return NextResponse.json({ sent, message: `Sent ${sent} email${sent === 1 ? "" : "s"} immediately.` });
  } catch (err) {
    console.error("Send notification now failed:", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
