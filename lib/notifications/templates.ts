// Central place for all notification copy. Keep this the ONLY place wording
// lives, so changing a message doesn't mean hunting through trigger logic.

type Payload = Record<string, unknown>;

// Admin-edited templates (email_templates table) use {{variable}} placeholders
// instead of JS template literals, since they're plain text stored in the DB.
export function renderCustomTemplate(
  subject: string,
  body: string,
  payload: Payload
): { subject: string; body: string } {
  const fill = (text: string) =>
    text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      const value = payload[key];
      return value === undefined || value === null ? "" : String(value);
    });
  return { subject: fill(subject), body: fill(body) };
}

export function emailTemplate(type: string, payload: Payload): { subject: string; body: string } {
  switch (type) {
    case "registration_confirmed":
      // NOTE: this includes the plaintext password in the email body, per
      // explicit product decision (avoid any dependency on the participant
      // receiving/clicking an email to access their portal). This is a
      // known security tradeoff — anyone with access to this inbox later
      // (or a compromised mail account) also gets portal access. If you
      // revisit this, the safer version omits payload.login_password and
      // just confirms the login email, since the participant already set
      // the password themselves during registration and should remember it.
      return {
        subject: `Registration confirmed — ${payload.project_code}`,
        body: `Your team's registration for I2I 2026-27 is confirmed.\n\nProject code: ${payload.project_code}\nTeam: ${payload.team_name}\n\nYour portal login:\nEmail: ${payload.login_email}\nPassword: ${payload.login_password}\n\nLog in at: ${process.env.NEXT_PUBLIC_SITE_URL}/login?portal=participant\n\nKeep this email for your records. We recommend changing your password after your first login.`,
      };
    case "leader_invite":
      return {
        subject: "Welcome to I2I — set your portal password",
        body: `Your team has been registered for I2I 2026-27.\n\nProject code: ${payload.project_code}\nTeam: ${payload.team_name}\n\nClick this link to set your password and access the portal:\n${payload.link}\n\nThis link is valid for a limited time — if it expires, use "Forgot password" on the login page.`,
      };
    case "phase2_shortlisted":
      return {
        subject: `Your project ${payload.project_code} has been shortlisted for Phase 3`,
        body: `Congratulations! ${payload.team_name} (${payload.project_code}) has been shortlisted. Log in to the I2I portal to complete your Phase 3 submission — bills, pitch details, and bank information.`,
      };
    case "mentor_assigned":
      return {
        subject: `You've been assigned as mentor for ${payload.project_code}`,
        body: `Hi ${payload.staff_name}, you've been assigned as mentor for project ${payload.project_code} — "${payload.team_name}". Log in to the portal to view the project details.`,
      };
    case "ambassador_assigned":
      return {
        subject: `You've been assigned as ambassador for ${payload.project_code}`,
        body: `Hi ${payload.staff_name}, you've been assigned as ambassador for project ${payload.project_code} — "${payload.team_name}". Log in to the portal to view the project details.`,
      };
    case "funding_status_update":
      return {
        subject: `Funding update for ${payload.project_code}`,
        body: `Your funding request status for ${payload.project_code} is now: ${payload.status}.${
          payload.amount_approved ? ` Approved amount: ₹${payload.amount_approved}.` : ""
        }`,
      };
    case "phase3_shortlisted":
      return {
        subject: `🎉 ${payload.project_code} has been selected for Phase 3!`,
        body: `Congratulations! ${payload.team_name} (${payload.project_code}) has been selected for Phase 3 — Mentorship. Log in to the I2I portal to see your assigned mentor and ambassador, and start logging your daily progress.`,
      };
    default:
      return { subject: "I2I Portal Update", body: "You have a new update on the I2I portal." };
  }
}

// Reference copy of the hardcoded defaults above, in {{variable}} form, for
// the Secretary's Email Templates editor (components/secretary/
// email-templates-panel.tsx) to show/prefill "what would send if you don't
// customize this". Editing here does NOT change what actually sends — that
// still requires the Secretary to save a row in the email_templates table.
export const EMAIL_TEMPLATE_TYPES: {
  type: string;
  label: string;
  defaultSubject: string;
  defaultBody: string;
  variables: string[];
}[] = [
  {
    type: "registration_confirmed",
    label: "Registration confirmed",
    defaultSubject: "Registration confirmed — {{project_code}}",
    defaultBody:
      "Your team's registration for I2I 2026-27 is confirmed.\n\nProject code: {{project_code}}\nTeam: {{team_name}}\n\nYour portal login:\nEmail: {{login_email}}\nPassword: {{login_password}}\n\nLog in at: {{site_url}}/login?portal=participant\n\nKeep this email for your records. We recommend changing your password after your first login.",
    variables: ["project_code", "team_name", "login_email", "login_password", "site_url"],
  },
  {
    type: "leader_invite",
    label: "Leader invite (set password)",
    defaultSubject: "Welcome to I2I — set your portal password",
    defaultBody:
      'Your team has been registered for I2I 2026-27.\n\nProject code: {{project_code}}\nTeam: {{team_name}}\n\nClick this link to set your password and access the portal:\n{{link}}\n\nThis link is valid for a limited time — if it expires, use "Forgot password" on the login page.',
    variables: ["project_code", "team_name", "link"],
  },
  {
    type: "phase2_shortlisted",
    label: "Phase 3 shortlisted (Proposal & Funding)",
    defaultSubject: "Your project {{project_code}} has been shortlisted for Phase 3",
    defaultBody:
      "Congratulations! {{team_name}} ({{project_code}}) has been shortlisted. Log in to the I2I portal to complete your Phase 3 submission — bills, pitch details, and bank information.",
    variables: ["project_code", "team_name"],
  },
  {
    type: "mentor_assigned",
    label: "Mentor assigned",
    defaultSubject: "You've been assigned as mentor for {{project_code}}",
    defaultBody:
      'Hi {{staff_name}}, you\'ve been assigned as mentor for project {{project_code}} — "{{team_name}}". Log in to the portal to view the project details.',
    variables: ["staff_name", "project_code", "team_name"],
  },
  {
    type: "ambassador_assigned",
    label: "Ambassador assigned",
    defaultSubject: "You've been assigned as ambassador for {{project_code}}",
    defaultBody:
      'Hi {{staff_name}}, you\'ve been assigned as ambassador for project {{project_code}} — "{{team_name}}". Log in to the portal to view the project details.',
    variables: ["staff_name", "project_code", "team_name"],
  },
  {
    type: "funding_status_update",
    label: "Funding status update",
    defaultSubject: "Funding update for {{project_code}}",
    defaultBody:
      "Your funding request status for {{project_code}} is now: {{status}}. Approved amount: ₹{{amount_approved}}.",
    variables: ["project_code", "status", "amount_approved"],
  },
  {
    type: "phase3_shortlisted",
    label: "Phase 3 shortlisted (Mentorship)",
    defaultSubject: "🎉 {{project_code}} has been selected for Phase 3!",
    defaultBody:
      "Congratulations! {{team_name}} ({{project_code}}) has been selected for Phase 3 — Mentorship. Log in to the I2I portal to see your assigned mentor and ambassador, and start logging your daily progress.",
    variables: ["project_code", "team_name"],
  },
];

export function whatsappTemplate(type: string, payload: Payload): string {
  switch (type) {
    case "team_notified_of_mentor":
      return `Your ${payload.role} for project ${payload.project_code} is ${payload.staff_name}. Log in to the I2I portal for details.`;
    case "phase2_shortlisted":
      return `Congrats! Your project ${payload.project_code} has been shortlisted for Phase 3. Log in to the I2I portal to continue.`;
    case "phase3_shortlisted":
      return `🎉 Your project ${payload.project_code} has been selected for Phase 3! Log in to the I2I portal to see your mentor and ambassador.`;
    default:
      return "You have a new update on the I2I portal.";
  }
}
