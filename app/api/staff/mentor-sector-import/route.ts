import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_PRIORITY = 6;

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

// Password scheme: lastname_<first 4 chars of email local-part>, lowercased —
// no project code exists yet at import time (that's the whole point: mentors
// are matched to a project by sector preference afterwards, not pre-assigned).
function makePassword(lastName: string, email: string): string {
  const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const localPart = email.split("@")[0] ?? "";
  const cleanLocal = localPart.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4);
  return `${cleanLast}_${cleanLocal}`;
}

type SectorRow = { id: string; prefix: string; display_name: string };

function resolveSector(raw: string, sectors: SectorRow[]): SectorRow | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  let match = sectors.find((s) => s.prefix.toLowerCase() === text || s.display_name.toLowerCase() === text);
  if (match) return match;
  match = sectors.find(
    (s) => s.display_name.toLowerCase().includes(text) || text.includes(s.display_name.toLowerCase())
  );
  return match ?? null;
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
      return NextResponse.json({ error: "Only the Secretary can bulk-import mentors" }, { status: 403 });
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file received. Attach the .xlsx list." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large — is this the right spreadsheet?" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch (err) {
      console.error("Mentor sector import: failed to parse workbook:", err);
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
    const priorityCols = Array.from({ length: MAX_PRIORITY }, (_, i) =>
      findColumn(headerRow, `Priority ${i + 1}`, `Preference ${i + 1}`)
    );

    if (!firstNameCol || !lastNameCol || !emailCol || !priorityCols[0]) {
      return NextResponse.json(
        {
          error:
            'Expected columns "First Name", "Last Name", "Email", and at least "Priority 1" (up to "Priority 6") — one or more wasn\'t found.',
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: sectorsRaw } = await admin.from("sectors").select("id, prefix, display_name");
    const sectors: SectorRow[] = sectorsRaw ?? [];

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
      if (!firstName && !lastName && !email) continue; // blank row

      if (!firstName || !lastName || !email) {
        results.push({
          email: email || `(row ${rowNumber})`,
          status: "error",
          detail: "Missing First Name, Last Name, or Email.",
        });
        continue;
      }

      const rankedSectors: { sector: SectorRow; priority: number }[] = [];
      const unrecognized: string[] = [];
      priorityCols.forEach((col, i) => {
        const text = cellText(row, col);
        if (!text) return;
        const sector = resolveSector(text, sectors);
        if (sector) rankedSectors.push({ sector, priority: i + 1 });
        else unrecognized.push(text);
      });

      if (rankedSectors.length === 0) {
        results.push({ email, status: "error", detail: "No recognizable sector found in Priority 1-6 columns." });
        continue;
      }

      const fullName = `${firstName} ${lastName}`;
      const password = makePassword(lastName, email);

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
        role: "mentor",
      });
      if (profileErr) {
        results.push({ email, status: "error", detail: `Account created but profile failed: ${profileErr.message}` });
        continue;
      }

      const { error: prefErr } = await admin.from("mentor_sector_preferences").insert(
        rankedSectors.map((r) => ({ staff_id: authData.user.id, sector_id: r.sector.id, priority: r.priority }))
      );

      const prefSummary = rankedSectors.map((r) => `${r.priority}. ${r.sector.prefix}`).join(", ");
      const unrecognizedNote = unrecognized.length > 0 ? ` (unrecognized: ${unrecognized.join(", ")})` : "";

      results.push({
        email,
        status: "created",
        detail: prefErr
          ? `Account created (password: ${password}) but couldn't save sector preferences: ${prefErr.message}`
          : `Account created (password: ${password}). Preferences: ${prefSummary}${unrecognizedNote}.`,
      });
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: "Secretary",
      action: "mentor_sector_import",
      target_type: "staff_profiles",
      details: {
        created: results.filter((r) => r.status === "created").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        errors: results.filter((r) => r.status === "error").length,
      },
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Mentor sector import failed:", err);
    return NextResponse.json(
      { error: "Import failed partway through. Check Users & Access below to see what was already created before re-uploading." },
      { status: 500 }
    );
  }
}
