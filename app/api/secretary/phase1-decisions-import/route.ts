import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB — this is a spreadsheet, not a media file

function normalizeDecision(raw: unknown): "accept" | "reject" | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (["accept", "accepted", "yes", "approve", "approved", "shortlist", "shortlisted", "eligible"].includes(v))
    return "accept";
  if (["reject", "rejected", "no", "decline", "declined"].includes(v)) return "reject";
  return null;
}

function findColumn(headerRow: ExcelJS.Row, ...names: string[]): number | null {
  let found: number | null = null;
  headerRow.eachCell((cell, colNumber) => {
    const text = String(cell.value ?? "").trim().toLowerCase();
    if (names.some((n) => n.toLowerCase() === text)) found = colNumber;
  });
  return found;
}

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
      return NextResponse.json({ error: "Only the Secretary can import decisions" }, { status: 403 });
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file received. Attach the reviewed .xlsx file." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large — is this the right spreadsheet?" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch (err) {
      console.error("Phase 1 decisions import: failed to parse workbook:", err);
      return NextResponse.json(
        { error: "Couldn't read this file as an Excel spreadsheet. Make sure it's the .xlsx exported from this portal." },
        { status: 400 }
      );
    }

    const sheet = workbook.worksheets.find((s) => {
      const headerRow = s.getRow(1);
      return findColumn(headerRow, "Project Code") && findColumn(headerRow, "Decision");
    });
    if (!sheet) {
      return NextResponse.json(
        { error: 'No sheet with "Project Code" and "Decision" columns was found. Upload the spreadsheet as downloaded from this portal.' },
        { status: 400 }
      );
    }

    const headerRow = sheet.getRow(1);
    const codeCol = findColumn(headerRow, "Project Code")!;
    const decisionCol = findColumn(headerRow, "Decision")!;

    const decisionByCode = new Map<string, "accept" | "reject">();
    let unrecognizedCount = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const codeRaw = row.getCell(codeCol).value;
      const code = codeRaw != null ? String(codeRaw).trim().toUpperCase() : "";
      if (!code || code === "PENDING") return;

      const decisionRaw = row.getCell(decisionCol).value;
      if (decisionRaw == null || String(decisionRaw).trim() === "") return; // blank — no decision yet, skip silently
      const decision = normalizeDecision(decisionRaw);
      if (!decision) {
        unrecognizedCount++;
        return;
      }
      decisionByCode.set(code, decision);
    });

    if (decisionByCode.size === 0) {
      return NextResponse.json({
        accepted: 0,
        rejected: 0,
        alreadyDecided: 0,
        notFound: [],
        unrecognizedDecisions: unrecognizedCount,
        message: "No Accept/Reject decisions were found to apply — every decision cell was blank.",
      });
    }

    const admin = createAdminClient();

    const codes = Array.from(decisionByCode.keys());
    const { data: matchedTeams, error: matchErr } = await admin
      .from("teams")
      .select("id, project_code, status")
      .in("project_code", codes);
    if (matchErr) {
      console.error("Phase 1 decisions import: team lookup failed:", matchErr);
      return NextResponse.json({ error: "Couldn't look up teams. Try again." }, { status: 500 });
    }

    const notFound = codes.filter((c) => !(matchedTeams ?? []).some((t) => t.project_code === c));

    // Only apply to teams still awaiting a Phase 1 decision — stops a
    // stale or duplicate upload from reverting a team that's since moved
    // on (already shortlisted into Phase 2, or already rejected).
    const eligible = (matchedTeams ?? []).filter((t) => ["registered", "under_review"].includes(t.status));
    const alreadyDecided = (matchedTeams ?? []).length - eligible.length;

    const acceptIds = eligible.filter((t) => decisionByCode.get(t.project_code!) === "accept").map((t) => t.id);
    const rejectIds = eligible.filter((t) => decisionByCode.get(t.project_code!) === "reject").map((t) => t.id);

    if (acceptIds.length > 0) {
      const { error } = await admin.from("teams").update({ status: "shortlisted_phase2" }).in("id", acceptIds);
      if (error) throw error;
    }
    if (rejectIds.length > 0) {
      const { error } = await admin.from("teams").update({ status: "rejected" }).in("id", rejectIds);
      if (error) throw error;
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: "Secretary",
      action: "phase1_decisions_import",
      target_type: "teams",
      details: {
        accepted: acceptIds.length,
        rejected: rejectIds.length,
        already_decided_skipped: alreadyDecided,
        not_found: notFound,
        unrecognized_decisions: unrecognizedCount,
      },
    });

    return NextResponse.json({
      accepted: acceptIds.length,
      rejected: rejectIds.length,
      alreadyDecided,
      notFound,
      unrecognizedDecisions: unrecognizedCount,
      message: `Applied ${acceptIds.length + rejectIds.length} decisions. Shortlisted teams see their Phase 2 form unlock immediately; not-selected teams can download their certificate right away.`,
    });
  } catch (err) {
    console.error("Phase 1 decisions import failed:", err);
    return NextResponse.json(
      { error: "Import failed partway through — some decisions above the failure point may already be applied. Re-upload to safely retry (already-decided rows are skipped automatically)." },
      { status: 500 }
    );
  }
}
