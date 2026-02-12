import { notFound } from 'next/navigation'
import { loadBusinessFormDraft } from '@/lib/actions/prospects'
import { BusinessFormClient } from './business-form-client'

export default async function BusinessFormPage({
  params,
}: {
  params: { token: string }
}) {
  const result = await loadBusinessFormDraft(params.token)

  if (result.error) {
    // Handle already submitted case
    if (result.error === 'Business form has already been submitted') {
      return (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Form Already Submitted
            </h1>
            <p className="text-gray-600">
              This business development form has already been submitted. If you need to make changes, please contact your administrator.
            </p>
          </div>
        </div>
      )
    }
    notFound()
  }

  // Normalize draft data to ensure all fields have default values
  const normalizedDraft = {
    currentStep: result.draft?.currentStep || 0,
    companyName: result.draft?.companyName || '',
    tagline: result.draft?.tagline || '',
    bio: result.draft?.bio || '',
    businessType: result.draft?.businessType || '',
    businessTypeOther: result.draft?.businessTypeOther || '',
    websiteUrl: result.draft?.websiteUrl || '',
    needsWebsiteHelp: result.draft?.needsWebsiteHelp || false,
    instagramHandle: result.draft?.instagramHandle || '',
    facebookHandle: result.draft?.facebookHandle || '',
    linkedinHandle: result.draft?.linkedinHandle || '',
    tiktokHandle: result.draft?.tiktokHandle || '',
    servicePackages: (result.draft?.servicePackages || []) as { id: string; name: string; description: string; price: string; duration?: string }[],
    idealClient: result.draft?.idealClient || '',
    uniqueValue: result.draft?.uniqueValue || '',
    certifications: result.draft?.certifications || '',
    threeYearRevenueGoal: result.draft?.threeYearRevenueGoal || '',
    threeYearClientGoal: result.draft?.threeYearClientGoal || '',
    visionStatement: result.draft?.visionStatement || '',
    missionStatement: result.draft?.missionStatement || '',
  }

  return (
    <BusinessFormClient
      prospect={result.prospect!}
      token={params.token}
      initialDraft={normalizedDraft}
      lastSavedAt={result.lastSavedAt || null}
    />
  )
}
