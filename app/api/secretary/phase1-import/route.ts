import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// A batch of a few hundred rows (real Phase 1 volume) each doing a Supabase
// Auth create + a couple of table writes can run past the platform's
// default serverless timeout. Raise the ceiling for this route specifically
// (only takes effect on plans that allow it — Vercel still caps this per
// plan regardless of what's requested here).
export const maxDuration = 120;

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
  return v == null ? "" : String(v).trim();
}

// Same scheme as the staff bulk-import: lastname_projectcode, lowercased.
// project_code isn't known until the team row is inserted (the DB trigger
// generates it), so this can only be called after that insert succeeds.
function makePassword(leaderName: string, projectCode: string): string {
  const lastName = leaderName.trim().split(/\s+/).pop() || leaderName;
  const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, "") || "team";
  const cleanCode = projectCode.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${cleanLast}_${cleanCode}`;
}

// Aliases include both generic phrasing and the exact wording used on i2i's
// live Phase 1 Google Form, since Google exports response spreadsheets with
// the question text verbatim as the column header.
const REQUIRED_COLUMNS: Record<string, string[]> = {
  leaderName: ["Leader Name", "Team Leader Name", "Team Leader Full Name", "Full Name", "Name"],
  leaderEmail: ["Leader Email", "Team Leader Email", "Email", "Email Address", "Email ID"],
  leaderPhone: [
    "Leader Phone",
    "Team Leader Phone Number",
    "Phone",
    "Phone Number",
    "Mobile Number",
    "Contact Number",
  ],
  state: ["State"],
  city: ["City"],
  collegeName: ["College Name", "College/Institute Name", "Institute Name"],
  sector: ["Sector", "Sector Selection", "Which sector is your project in?"],
  projectName: ["Project Name", "Project Title"],
  problemStatement: ["Problem Statement"],
  proposedSolution: ["Proposed Solution", "Proposed solution (~150 words)"],
};

// Team Name and Target Beneficiaries aren't on the live Google Form at all
// (it never asks for either), so they're optional here with sensible
// defaults below rather than blocking every row on columns that don't exist.
const OPTIONAL_COLUMNS: Record<string, string[]> = {
  teamName: ["Team Name", "Project Team Name"],
  targetBeneficiaries: ["Target Beneficiaries"],
  teamSize: ["Team Size", "Number of Members", "No. of Members"],
  leaderGender: ["Leader Gender", "Gender"],
  leaderDob: ["Leader DOB", "Date of Birth", "DOB"],
  emergencyContactName: ["Emergency Contact Name"],
  emergencyContactPhone: ["Emergency Contact Phone"],
  heardAboutUs: ["Heard About Us", "How did you hear about I2I?"],
  collegeType: ["College Type"],
  facultyContactName: ["Faculty Contact Name", "Faculty / Point of Contact Name", "Faculty / Guide name"],
  facultyContactPhone: ["Faculty Contact Phone", "Faculty/ Guide contact number"],
  subTheme: ["Sub Theme", "Sub-theme"],
  innovationNotes: ["Innovation Notes", "What makes your approach unique?"],
  ideaStage: ["Idea Stage", "Current stage of your idea"],
  // The form only collects one combined "Contact" field per teammate (no
  // separate email), and calls them "Teammate 1/2" rather than "Member 2/3".
  member2Name: ["Member 2 Name", "Teammate 1: Name"],
  member2Email: ["Member 2 Email"],
  member2Phone: ["Member 2 Phone", "Teammate 1: Contact"],
  member2Year: ["Member 2 Year", "Member 2 Year of Study"],
  member3Name: ["Member 3 Name", "Teammate 2: Name"],
  member3Email: ["Member 3 Email"],
  // "Teamamte" matches a live typo in the form's own field name — kept so
  // the column is still found if that typo is ever fixed or not.
  member3Phone: ["Member 3 Phone", "Teammate 2: Contact", "Teamamte 2: Contact"],
  member3Year: ["Member 3 Year", "Member 3 Year of Study"],
};

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
      return NextResponse.json({ error: "Only the Secretary can bulk-import registrations" }, { status: 403 });
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file received. Attach the .xlsx export." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large — is this the right spreadsheet?" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch (err) {
      console.error("Phase 1 import: failed to parse workbook:", err);
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

    const cols: Record<string, number | null> = {};
    for (const [key, aliases] of Object.entries(REQUIRED_COLUMNS)) {
      cols[key] = findColumn(headerRow, ...aliases);
    }
    const missing = Object.entries(REQUIRED_COLUMNS)
      .filter(([key]) => !cols[key])
      .map(([, aliases]) => aliases[0]);
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required column(s): ${missing.join(", ")}. Rename your spreadsheet's headers to match one of the expected names and re-upload.`,
        },
        { status: 400 }
      );
    }
    for (const [key, aliases] of Object.entries(OPTIONAL_COLUMNS)) {
      cols[key] = findColumn(headerRow, ...aliases);
    }

    const admin = createAdminClient();
    const { data: sectors } = await admin.from("sectors").select("id, prefix, display_name");

    // The live form's option text doesn't exactly match either the DB
    // prefix or display_name for two of the six sectors — map those
    // specific known phrasings to their prefix before falling back to the
    // generic equality check.
    const SECTOR_FORM_ALIASES: Record<string, string> = {
      "3h-health, hunger & humanity(hhh)": "HHH",
      entrepreneurship: "ENT",
    };

    function findSector(value: string) {
      const v = value.trim().toLowerCase();
      const aliasPrefix = SECTOR_FORM_ALIASES[v]?.toLowerCase();
      return (sectors ?? []).find(
        (s) =>
          (aliasPrefix && s.prefix.toLowerCase() === aliasPrefix) ||
          s.prefix.toLowerCase() === v ||
          s.display_name.toLowerCase() === v
      );
    }

    const results: { email: string; status: "created" | "skipped" | "error"; detail: string }[] = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const get = (key: string) => cellText(row, cols[key]);

      const leaderName = get("leaderName");
      const leaderEmail = get("leaderEmail").toLowerCase();
      const leaderPhone = get("leaderPhone");
      const state = get("state");
      const city = get("city");
      const collegeName = get("collegeName");
      const sectorRaw = get("sector");
      const projectName = get("projectName");
      const problemStatement = get("problemStatement");
      const proposedSolution = get("proposedSolution");

      const isBlankRow =
        !leaderName && !leaderEmail && !projectName && !collegeName;
      if (isBlankRow) continue;

      // Neither column exists on the live form, so these are always
      // synthesized rather than validated as missing.
      const teamName = get("teamName") || `${leaderName}'s Team`;
      const targetBeneficiaries =
        get("targetBeneficiaries") || "Not collected during Phase 1 registration.";

      const missingRequired = [
        ["Leader Name", leaderName],
        ["Leader Email", leaderEmail],
        ["Leader Phone", leaderPhone],
        ["State", state],
        ["City", city],
        ["College Name", collegeName],
        ["Sector", sectorRaw],
        ["Project Name", projectName],
        ["Problem Statement", problemStatement],
        ["Proposed Solution", proposedSolution],
      ].filter(([, v]) => !v);
      if (missingRequired.length > 0) {
        results.push({
          email: leaderEmail || `(row ${rowNumber})`,
          status: "error",
          detail: `Missing: ${missingRequired.map(([label]) => label).join(", ")}.`,
        });
        continue;
      }

      const sector = findSector(sectorRaw);
      if (!sector) {
        results.push({ email: leaderEmail, status: "error", detail: `Sector "${sectorRaw}" not recognized.` });
        continue;
      }

      const members: { full_name: string; email: string; phone: string; year_of_study: string }[] = [];
      if (get("member2Name")) {
        members.push({
          full_name: get("member2Name"),
          email: get("member2Email"),
          phone: get("member2Phone"),
          year_of_study: get("member2Year"),
        });
      }
      if (get("member3Name")) {
        members.push({
          full_name: get("member3Name"),
          email: get("member3Email"),
          phone: get("member3Phone"),
          year_of_study: get("member3Year"),
        });
      }

      const teamSizeRaw = parseInt(get("teamSize"), 10);
      const teamSize =
        teamSizeRaw >= 1 && teamSizeRaw <= 3 ? teamSizeRaw : Math.min(3, members.length + 1);

      // Team row first — its insert trigger generates project_code, which
      // this import needs before it can build the lastname_projectcode
      // password (leader_auth_id is nullable, so linking it comes after).
      const { data: team, error: teamErr } = await admin
        .from("teams")
        .insert({
          team_name: teamName,
          team_size: teamSize,
          sector_id: sector.id,
          leader_name: leaderName,
          leader_email: leaderEmail,
          leader_phone: leaderPhone,
          leader_whatsapp_optin: true,
          leader_gender: get("leaderGender") || null,
          leader_dob: get("leaderDob") || null,
          emergency_contact_name: get("emergencyContactName") || null,
          emergency_contact_phone: get("emergencyContactPhone") || null,
          heard_about_us: get("heardAboutUs") || null,
          state,
          city,
          college_name: collegeName,
          college_type: get("collegeType") || null,
          faculty_contact_name: get("facultyContactName") || null,
          faculty_contact_phone: get("facultyContactPhone") || null,
          sub_theme: get("subTheme") || null,
          project_name: projectName,
          problem_statement: problemStatement,
          proposed_solution: proposedSolution,
          target_beneficiaries: targetBeneficiaries,
          innovation_notes: get("innovationNotes") || null,
          idea_stage: get("ideaStage") || null,
          consent_given: true,
        })
        .select("id, project_code")
        .single();

      if (teamErr || !team) {
        results.push({
          email: leaderEmail,
          status: teamErr?.code === "23505" ? "skipped" : "error",
          detail:
            teamErr?.code === "23505"
              ? "A team already registered with this email this year."
              : teamErr?.message ?? "Could not save this row.",
        });
        continue;
      }

      const password = makePassword(leaderName, team.project_code!);
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: leaderEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: leaderName },
      });

      if (authErr || !authData?.user) {
        // Compensate: don't leave a team with no way to log in.
        await admin.from("teams").delete().eq("id", team.id);
        results.push({
          email: leaderEmail,
          status: authErr?.message?.toLowerCase().includes("already been registered") ? "skipped" : "error",
          detail: authErr?.message ?? "Could not create the portal login for this row.",
        });
        continue;
      }

      await admin.from("teams").update({ leader_auth_id: authData.user.id }).eq("id", team.id);

      if (members.length > 0) {
        await admin.from("team_members").insert(
          members
            .filter((m) => m.full_name)
            .map((m) => ({
              team_id: team.id,
              full_name: m.full_name,
              email: m.email || null,
              phone: m.phone || null,
              year_of_study: m.year_of_study || null,
            }))
        );
      }

      // Queued, not sent synchronously — a large batch sending emails one by
      // one inside a single request risks the function timing out. The
      // existing daily notification cron drains this queue.
      await admin.from("notification_queue").insert({
        type: "registration_confirmed",
        channel: "email",
        recipient_email: leaderEmail,
        team_id: team.id,
        payload: {
          project_code: team.project_code,
          team_name: teamName,
          login_email: leaderEmail,
          login_password: password,
        },
        status: "pending",
      });

      results.push({
        email: leaderEmail,
        status: "created",
        detail: `${team.project_code} — password: ${password} (confirmation email queued).`,
      });
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: "Secretary",
      action: "phase1_spreadsheet_import",
      target_type: "teams",
      details: {
        created: results.filter((r) => r.status === "created").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        errors: results.filter((r) => r.status === "error").length,
      },
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Phase 1 spreadsheet import failed:", err);
    return NextResponse.json(
      { error: "Import failed partway through. Check the Phase 1 queue below to see what was already created before re-uploading." },
      { status: 500 }
    );
  }
}
