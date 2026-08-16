/**
 * Email sending utility.
 *
 * Currently logs reset links to the console in development.
 * To enable real email delivery, set EMAIL_FROM in .env and connect
 * a provider (Resend, SendGrid, Nodemailer, etc.) in the sendEmail function below.
 */

interface EmailPayload {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[EMAIL] To: ${to} | Subject: ${subject}`)
    // Strip HTML tags for readable console output
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    console.info(`[EMAIL] Body: ${text}`)
    return
  }

  // TODO: Connect a production email provider here.
  // Example with Resend (npm install resend):
  //
  // import { Resend } from 'resend'
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({ from: process.env.EMAIL_FROM!, to, subject, html })
  //
  // Until a provider is configured, log and continue so the app doesn't crash.
  console.warn(`[EMAIL] No provider configured. Email to ${to} was not sent.`)
}

export function buildPasswordResetEmail(resetUrl: string, expiresInMinutes: number): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a;">Reset Your Password</h2>
      <p style="color: #555;">
        You requested a password reset. Click the button below to choose a new password.
        This link expires in <strong>${expiresInMinutes} minutes</strong>.
      </p>
      <a href="${resetUrl}"
         style="display: inline-block; margin: 24px 0; padding: 12px 24px;
                background: #4f46e5; color: #fff; text-decoration: none;
                border-radius: 8px; font-weight: 600;">
        Reset Password
      </a>
      <p style="color: #999; font-size: 13px;">
        If you didn't request this, you can safely ignore this email.
        Your password will not change.
      </p>
      <p style="color: #bbb; font-size: 12px;">
        Or copy this link: ${resetUrl}
      </p>
    </div>
  `
}
