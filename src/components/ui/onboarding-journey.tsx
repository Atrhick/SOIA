'use client'

import { LucideIcon, Check, PartyPopper, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: LucideIcon
  status: 'completed' | 'current' | 'pending'
  link?: string
  phase?: string // Optional phase grouping
}

export interface OnboardingPhase {
  id: string
  title: string
  color: 'blue' | 'green' | 'purple' | 'amber'
}

interface OnboardingJourneyProps {
  steps: OnboardingStep[]
  completedCount: number
  totalCount: number
  className?: string
  phases?: OnboardingPhase[] // Optional phase definitions
}

export function OnboardingJourney({ steps, completedCount, totalCount, className = '' }: OnboardingJourneyProps) {
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Find the current step and next step
  const currentStepIndex = steps.findIndex(s => s.status === 'current')
  const nextStep = currentStepIndex >= 0
    ? steps[currentStepIndex]
    : steps.find(s => s.status === 'pending')

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${className}`}
      role="region"
      aria-label="Onboarding progress"
    >
      {/* Header Section */}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Your Journey</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {completedCount} of {totalCount} steps completed
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Next Step Pill */}
            {nextStep && (
              <div
                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-50 border border-amber-200 rounded-full"
                aria-label={`Next step: ${nextStep.title}`}
              >
                <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">Next</span>
                <span className="text-xs sm:text-sm font-semibold text-amber-800 truncate max-w-[120px] sm:max-w-none">{nextStep.title}</span>
              </div>
            )}
            {/* Progress Indicator */}
            <div
              className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-50 border border-blue-200 rounded-full"
              role="progressbar"
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${progressPercentage}% complete`}
            >
              <div className="relative w-6 h-6 sm:w-8 sm:h-8">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 transform -rotate-90" aria-hidden="true">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="40%"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                  />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="40%"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(progressPercentage / 100) * 75.4} 75.4`}
                  />
                </svg>
              </div>
              <span className="text-xs sm:text-sm font-bold text-blue-700">{progressPercentage}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper Section - Horizontal on desktop, scrollable on mobile */}
      <div className="px-4 sm:px-6 py-6 sm:py-8 overflow-x-auto">
        <nav aria-label="Progress steps">
          <ol className="relative flex justify-between min-w-[600px] sm:min-w-0">
            {/* Connecting Line - Background */}
            <div
              className="absolute top-7 left-0 right-0 h-1 bg-gray-200 rounded-full pointer-events-none"
              style={{
                left: `${100 / (steps.length * 2)}%`,
                right: `${100 / (steps.length * 2)}%`
              }}
              aria-hidden="true"
            />

            {/* Connecting Line - Progress */}
            <div
              className="absolute top-7 h-1 bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500 pointer-events-none"
              style={{
                left: `${100 / (steps.length * 2)}%`,
                width: `${Math.max(0, ((steps.filter(s => s.status === 'completed').length) / (steps.length - 1)) * (100 - 100/steps.length))}%`
              }}
              aria-hidden="true"
            />

            {/* Steps */}
            {steps.map((step, index) => {
              const StepIcon = step.icon
              const isCompleted = step.status === 'completed'
              const isCurrent = step.status === 'current'
              const isPending = step.status === 'pending'

              return (
                <li
                  key={step.id}
                  className="relative flex flex-col items-center"
                  style={{ width: `${100 / steps.length}%` }}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {/* Step Circle Container */}
                  <div className="relative">
                    {/* Glow effect for current step */}
                    {isCurrent && (
                      <>
                        <div
                          className="absolute inset-0 w-14 h-14 -m-[3px] rounded-full bg-amber-400/30 animate-pulse"
                          aria-hidden="true"
                        />
                        <div
                          className="absolute inset-0 w-14 h-14 -m-[3px] rounded-full border-[3px] border-amber-400 animate-[spin_3s_linear_infinite]"
                          style={{ borderTopColor: 'transparent', borderLeftColor: 'transparent' }}
                          aria-hidden="true"
                        />
                      </>
                    )}

                    {/* Main Circle */}
                    <div
                      className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isCompleted
                          ? 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg shadow-green-200'
                          : isCurrent
                            ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-200'
                            : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                      }`}
                      aria-hidden="true"
                    >
                      {isCompleted ? (
                        <Check className="w-7 h-7 stroke-[3]" />
                      ) : (
                        <StepIcon className={`w-6 h-6 ${isCurrent ? '' : 'opacity-60'}`} />
                      )}
                    </div>

                    {/* Green Check Badge for Completed Steps */}
                    {isCompleted && (
                      <div
                        className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                        aria-hidden="true"
                      >
                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                      </div>
                    )}

                    {/* Step Number Badge for Pending */}
                    {isPending && (
                      <div
                        className="absolute -top-1 -right-1 w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center border-2 border-white text-xs font-bold text-gray-600"
                        aria-hidden="true"
                      >
                        {index + 1}
                      </div>
                    )}
                  </div>

                  {/* Step Title */}
                  <h3 className={`mt-4 text-xs sm:text-sm font-semibold text-center leading-tight ${
                    isCompleted
                      ? 'text-green-700'
                      : isCurrent
                        ? 'text-amber-700'
                        : 'text-gray-400'
                  }`}>
                    <span className="sr-only">
                      Step {index + 1}: {isCompleted ? 'Completed - ' : isCurrent ? 'Current step - ' : 'Pending - '}
                    </span>
                    {step.title}
                  </h3>

                  {/* Step Description */}
                  <p className={`mt-1.5 text-[10px] sm:text-xs text-center leading-relaxed max-w-[100px] sm:max-w-[140px] ${
                    isPending ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    {step.description}
                  </p>

                  {/* "You are here" Marker */}
                  {isCurrent && (
                    <div className="mt-3 sm:mt-4 flex flex-col items-center animate-bounce" aria-hidden="true">
                      <div className="w-0 h-0 border-l-[6px] sm:border-l-[8px] border-r-[6px] sm:border-r-[8px] border-b-[8px] sm:border-b-[10px] border-l-transparent border-r-transparent border-b-amber-500" />
                      <span className="mt-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] sm:text-xs font-bold rounded-full shadow-md whitespace-nowrap">
                        You are here
                      </span>
                    </div>
                  )}

                  {/* Action Link for Current Step */}
                  {isCurrent && step.link && (
                    <Link
                      href={step.link}
                      className="mt-2 sm:mt-3 px-3 sm:px-4 py-1 sm:py-1.5 bg-amber-100 text-amber-700 text-[10px] sm:text-xs font-medium rounded-full hover:bg-amber-200 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                    >
                      Continue →
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      </div>

      {/* Progress Bar at Bottom */}
      <div className="px-4 sm:px-6 pb-4">
        <div
          className="h-2 bg-gray-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Overall progress: ${progressPercentage}%`}
        >
          <div
            className="h-full bg-gradient-to-r from-green-400 via-green-500 to-emerald-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// Compact version for sidebars or smaller spaces
export function OnboardingJourneyCompact({ steps, completedCount, totalCount }: OnboardingJourneyProps) {
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const currentStep = steps.find(s => s.status === 'current')
  const nextStep = currentStep || steps.find(s => s.status === 'pending')

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-4"
      role="region"
      aria-label="Onboarding progress summary"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Onboarding Progress</h3>
        <span
          className="text-sm font-bold text-blue-600"
          aria-label={`${progressPercentage}% complete`}
        >
          {progressPercentage}%
        </span>
      </div>

      {/* Mini Steps */}
      <nav aria-label="Progress steps">
        <ol className="flex items-center gap-1 mb-4">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className="flex items-center flex-1"
              aria-current={step.status === 'current' ? 'step' : undefined}
            >
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  step.status === 'completed'
                    ? 'bg-green-500'
                    : step.status === 'current'
                      ? 'bg-amber-500 ring-2 ring-amber-200'
                      : 'bg-gray-200'
                }`}
                title={`${step.title} - ${step.status === 'completed' ? 'Completed' : step.status === 'current' ? 'In Progress' : 'Pending'}`}
                aria-hidden="true"
              />
              <span className="sr-only">
                Step {index + 1}: {step.title} - {step.status === 'completed' ? 'Completed' : step.status === 'current' ? 'In Progress' : 'Pending'}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 ${
                    step.status === 'completed' ? 'bg-green-400' : 'bg-gray-200'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Current Step Info */}
      {nextStep && (
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">
            {currentStep ? 'Current Step' : 'Next Step'}
          </p>
          <p className="text-sm font-semibold text-amber-800 mt-1">{nextStep.title}</p>
          {nextStep.link && (
            <Link
              href={nextStep.link}
              className="inline-block mt-2 text-xs font-medium text-amber-700 hover:text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 rounded"
            >
              Continue →
            </Link>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div
        className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={progressPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Overall progress: ${progressPercentage}%`}
      >
        <div
          className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500 text-center">
        {completedCount} of {totalCount} completed
      </p>
    </div>
  )
}

// Prospect Journey with Phase Delineation
export interface ProspectStep {
  id: string
  title: string
  shortTitle?: string
  icon: LucideIcon
  status: 'completed' | 'current' | 'pending' | 'skipped'
}

interface ProspectJourneyProps {
  preOnboardingSteps: ProspectStep[]
  onboardingSteps: ProspectStep[]
  coachProfileId?: string | null
  className?: string
}

export function ProspectJourney({ preOnboardingSteps, onboardingSteps, coachProfileId, className = '' }: ProspectJourneyProps) {
  const allSteps = [...preOnboardingSteps, ...onboardingSteps]
  const completedCount = allSteps.filter(s => s.status === 'completed').length
  const totalCount = allSteps.filter(s => s.status !== 'skipped').length
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const isComplete = progressPercentage === 100

  const preOnboardingCompleted = preOnboardingSteps.filter(s => s.status === 'completed').length
  const preOnboardingTotal = preOnboardingSteps.filter(s => s.status !== 'skipped').length
  const onboardingCompleted = onboardingSteps.filter(s => s.status === 'completed').length
  const onboardingTotal = onboardingSteps.filter(s => s.status !== 'skipped').length

  const renderStep = (step: ProspectStep, index: number, isLastInPhase: boolean) => {
    const StepIcon = step.icon
    const isCompleted = step.status === 'completed'
    const isCurrent = step.status === 'current'
    const isPending = step.status === 'pending'
    const isSkipped = step.status === 'skipped'

    if (isSkipped) return null

    return (
      <div key={step.id} className="flex items-center">
        <div className="flex flex-col items-center">
          {/* Step Circle */}
          <div
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              isCompleted
                ? 'bg-green-500 text-white'
                : isCurrent
                  ? 'bg-amber-500 text-white ring-4 ring-amber-200'
                  : 'bg-gray-200 text-gray-400'
            }`}
          >
            {isCompleted ? (
              <Check className="w-5 h-5 stroke-[3]" />
            ) : (
              <StepIcon className="w-5 h-5" />
            )}
          </div>
          {/* Step Label */}
          <span className={`mt-2 text-[10px] sm:text-xs font-medium text-center max-w-[60px] sm:max-w-[80px] leading-tight ${
            isCompleted ? 'text-green-700' : isCurrent ? 'text-amber-700' : 'text-gray-400'
          }`}>
            {step.shortTitle || step.title}
          </span>
        </div>
        {/* Connector Line (except for last in phase) */}
        {!isLastInPhase && (
          <div className={`w-6 sm:w-10 h-1 mx-1 rounded-full ${
            isCompleted ? 'bg-green-400' : 'bg-gray-200'
          }`} />
        )}
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl border ${isComplete ? 'border-green-300' : 'border-gray-200'} shadow-sm overflow-hidden ${className}`}>
      {/* Completion Banner */}
      {isComplete && (
        <div className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <PartyPopper className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">Journey Complete!</h3>
                <p className="text-sm text-green-100">This prospect is now a coach</p>
              </div>
            </div>
            {coachProfileId && (
              <Link
                href="/admin/coaches"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-green-700 rounded-lg font-medium text-sm hover:bg-green-50 transition-colors"
              >
                View Coach Profile
                <ExternalLink className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 ${isComplete ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Prospect Journey</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{completedCount} of {totalCount} steps</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
              {progressPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Steps with Phase Labels */}
      <div className="px-4 py-5 overflow-x-auto">
        <div className="flex items-start gap-4 min-w-[600px]">
          {/* Pre-Onboarding Phase */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-4 bg-blue-500 rounded-full" />
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Pre-Onboarding</span>
              <span className="text-[10px] text-gray-400">
                ({preOnboardingCompleted}/{preOnboardingTotal})
              </span>
            </div>
            <div className="flex items-start bg-blue-50/50 rounded-lg p-3 border border-blue-100">
              {preOnboardingSteps.filter(s => s.status !== 'skipped').map((step, index, arr) =>
                renderStep(step, index, index === arr.length - 1)
              )}
            </div>
          </div>

          {/* Phase Divider */}
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-px h-8 bg-gray-300" />
            <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
              <span className="text-gray-400 text-lg">→</span>
            </div>
            <div className="w-px h-8 bg-gray-300" />
          </div>

          {/* Onboarding Phase */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-4 bg-green-500 rounded-full" />
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Onboarding</span>
              <span className="text-[10px] text-gray-400">
                ({onboardingCompleted}/{onboardingTotal})
              </span>
            </div>
            <div className="flex items-start bg-green-50/50 rounded-lg p-3 border border-green-100">
              {onboardingSteps.filter(s => s.status !== 'skipped').map((step, index, arr) =>
                renderStep(step, index, index === arr.length - 1)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 pb-4">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
          {/* Pre-onboarding progress (blue) */}
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-500"
            style={{ width: `${(preOnboardingCompleted / totalCount) * 100}%` }}
          />
          {/* Onboarding progress (green) */}
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
            style={{ width: `${(onboardingCompleted / totalCount) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-gray-400">
          <span>Pre-Onboarding: {preOnboardingCompleted}/{preOnboardingTotal}</span>
          <span>Onboarding: {onboardingCompleted}/{onboardingTotal}</span>
        </div>
      </div>
    </div>
  )
}
