import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MEETING_TYPES = ["Meet 1", "Meet 2", "Meet 3", "Meet 4", "Meet 5", "Meet 6", "Meet 7", "Meet 8"];

// Ambassador-only: officially schedules a meeting (date, time, a manually
// pasted Google Meet link — see 43_mentorship_meeting_scheduling.sql for
// why this isn't auto-generated via the Calendar API) and notifies the
// mentor and the team leader in-app. Routed through the server (not a
// direct client insert) because it also has to write into another user's
// notification inbox, which in_app_notifications' RLS deliberately doesn't
// allow a plain authenticated user to do.
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
    const teamId = body?.teamId;
    const meetingType = body?.meetingType;
    const meetingDate = body?.meetingDate;
    const meetingTime = body?.meetingTime;
    const meetLink = typeof body?.meetLink === "string" ? body.meetLink.trim() : "";
    const proposalId = typeof body?.proposalId === "string" ? body.proposalId : null;

    if (!teamId || typeof teamId !== "string") {
      return NextResponse.json({ error: "Missing teamId" }, { status: 400 });
    }
    if (!MEETING_TYPES.includes(meetingType)) {
      return NextResponse.json({ error: "Invalid meeting type" }, { status: 400 });
    }
    if (!meetingDate || !meetingTime) {
      return NextResponse.json({ error: "Missing meeting date/time" }, { status: 400 });
    }
    if (!meetLink || !/^https:\/\/meet\.google\.com\//.test(meetLink)) {
      return NextResponse.json({ error: "Paste a valid Google Meet link (https://meet.google.com/...)" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Authorize: caller must be the ambassador assigned to this team (or Secretary).
    const { data: assignment } = await admin
      .from("project_assignments")
      .select("id")
      .eq("team_id", teamId)
      .eq("staff_id", user.id)
      .eq("assignment_role", "ambassador")
      .maybeSingle();
    const { data: staffRow } = await admin.from("staff_profiles").select("role").eq("id", user.id).maybeSingle();
    const isSecretary = staffRow?.role === "secretary";
    if (!assignment && !isSecretary) {
      return NextResponse.json({ error: "Only the assigned Ambassador can raise a meeting for this team" }, { status: 403 });
    }

    const { data: team } = await admin
      .from("teams")
      .select("id, project_code, project_name, leader_auth_id")
      .eq("id", teamId)
      .maybeSingle();
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const { data: mentorAssignment } = await admin
      .from("project_assignments")
      .select("staff_id")
      .eq("team_id", teamId)
      .eq("assignment_role", "mentor")
      .maybeSingle();

    const { data: meeting, error: meetingErr } = await admin
      .from("meetings")
      .insert({
        team_id: teamId,
        raised_by: user.id,
        meeting_type: meetingType,
        meeting_name: meetingType,
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        meet_link: meetLink,
        status: "awaiting_grading",
      })
      .select("id")
      .single();
    if (meetingErr || !meeting) {
      return NextResponse.json({ error: meetingErr?.message ?? "Could not create the meeting" }, { status: 500 });
    }

    if (proposalId) {
      await admin.from("meeting_proposals").update({ status: "accepted" }).eq("id", proposalId);
    }

    const title = `${meetingType} scheduled for ${team.project_code ?? team.project_name}`;
    const bodyText = `${meetingDate} at ${meetingTime} — join from your portal when it's time.`;
    const notifications: { recipient_auth_id: string; type: string; title: string; body: string; team_id: string; meeting_id: string }[] = [];
    if (team.leader_auth_id) {
      notifications.push({
        recipient_auth_id: team.leader_auth_id,
        type: "meeting_raised",
        title,
        body: bodyText,
        team_id: teamId,
        meeting_id: meeting.id,
      });
    }
    if (mentorAssignment?.staff_id) {
      notifications.push({
        recipient_auth_id: mentorAssignment.staff_id,
        type: "meeting_raised",
        title,
        body: bodyText,
        team_id: teamId,
        meeting_id: meeting.id,
      });
    }
    if (notifications.length > 0) {
      await admin.from("in_app_notifications").insert(notifications);
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: "Ambassador",
      action: "meeting_raised",
      target_type: "meetings",
      target_id: meeting.id,
      details: { team_id: teamId, meeting_type: meetingType, meeting_date: meetingDate, meeting_time: meetingTime },
    });

    return NextResponse.json({ success: true, meetingId: meeting.id });
  } catch (err) {
    console.error("Raise meeting failed:", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
