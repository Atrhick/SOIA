import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCertificate } from '@/lib/actions/lms/enrollment'
import { CertificateView } from '@/components/learning/course/certificate-view'

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function AmbassadorCertificatePage({ params }: PageProps) {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') redirect('/login')
  const { courseId } = await params
  const result = await getCertificate(courseId)
  if (!result.certificate) redirect(`/ambassador/learning/${courseId}`)
  return <CertificateView certificate={result.certificate} basePath="/ambassador/learning" />
}
