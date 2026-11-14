import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Exactly the fields the Team Info tab shows — never trust the request body
// for *which* columns to write, only for their new values. Deliberately
// excludes leader_email (tied to the login/auth account), project_code,
// sector, status, and anything else workflow-critical.
const EDITABLE_FIELDS = [
  "team_name",
  "leader_name",
  "leader_phone",
  "college_name",
  "department",
  "city",
  "district",
  "division",
  "state",
  "project_name",
  "problem_statement",
] as const;

const REQUIRED_FIELDS = new Set([
  "team_name",
  "leader_name",
  "leader_phone",
  "college_name",
  "city",
  "state",
  "project_name",
  "problem_statement",
]);

export async function POST(request: Request) {
  try {
    const authed = await createClient();
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Team is derived from the authenticated session, never from anything
    // the client sends — this is what rules out one participant editing
    // another's team.
    const { data: team } = await admin
      .from("teams")
      .select("id")
      .eq("leader_auth_id", user.id)
      .maybeSingle();
    if (!team) {
      return NextResponse.json({ error: "No team found for this account" }, { status: 404 });
    }

    const { data: editRequest } = await admin
      .from("edit_requests")
      .select("id, status")
      .eq("team_id", team.id)
      .eq("section", "team_info")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!editRequest) {
      return NextResponse.json(
        { error: "No approved edit request found. Raise a request and wait for the Secretary to approve it first." },
        { status: 403 }
      );
    }

    const updates: Record<string, string | null> = {};
    for (const field of EDITABLE_FIELDS) {
      if (!(field in body)) continue;
      const raw = body[field];
      const value = typeof raw === "string" ? raw.trim() : raw;
      if (REQUIRED_FIELDS.has(field) && (!value || typeof value !== "string")) {
        return NextResponse.json({ error: `"${field}" can't be left blank.` }, { status: 400 });
      }
      updates[field] = typeof value === "string" ? value : null;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const { data: updatedTeam, error: updateErr } = await admin
      .from("teams")
      .update(updates)
      .eq("id", team.id)
      .select(
        "id, team_name, leader_name, leader_phone, college_name, department, city, district, division, state, project_name, problem_statement"
      )
      .single();
    if (updateErr) {
      console.error("apply-team-edit: team update failed:", updateErr);
      return NextResponse.json({ error: "Couldn't save your changes. Try again." }, { status: 500 });
    }

    // Guarded on status='approved' so a duplicate/concurrent save can't
    // apply the same approval twice.
    const { error: markErr } = await admin
      .from("edit_requests")
      .update({ status: "applied" })
      .eq("id", editRequest.id)
      .eq("status", "approved");
    if (markErr) {
      console.error("apply-team-edit: failed to mark request applied:", markErr);
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: "Participant",
      action: "team_edit_applied",
      target_type: "teams",
      target_id: team.id,
      details: { edit_request_id: editRequest.id, fields: Object.keys(updates) },
    });

    return NextResponse.json({ team: updatedTeam });
  } catch (err) {
    console.error("apply-team-edit failed:", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
