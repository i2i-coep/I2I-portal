import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";

const HEADERS = [
  { header: "Date Range", key: "date_range", width: 20 },
  { header: "Week", key: "week", width: 8 },
  { header: "Focus Area / Milestone", key: "focus_area", width: 34 },
  { header: "Key Task", key: "key_task", width: 40 },
  { header: "Mentor's Role / Assistance", key: "mentor_role", width: 34 },
  { header: "Done", key: "done", width: 10 },
];

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFC9741B" },
};

// Any logged-in participant can download this — it's a blank template, no
// team-specific data to protect.
export async function GET() {
  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "I2I Portal";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Timeline");
  sheet.columns = HEADERS;
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });
  sheet.getRow(1).height = 20;
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // One worked example row so it's obvious what goes where, plus a handful
  // of blank rows to fill in.
  sheet.addRow({
    date_range: "1 Nov – 7 Nov",
    week: 1,
    focus_area: "Project Initiation & Concept Understanding",
    key_task: "Define project aim and scope",
    mentor_role: "Validate problem statement",
    done: "FALSE",
  });
  for (let i = 0; i < 20; i++) sheet.addRow({});

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="i2i-timeline-template.xlsx"`,
    },
  });
}
