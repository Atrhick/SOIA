/**
 * /join pages. No shared frame: an offering's landing page is full width with its own header and
 * footer; the plain sign-up pages wrap themselves in PublicShell.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
