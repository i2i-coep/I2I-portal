import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Team = { id: string; project_code: string | null; team_name: string; sector_id: string };
type Sector = { id: string; prefix: string; display_name: string };
type Mentor = { id: string; full_name: string; current_projects: number };
type Pref = { staff_id: string; sector_id: string; priority: number };

export async function POST() {
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
      return NextResponse.json({ error: "Only the Secretary can run auto-match" }, { status: 403 });
    }

    const admin = createAdminClient();

    const [{ data: sectorsRaw }, { data: fundedRaw }, { data: assignmentsRaw }, { data: mentorsRaw }, { data: prefsRaw }] =
      await Promise.all([
        admin.from("sectors").select("id, prefix, display_name"),
        admin
          .from("phase2_applications")
          .select("team_id, funding_status, teams(id, project_code, team_name, sector_id)")
          .in("funding_status", ["approved", "partial"]),
        admin.from("project_assignments").select("team_id, staff_id, assignment_role"),
        admin.from("staff_profiles").select("id, full_name").eq("role", "mentor").eq("is_active", true),
        admin.from("mentor_sector_preferences").select("staff_id, sector_id, priority").order("priority", { ascending: true }),
      ]);

    const sectors: Sector[] = sectorsRaw ?? [];
    const sectorById = new Map(sectors.map((s) => [s.id, s]));

    const mentoredTeamIds = new Set(
      (assignmentsRaw ?? []).filter((a) => a.assignment_role === "mentor").map((a) => a.team_id)
    );
    const mentorCurrentCount = new Map<string, number>();
    for (const a of assignmentsRaw ?? []) {
      if (a.assignment_role !== "mentor") continue;
      mentorCurrentCount.set(a.staff_id, (mentorCurrentCount.get(a.staff_id) ?? 0) + 1);
    }

    const candidateTeams: Team[] = (fundedRaw ?? [])
      .map((f) => f.teams as unknown as { id: string; project_code: string | null; team_name: string; sector_id: string } | null)
      .filter((t): t is Team => !!t)
      .filter((t) => !mentoredTeamIds.has(t.id));

    if (candidateTeams.length === 0) {
      return NextResponse.json({
        matched: [],
        unmatched: [],
        message: "No funded projects are currently waiting for a mentor.",
      });
    }

    const mentors: Mentor[] = (mentorsRaw ?? []).map((m) => ({
      id: m.id,
      full_name: m.full_name,
      current_projects: mentorCurrentCount.get(m.id) ?? 0,
    }));

    const prefsByMentor = new Map<string, Pref[]>();
    for (const p of (prefsRaw ?? []) as Pref[]) {
      const list = prefsByMentor.get(p.staff_id) ?? [];
      list.push(p);
      prefsByMentor.set(p.staff_id, list);
    }

    // Pool of teams still needing a mentor, grouped by sector — earliest
    // candidate first (stable array order from the query, which is fine
    // since we don't re-order it).
    const teamPoolBySector = new Map<string, Team[]>();
    for (const t of candidateTeams) {
      const list = teamPoolBySector.get(t.sector_id) ?? [];
      list.push(t);
      teamPoolBySector.set(t.sector_id, list);
    }

    const remainingCapacity = new Map(mentors.map((m) => [m.id, 3 - m.current_projects]));
    const matches: { team: Team; mentor: Mentor; priority: number }[] = [];

    for (let priority = 1; priority <= 6; priority++) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const mentor of mentors) {
          if ((remainingCapacity.get(mentor.id) ?? 0) <= 0) continue;
          const pref = (prefsByMentor.get(mentor.id) ?? []).find((p) => p.priority === priority);
          if (!pref) continue;
          const pool = teamPoolBySector.get(pref.sector_id);
          if (!pool || pool.length === 0) continue;
          const team = pool.shift()!;
          matches.push({ team, mentor, priority });
          remainingCapacity.set(mentor.id, (remainingCapacity.get(mentor.id) ?? 0) - 1);
          changed = true;
        }
      }
    }

    if (matches.length > 0) {
      const { error: insertErr } = await admin.from("project_assignments").insert(
        matches.map((m) => ({ team_id: m.team.id, staff_id: m.mentor.id, assignment_role: "mentor" }))
      );
      if (insertErr) {
        console.error("Mentor auto-match: insert failed:", insertErr);
        return NextResponse.json({ error: `Matching computed but saving failed: ${insertErr.message}` }, { status: 500 });
      }
    }

    const matchedTeamIds = new Set(matches.map((m) => m.team.id));
    const unmatchedTeams = candidateTeams.filter((t) => !matchedTeamIds.has(t.id));

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: "Secretary",
      action: "mentor_sector_auto_match",
      target_type: "project_assignments",
      details: { matched: matches.length, unmatched: unmatchedTeams.length },
    });

    return NextResponse.json({
      matched: matches.map((m) => ({
        project_code: m.team.project_code,
        team_name: m.team.team_name,
        sector_prefix: sectorById.get(m.team.sector_id)?.prefix ?? "—",
        mentor_name: m.mentor.full_name,
        priority_used: m.priority,
      })),
      unmatched: unmatchedTeams.map((t) => ({
        project_code: t.project_code,
        team_name: t.team_name,
        sector_prefix: sectorById.get(t.sector_id)?.prefix ?? "—",
      })),
      message:
        matches.length === 0
          ? "No matches could be made — no mentor has this sector in their preferences with remaining capacity."
          : `Matched ${matches.length} project${matches.length === 1 ? "" : "s"} to a mentor.${
              unmatchedTeams.length > 0 ? ` ${unmatchedTeams.length} still need a manual assignment below.` : ""
            }`,
    });
  } catch (err) {
    console.error("Mentor auto-match failed:", err);
    return NextResponse.json({ error: "Auto-match failed unexpectedly. Try again." }, { status: 500 });
  }
}
