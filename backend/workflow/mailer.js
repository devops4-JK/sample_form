const nodemailer = require("nodemailer");

/**
 * Email through the organisation's own mail server (SMTP), set in .env:
 *
 *   SMTP_HOST=smtp.office365.com      the mail server
 *   SMTP_PORT=587                     587 (STARTTLS) or 465 (SSL)
 *   SMTP_SECURE=false                 true only for port 465
 *   SMTP_USER=forms@yourcompany.com
 *   SMTP_PASS=…                       an app password, never a personal one
 *   SMTP_FROM="Company Store Forms <forms@yourcompany.com>"
 *
 * Without SMTP_HOST the email automations show as "not set up" and nothing
 * is sent. Certificates are always checked.
 */

let transport = null;

const isConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
const fromAddress = () => process.env.SMTP_FROM || "";

function transporter() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      requireTLS: port === 587,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    });
  }
  return transport;
}

/** Sends one message. Resolves { ok, error }. */
async function send({ to, subject, html, text, replyTo }) {
  if (!isConfigured()) return { ok: false, error: "Email is not set up on the server (SMTP_HOST in .env)." };
  try {
    await transporter().sendMail({
      from: fromAddress(),
      to,
      replyTo,
      // One line, no control characters: nothing can be slipped into the headers.
      subject: String(subject || "").replace(/[\r\n\u0000-\u001F]+/g, " ").slice(0, 200),
      text,
      html,
    });
    return { ok: true, error: "" };
  } catch (err) {
    return { ok: false, error: `Mail server: ${String(err.message || err).slice(0, 200)}` };
  }
}

module.exports = { send, isConfigured, fromAddress };