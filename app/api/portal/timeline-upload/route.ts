import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function cellText(row: ExcelJS.Row, col: number): string {
  const v = row.getCell(col).value;
  if (v == null) return "";
  if (typeof v === "object" && !(v instanceof Date)) {
    const obj = v as unknown as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text.trim();
    if (Array.isArray(obj.richText)) {
      return (obj.richText as { text: string }[]).map((r) => r.text).join("").trim();
    }
    if (obj.result != null) return String(obj.result).trim();
    return "";
  }
  return String(v).trim();
}

// Team leader only — re-uploading replaces the team's entire plan (old
// rows deleted first), since a revised plan supersedes the old one
// wholesale rather than merging with it.
export async function POST(request: Request) {
  try {
    const authed = await createClient();
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: team } = await admin
      .from("teams")
      .select("id")
      .eq("leader_auth_id", user.id)
      .maybeSingle();
    if (!team) {
      return NextResponse.json({ error: "No team found for this account" }, { status: 404 });
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file received. Attach the filled .xlsx template." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large — is this the right spreadsheet?" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch (err) {
      console.error("Timeline upload: failed to parse workbook:", err);
      return NextResponse.json({ error: "Couldn't read this file as an Excel spreadsheet (.xlsx)." }, { status: 400 });
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "The spreadsheet has no sheets." }, { status: 400 });
    }

    const rows: { week_number: number; date_range: string; focus_area: string | null; key_task: string; mentor_role: string | null; is_done: boolean }[] = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const dateRange = cellText(row, 1);
      const week = cellText(row, 2);
      const focusArea = cellText(row, 3);
      const keyTask = cellText(row, 4);
      const mentorRole = cellText(row, 5);
      const done = cellText(row, 6).toLowerCase();

      if (!dateRange && !week && !keyTask) continue; // blank row
      const weekNumber = parseInt(week, 10);
      if (!dateRange || Number.isNaN(weekNumber) || !keyTask) continue; // incomplete row — skip rather than fail the whole upload

      rows.push({
        week_number: weekNumber,
        date_range: dateRange,
        focus_area: focusArea || null,
        key_task: keyTask,
        mentor_role: mentorRole || null,
        is_done: done === "true" || done === "yes" || done === "1",
      });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No usable rows found — check Date Range, Week, and Key Task are filled in." }, { status: 400 });
    }

    const { error: deleteErr } = await admin.from("timeline_plan_entries").delete().eq("team_id", team.id);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    const { error: insertErr } = await admin
      .from("timeline_plan_entries")
      .insert(rows.map((r) => ({ ...r, team_id: team.id })));
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: "Participant",
      action: "timeline_plan_uploaded",
      target_type: "team",
      target_id: team.id,
      details: { rows: rows.length },
    });

    return NextResponse.json({ success: true, rows: rows.length });
  } catch (err) {
    console.error("Timeline upload failed:", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
