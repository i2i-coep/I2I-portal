import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function findColumn(headerRow: ExcelJS.Row, ...names: string[]): number | null {
  let found: number | null = null;
  headerRow.eachCell((cell, colNumber) => {
    const text = String(cell.value ?? "").trim().toLowerCase();
    if (names.some((n) => n.toLowerCase() === text)) found = colNumber;
  });
  return found;
}

function cellText(row: ExcelJS.Row, col: number | null): string {
  if (!col) return "";
  const v = row.getCell(col).value;
  if (v == null) return "";
  if (typeof v === "object" && !(v instanceof Date)) {
    // ExcelJS represents hyperlinks, rich text, and formulas as objects
    // rather than plain strings — e.g. typing an email directly into a
    // cell often gets auto-converted to a hyperlink by Excel/Sheets.
    // Pull out the actual text instead of letting it stringify to
    // "[object Object]", which silently corrupts the value.
    const obj = v as unknown as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text.trim();
    if (Array.isArray(obj.richText)) {
      return (obj.richText as { text: string }[]).map((r) => r.text).join("").trim();
    }
    if (obj.result != null) return String(obj.result).trim();
    if (typeof obj.hyperlink === "string") return obj.hyperlink.replace(/^mailto:/i, "").trim();
    return "";
  }
  return String(v).trim();
}

// Password scheme per the Secretary's spec: lastname_projectcode, lowercased.
function makePassword(lastName: string, projectCode: string): string {
  const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanCode = projectCode.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${cleanLast}_${cleanCode}`;
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
      return NextResponse.json({ error: "Only the Secretary can bulk-import staff" }, { status: 403 });
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    const role = formData?.get("role");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file received. Attach the .xlsx list." }, { status: 400 });
    }
    if (role !== "ambassador") {
      return NextResponse.json(
        { error: "Mentors are imported with sector preferences — use the Mentors spreadsheet uploader above." },
        { status: 400 }
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large — is this the right spreadsheet?" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch (err) {
      console.error("Staff bulk import: failed to parse workbook:", err);
      return NextResponse.json(
        { error: "Couldn't read this file as an Excel spreadsheet (.xlsx)." },
        { status: 400 }
      );
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "The spreadsheet has no sheets." }, { status: 400 });
    }
    const headerRow = sheet.getRow(1);
    const firstNameCol = findColumn(headerRow, "First Name", "First name");
    const lastNameCol = findColumn(headerRow, "Last Name", "Last name");
    const emailCol = findColumn(headerRow, "Email", "Email ID", "Mail ID");
    const projectCodeCol = findColumn(headerRow, "Project Code", "Project code");

    if (!firstNameCol || !lastNameCol || !emailCol || !projectCodeCol) {
      return NextResponse.json(
        {
          error:
            'Expected columns "First Name", "Last Name", "Email", and "Project Code" (used to set the initial password and assignment) — one or more wasn\'t found.',
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const results: {
      email: string;
      status: "created" | "skipped" | "error";
      detail: string;
    }[] = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const firstName = cellText(row, firstNameCol);
      const lastName = cellText(row, lastNameCol);
      const email = cellText(row, emailCol).toLowerCase();
      const projectCode = cellText(row, projectCodeCol).toUpperCase();
      if (!firstName && !lastName && !email && !projectCode) continue; // blank row

      if (!firstName || !lastName || !email || !projectCode) {
        results.push({
          email: email || `(row ${rowNumber})`,
          status: "error",
          detail: "Missing First Name, Last Name, Email, or Project Code.",
        });
        continue;
      }

      const { data: team } = await admin
        .from("teams")
        .select("id")
        .eq("project_code", projectCode)
        .maybeSingle();
      if (!team) {
        results.push({ email, status: "error", detail: `Project code "${projectCode}" not found.` });
        continue;
      }

      const fullName = `${firstName} ${lastName}`;
      const password = makePassword(lastName, projectCode);

      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (authErr || !authData?.user) {
        results.push({
          email,
          status: authErr?.message?.toLowerCase().includes("already been registered") ? "skipped" : "error",
          detail: authErr?.message ?? "Account creation failed.",
        });
        continue;
      }

      const { error: profileErr } = await admin.from("staff_profiles").insert({
        id: authData.user.id,
        full_name: fullName,
        email,
        role,
      });
      if (profileErr) {
        results.push({ email, status: "error", detail: `Account created but profile failed: ${profileErr.message}` });
        continue;
      }

      const { error: assignErr } = await admin
        .from("project_assignments")
        .insert({ team_id: team.id, staff_id: authData.user.id, assignment_role: role });

      results.push({
        email,
        status: "created",
        detail: assignErr
          ? `Account created (password: ${password}) but couldn't assign to ${projectCode}: ${assignErr.message}`
          : `Account created (password: ${password}), assigned to ${projectCode}.`,
      });
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: "Secretary",
      action: `bulk_import_${role}`,
      target_type: "staff_profiles",
      details: {
        created: results.filter((r) => r.status === "created").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        errors: results.filter((r) => r.status === "error").length,
      },
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Staff bulk import failed:", err);
    return NextResponse.json(
      { error: "Import failed partway through. Check Users & Access below to see what was already created before re-uploading." },
      { status: 500 }
    );
  }
}
