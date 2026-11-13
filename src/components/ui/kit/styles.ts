/**
 * Shared sizes for One-A-Day v2 (and new pages). Rules:
 * - anything you type into: 16px (text-base) or larger, so iPhones don't zoom in
 * - body text 16px, small print never under 14px (text-sm)
 * - buttons at least 48px tall (h-12); small icon buttons at least 44px
 * - one primary button per screen
 */
const ring = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

export const kit = {
  ring,
  input: 'w-full h-12 rounded-xl border border-gray-300 bg-white px-3.5 text-base text-gray-900 placeholder:text-gray-500 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/30 disabled:bg-gray-100',
  textarea: 'w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-base leading-relaxed text-gray-900 placeholder:text-gray-500 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/30',
  label: 'mb-1.5 block text-base font-semibold text-gray-900',
  hint: 'mt-1 text-sm text-gray-600',
  primary: `inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-700 px-5 text-base font-semibold text-white hover:bg-primary-800 disabled:opacity-60 ${ring}`,
  primaryBlock: `flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-5 text-base font-semibold text-white hover:bg-primary-800 disabled:opacity-60 ${ring}`,
  secondary: `inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-base font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60 ${ring}`,
  quiet: `inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-base font-semibold text-primary-700 hover:bg-primary-50 ${ring}`,
  danger: `inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 text-base font-semibold text-red-700 hover:bg-red-50 ${ring}`,
  card: 'rounded-2xl border border-gray-200 bg-white p-4 sm:p-5',
  /** A big choice button, e.g. "Email them for me" / "Copy a message". Use aria-pressed for the chosen one. */
  choice: `flex w-full items-start gap-3 rounded-2xl border-2 border-gray-200 bg-white p-4 text-left hover:border-primary-600 aria-pressed:border-primary-700 aria-pressed:bg-primary-50 ${ring}`,
}
