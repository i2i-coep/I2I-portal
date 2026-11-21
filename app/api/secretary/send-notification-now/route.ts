import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotification } from "@/lib/notifications";

const ROLE_LABELS: Record<string, string> = {
  ambassador: "Ambassador",
  chief_ambassador: "Chief Ambassador",
};

// Same scheme as the Ambassador/Chief Ambassador bulk-import routes:
// lastname_<first 4 of email>, lowercased. Reproducible from data already
// stored, since full_name was always built as `${firstName} ${lastName}`
// with firstName guaranteed to be a single word — splitting off the first
// token and rejoining the rest recovers the original lastName exactly,
// even when it has multiple words itself (e.g. "Warad Amol Asare").
function makeStaffPassword(fullName: string, email: string): string {
  const parts = fullName.trim().split(/\s+/);
  const lastName = parts.slice(1).join(" ") || parts[0];
  const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const localPart = email.split("@")[0] ?? "";
  const cleanLocal = localPart.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4);
  return `${cleanLast}_${cleanLocal}`;
}

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
    if ((!pending || pending.length === 0) && staffId) {
      // Nothing was ever queued — likely an account created before this
      // notification type existed. Recompute the same welcome email fresh
      // rather than telling the Secretary there's nothing to send.
      const { data: staffRow } = await admin
        .from("staff_profiles")
        .select("full_name, email, role")
        .eq("id", staffId)
        .maybeSingle();
      if (!staffRow) {
        return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
      }
      const roleLabel = ROLE_LABELS[staffRow.role];
      if (!roleLabel) {
        return NextResponse.json(
          { error: `No welcome email template exists for role "${staffRow.role}".` },
          { status: 400 }
        );
      }

      const payload = {
        full_name: staffRow.full_name,
        role_label: roleLabel,
        login_email: staffRow.email,
        login_password: makeStaffPassword(staffRow.full_name, staffRow.email),
      };

      try {
        await dispatchNotification(
          { id: "", type: "staff_account_created", channel: "email", recipient_email: staffRow.email, recipient_phone: null, payload },
          admin
        );
        await admin.from("notification_queue").insert({
          type: "staff_account_created",
          channel: "email",
          staff_id: staffId,
          recipient_email: staffRow.email,
          payload,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
        await admin.from("audit_logs").insert({
          actor_id: user.id,
          actor_name: "Secretary",
          action: "notification_sent_now",
          target_type: "staff_profiles",
          target_id: staffId,
          details: { sent: 1, failed: 0, backfilled: true },
        });
        return NextResponse.json({ sent: 1, message: "Sent 1 email immediately (none had ever been queued for this account)." });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        await admin.from("notification_queue").insert({
          type: "staff_account_created",
          channel: "email",
          staff_id: staffId,
          recipient_email: staffRow.email,
          payload,
          status: "pending",
          error: message,
        });
        return NextResponse.json({ error: message }, { status: 502 });
      }
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
