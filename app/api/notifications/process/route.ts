import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotification } from "@/lib/notifications";

const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 3;

export async function POST(req: NextRequest) {
  // Protect this endpoint — only your scheduled job should be able to call it.
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: pending, error } = await admin
    .from("notification_queue")
    .select("*")
    .eq("status", "pending")
    .eq("channel", "email")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not read queue" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const item of pending ?? []) {
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
      failed++;
      console.error(`Notification ${item.id} failed:`, message);
    }
  }

  return NextResponse.json({ processed: (pending ?? []).length, sent, failed });
}
