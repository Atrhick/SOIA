/**
 * "Did you mean ...?" for common email domain typos on the sign-up form (screen 5b C).
 * Pure and client-safe: a suggestion only, the person decides.
 */

/** Misspelled domain -> the domain people almost always mean. */
const TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.con': 'outlook.com',
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
  'icoud.com': 'icloud.com',
  'aol.co': 'aol.com',
}

/**
 * The corrected address when the domain is a known typo, else null.
 * Keeps the local part exactly as typed; compares the domain case-insensitively.
 */
export function suggestEmail(raw: string): string | null {
  const email = (raw ?? '').trim()
  const at = email.lastIndexOf('@')
  if (at < 1 || at === email.length - 1) return null
  const local = email.slice(0, at)
  const domain = email.slice(at + 1).toLowerCase()
  const fix = TYPOS[domain]
  return fix ? `${local}@${fix}` : null
}
