'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { confirmWorkbookReceived, updateOnboardingTask } from '@/lib/actions/onboarding'
import { Check } from 'lucide-react'

interface OnboardingTaskButtonProps {
  taskId: string
  taskLabel: string
}

export function OnboardingTaskButton({ taskId, taskLabel }: OnboardingTaskButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)

    let result

    // Handle specific tasks
    if (taskId === 'confirm-receipt-of-coach-workbook') {
      result = await confirmWorkbookReceived()
    } else {
      result = await updateOnboardingTask(taskId, 'APPROVED')
    }

    if (result.success) {
      setConfirmed(true)
    }

    setIsLoading(false)
  }

  if (confirmed) {
    return (
      <Button size="sm" variant="outline" disabled className="text-green-600">
        <Check className="mr-2 h-4 w-4" />
        Confirmed
      </Button>
    )
  }

  return (
    <Button size="sm" onClick={handleConfirm} isLoading={isLoading}>
      Confirm
    </Button>
  )
}
