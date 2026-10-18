import nodemailer, { type Transporter } from "nodemailer";

// Provider: SMTP (Google Workspace or Gmail). Used when EMAIL_PROVIDER=smtp.
// Workspace gives ~2000 emails/day free; personal Gmail ~500/day.
// Requires a Google "App Password" (not your normal login password) — set
// SMTP_USER and SMTP_APP_PASSWORD in your environment.

let transporter: Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendViaSmtp(to: string, subject: string, body: string) {
  await getTransporter().sendMail({
    from: process.env.NOTIFICATION_FROM_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    text: body,
  });
}
