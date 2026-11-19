import { redirect } from 'next/navigation'

/** The sub-admin area has one page for now: the support inbox. */
export default function TeamHome() {
  redirect('/team/support')
}
