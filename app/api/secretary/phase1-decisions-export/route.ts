import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "phase1-uploads";
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 14; // 14 days — enough for a review cycle

type Row = {
  project_code: string | null;
  project_name: string;
  college_name: string;
  sector_label: string;
  leader_name: string;
  leader_email: string;
  score: number | null;
  reviewer_name: string | null;
  status: string;
  pitch_deck_path: string | null;
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFC9741B" },
};

export async function GET() {
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
      return NextResponse.json({ error: "Only the Secretary can export this data" }, { status: 403 });
    }

    const admin = createAdminClient();

    const [{ data: teamsRaw }, { data: submissions }, { data: assignments }, { data: reviewers }] =
      await Promise.all([
        admin
          .from("teams")
          .select("id, project_code, project_name, college_name, leader_name, leader_email, status, sectors(display_name)")
          .order("created_at", { ascending: true }),
        admin.from("phase1_submissions").select("team_id, score, pitch_deck_url"),
        admin.from("phase1_reviewer_assignments").select("team_id, staff_id"),
        admin.from("staff_profiles").select("id, full_name"),
      ]);

    const submissionByTeam = new Map((submissions ?? []).map((s) => [s.team_id, s]));
    const assignmentByTeam = new Map((assignments ?? []).map((a) => [a.team_id, a.staff_id]));
    const reviewerNameById = new Map((reviewers ?? []).map((r) => [r.id, r.full_name]));

    const rows: Row[] = (teamsRaw ?? [])
      .filter((t) => ["registered", "under_review"].includes(t.status)) // only teams still awaiting a Phase 1 decision
      .map((t) => {
        const submission = submissionByTeam.get(t.id);
        const reviewerId = assignmentByTeam.get(t.id);
        return {
          project_code: t.project_code,
          project_name: t.project_name,
          college_name: t.college_name,
          sector_label: (t.sectors as unknown as { display_name: string } | null)?.display_name ?? "—",
          leader_name: t.leader_name,
          leader_email: t.leader_email,
          score: submission?.score ?? null,
          reviewer_name: reviewerId ? (reviewerNameById.get(reviewerId) ?? "Unknown") : null,
          status: t.status,
          pitch_deck_path: submission?.pitch_deck_url ?? null,
        };
      })
      // Highest score first so the Secretary can see the cut line for "top
      // 150" by scrolling down, unscored rows pushed to the bottom.
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

    const paths = rows.map((r) => r.pitch_deck_path).filter((p): p is string => !!p);
    const signedUrlByPath = new Map<string, string>();
    if (paths.length > 0) {
      try {
        const { data: signed, error: signErr } = await admin.storage
          .from(BUCKET)
          .createSignedUrls(paths, SIGNED_URL_EXPIRY_SECONDS);
        if (signErr) throw signErr;
        for (const entry of signed ?? []) {
          if (entry.signedUrl && entry.path) signedUrlByPath.set(entry.path, entry.signedUrl);
        }
      } catch (err) {
        console.error("Phase 1 export: batch signed-url generation failed:", err);
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "I2I Portal";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Phase 1 Decisions");
    sheet.columns = [
      { header: "Project Code", key: "project_code", width: 16 },
      { header: "Decision", key: "decision", width: 14 },
      { header: "Score (/10)", key: "score", width: 12 },
      { header: "Reviewer", key: "reviewer_name", width: 20 },
      { header: "Project Name", key: "project_name", width: 30 },
      { header: "College", key: "college_name", width: 26 },
      { header: "Sector", key: "sector_label", width: 24 },
      { header: "Leader Name", key: "leader_name", width: 20 },
      { header: "Leader Email", key: "leader_email", width: 26 },
      { header: "Pitch Deck", key: "pitch_deck_link", width: 14 },
    ];
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    sheet.getRow(1).height = 20;
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: "J1" };

    for (const r of rows) {
      const pdfLink = r.pitch_deck_path
        ? signedUrlByPath.get(r.pitch_deck_path)
          ? { text: "View", hyperlink: signedUrlByPath.get(r.pitch_deck_path)! }
          : "Link unavailable"
        : "Not submitted";

      const newRow = sheet.addRow({
        project_code: r.project_code ?? "Pending",
        decision: "",
        score: r.score ?? "",
        reviewer_name: r.reviewer_name ?? "Unassigned",
        project_name: r.project_name,
        college_name: r.college_name,
        sector_label: r.sector_label,
        leader_name: r.leader_name,
        leader_email: r.leader_email,
        pitch_deck_link: pdfLink,
      });

      const decisionCell = newRow.getCell("decision");
      decisionCell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Accept,Reject"'],
        showErrorMessage: true,
        errorStyle: "warning",
        error: 'Please choose "Accept" or "Reject" from the dropdown.',
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `i2i-phase1-decisions-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Phase 1 decisions export failed:", err);
    return NextResponse.json(
      { error: "Export failed unexpectedly. Try again — if it persists, contact the developer." },
      { status: 500 }
    );
  }
}
