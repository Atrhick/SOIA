'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { markCourseAsWatched } from '@/lib/actions/onboarding'
import { CheckCircle2 } from 'lucide-react'

interface MarkAsWatchedButtonProps {
  courseId: string
}

export function MarkAsWatchedButton({ courseId }: MarkAsWatchedButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isMarked, setIsMarked] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    const result = await markCourseAsWatched(courseId)
    if (result.success) {
      setIsMarked(true)
    }
    setIsLoading(false)
  }

  if (isMarked) {
    return (
      <Button variant="outline" disabled className="text-green-600">
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Marked as Watched
      </Button>
    )
  }

  return (
    <Button onClick={handleClick} isLoading={isLoading}>
      Mark as Watched
    </Button>
  )
}
