/**
 * Email sending utility, backed by Resend.
 *
 * Configuration (see .env):
 *   RESEND_API_KEY  - required to send. Without it nothing is sent.
 *   EMAIL_FROM      - sender, e.g. "NowTransformed <noreply@yourdomain.com>".
 *                     Must be on a domain verified at resend.com/domains.
 *                     Falls back to Resend's shared testing sender, which can
 *                     only deliver to the Resend account owner's own address.
 *
 * Uses the REST API directly rather than the `resend` package - one less
 * dependency, and the call is a single POST.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const FALLBACK_FROM = 'NowTransformed <onboarding@resend.dev>'

interface EmailPayload {
  to: string
  subject: string
  html: string
}

export interface SendResult {
  sent: boolean
  id?: string
  error?: string
}

/**
 * Sends an email. Never throws - callers (password reset, notifications) must
 * not fail because a provider is down or misconfigured. Check the return value
 * if the caller needs to know.
 */
export async function sendEmail({ to, subject, html }: EmailPayload): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM?.trim() || FALLBACK_FROM

  // Keep the console trace in development so links are readable without
  // needing a mailbox.
  if (process.env.NODE_ENV !== 'production') {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    console.info(`[EMAIL] To: ${to} | Subject: ${subject}`)
    console.info(`[EMAIL] Body: ${text}`)
  }

  if (!apiKey) {
    console.warn(`[EMAIL] RESEND_API_KEY is not set. Email to ${to} was not sent.`)
    return { sent: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    })

    if (!response.ok) {
      // Resend returns a JSON body describing the problem. Log it, but never
      // let it surface the API key.
      const detail = await response.text()
      console.error(`[EMAIL] Resend rejected the message (${response.status}): ${detail.slice(0, 300)}`)
      return { sent: false, error: `Resend responded ${response.status}` }
    }

    const data = (await response.json()) as { id?: string }
    return { sent: true, id: data.id }
  } catch (error) {
    console.error('[EMAIL] Failed to reach Resend:', error)
    return { sent: false, error: 'Could not reach the email provider' }
  }
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
