/**
 * Server only. Loads the mailing address for the email footer (12) into the in-process cache that
 * layout() reads. Call `await primeEmailFooter()` once at the start of any path that sends Get Involved
 * emails (the cron does). Cached for a minute, so calling it before every send is cheap. Never throws.
 */
import { getOutreachSettings } from '../offer'
import { emailFooterAddressAge, setEmailFooterAddress } from '../emails'

const TTL_MS = 60_000

export async function primeEmailFooter(): Promise<void> {
  if (emailFooterAddressAge() < TTL_MS) return
  try {
    const s = await getOutreachSettings()
    setEmailFooterAddress(s.mailingAddress)
  } catch (e) {
    console.error('[GET-INVOLVED] footer settings failed', e)
  }
}
