import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB — this is a spreadsheet, not a media file

function normalizeDecision(raw: unknown): "accept" | "reject" | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (["accept", "accepted", "yes", "approve", "approved", "shortlist", "shortlisted"].includes(v)) return "accept";
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
    // ---- Auth: Secretary only ----
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

    // ---- Read the uploaded file ----
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
      console.error("Phase 2 import: failed to parse workbook:", err);
      return NextResponse.json(
        { error: "Couldn't read this file as an Excel spreadsheet. Make sure it's the .xlsx exported from this portal, edited (not re-saved as a different format)." },
        { status: 400 }
      );
    }

    // ---- Collect { projectCode -> decision } and { projectCode -> amount } across every sector sheet ----
    const decisionByCode = new Map<string, "accept" | "reject">();
    const amountByCode = new Map<string, number>();
    const invalidAmountCodes: string[] = [];
    let unrecognizedCount = 0;
    let sheetsRead = 0;

    for (const sheet of workbook.worksheets) {
      if (sheet.name.trim().toLowerCase() === "summary") continue;
      const headerRow = sheet.getRow(1);
      const codeCol = findColumn(headerRow, "Project Code");
      const decisionCol = findColumn(headerRow, "Phase 3.1 Decision", "Phase 3 Decision", "Decision");
      const amountCol = findColumn(headerRow, "Amount Approved (₹)", "Amount Approved");
      if (!codeCol || !decisionCol) continue; // not one of our exported sheets — skip quietly rather than error the whole import
      sheetsRead++;

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const codeRaw = row.getCell(codeCol).value;
        const code = codeRaw != null ? String(codeRaw).trim().toUpperCase() : "";
        if (!code || code === "PENDING") return;

        const decisionRaw = row.getCell(decisionCol).value;
        if (decisionRaw == null || String(decisionRaw).trim() === "") return; // left blank — no decision made yet, skip silently
        const decision = normalizeDecision(decisionRaw);
        if (!decision) {
          unrecognizedCount++;
          return;
        }
        decisionByCode.set(code, decision);

        // Only accepted rows carry a meaningful funding amount — a rejected
        // team's amount cell (if any) is ignored.
        if (decision === "accept" && amountCol) {
          const amtRaw = row.getCell(amountCol).value;
          if (amtRaw != null && String(amtRaw).trim() !== "") {
            const num = Number(amtRaw);
            if (Number.isFinite(num) && num >= 0) {
              amountByCode.set(code, num);
            } else {
              invalidAmountCodes.push(code);
            }
          }
        }
      });
    }

    if (sheetsRead === 0) {
      return NextResponse.json(
        { error: 'No sheets with "Project Code" and "Phase 3.1 Decision" columns were found. Upload the spreadsheet as downloaded from this portal.' },
        { status: 400 }
      );
    }

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

    // ---- Match project codes to teams ----
    const codes = Array.from(decisionByCode.keys());
    const { data: matchedTeams, error: matchErr } = await admin
      .from("teams")
      .select("id, project_code, status")
      .in("project_code", codes);
    if (matchErr) {
      console.error("Phase 2 import: team lookup failed:", matchErr);
      return NextResponse.json({ error: "Couldn't look up teams. Try again." }, { status: 500 });
    }

    const teamByCode = new Map((matchedTeams ?? []).map((t) => [t.project_code!, t]));
    const notFound = codes.filter((c) => !teamByCode.has(c));

    // Only apply to teams still awaiting a Phase 2 decision — this is what
    // stops a stale or duplicate spreadsheet upload from silently reverting
    // a team that has since moved on (funded, completed) back to
    // shortlisted_phase3, or re-rejecting/re-accepting something already
    // decided by the per-project modal in the meantime.
    const eligible = (matchedTeams ?? []).filter((t) => t.status === "shortlisted_phase2");
    const alreadyDecided = (matchedTeams ?? []).length - eligible.length;

    const acceptedTeams = eligible.filter((t) => decisionByCode.get(t.project_code!) === "accept");
    const acceptIds = acceptedTeams.map((t) => t.id);
    const rejectIds = eligible.filter((t) => decisionByCode.get(t.project_code!) === "reject").map((t) => t.id);

    // Accepted teams whose spreadsheet row had a valid amount vs. those that
    // didn't (blank cell, or a value that failed the number/non-negative
    // check above) — the latter still get accepted into Phase 3, just with
    // amount_approved left untouched, same as before this fix existed.
    const acceptedWithAmount = acceptedTeams.filter((t) => amountByCode.has(t.project_code!));
    const acceptedWithoutAmount = acceptedTeams.filter((t) => !amountByCode.has(t.project_code!));
    // Blank cell, as distinct from a cell that had text but failed validation
    // (that case is reported separately via invalidAmountCodes).
    const missingAmountCodes = acceptedWithoutAmount
      .map((t) => t.project_code!)
      .filter((code) => !invalidAmountCodes.includes(code));

    // ---- Apply, teams first then phase2_applications (both are needed —
    // teams.status is what the participant portal's gates tracker reads,
    // phase2_applications.funding_status is what the Secretary's own
    // review modal/export reads) ----
    if (acceptIds.length > 0) {
      const { error: teamErr } = await admin.from("teams").update({ status: "shortlisted_phase3" }).in("id", acceptIds);
      if (teamErr) throw teamErr;

      if (acceptedWithoutAmount.length > 0) {
        const { error: appErr } = await admin
          .from("phase2_applications")
          .update({ funding_status: "approved" })
          .in("team_id", acceptedWithoutAmount.map((t) => t.id));
        if (appErr) throw appErr;
      }
      // Each accepted-with-amount team gets a different number, so these
      // can't be one batched update — apply them in parallel instead.
      if (acceptedWithAmount.length > 0) {
        const results = await Promise.all(
          acceptedWithAmount.map((t) =>
            admin
              .from("phase2_applications")
              .update({ funding_status: "approved", amount_approved: amountByCode.get(t.project_code!) })
              .eq("team_id", t.id)
          )
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) throw failed.error;
      }
    }
    if (rejectIds.length > 0) {
      const { error: teamErr } = await admin.from("teams").update({ status: "rejected" }).in("id", rejectIds);
      if (teamErr) throw teamErr;
      const { error: appErr } = await admin
        .from("phase2_applications")
        .update({ funding_status: "rejected" })
        .in("team_id", rejectIds);
      if (appErr) throw appErr;
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: "Secretary",
      action: "phase2_spreadsheet_import",
      target_type: "phase2_applications",
      details: {
        accepted: acceptIds.length,
        accepted_with_amount: acceptedWithAmount.length,
        rejected: rejectIds.length,
        already_decided_skipped: alreadyDecided,
        not_found: notFound,
        unrecognized_decisions: unrecognizedCount,
        invalid_amounts: invalidAmountCodes,
      },
    });

    return NextResponse.json({
      accepted: acceptIds.length,
      acceptedWithAmount: acceptedWithAmount.length,
      rejected: rejectIds.length,
      alreadyDecided,
      notFound,
      unrecognizedDecisions: unrecognizedCount,
      missingAmounts: missingAmountCodes,
      invalidAmounts: invalidAmountCodes,
      message: `Applied ${acceptIds.length + rejectIds.length} decisions. Notifications are queued and will reach participants shortly.`,
    });
  } catch (err) {
    console.error("Phase 2 spreadsheet import failed:", err);
    return NextResponse.json(
      { error: "Import failed partway through — some decisions above the failure point may already be applied. Check the queue below, then re-upload to safely retry (already-decided rows are skipped automatically)." },
      { status: 500 }
    );
  }
}
