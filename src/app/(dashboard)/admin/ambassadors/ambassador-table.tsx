'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { updateAmbassadorStatus } from '@/lib/actions/ambassadors'
import { Check, X, Clock, Users } from 'lucide-react'
import type { Ambassador, CoachProfile, User } from '@prisma/client'

type AmbassadorWithCoach = Ambassador & {
  coach: CoachProfile & {
    user: User
  }
}

const statusVariants = {
  PENDING: 'warning',
  APPROVED: 'success',
  INACTIVE: 'secondary',
  COMPLETED: 'default',
  ON_HOLD: 'destructive',
} as const

const statusOptions = [
  { value: 'PENDING', label: 'Pending', color: 'yellow' },
  { value: 'APPROVED', label: 'Approved', color: 'green' },
  { value: 'INACTIVE', label: 'Inactive', color: 'gray' },
  { value: 'COMPLETED', label: 'Completed', color: 'blue' },
  { value: 'ON_HOLD', label: 'On Hold', color: 'red' },
] as const

interface AdminAmbassadorTableProps {
  ambassadors: AmbassadorWithCoach[]
}

export function AdminAmbassadorTable({ ambassadors }: AdminAmbassadorTableProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleStatusChange = async (
    ambassadorId: string,
    status: 'PENDING' | 'APPROVED' | 'INACTIVE' | 'COMPLETED' | 'ON_HOLD'
  ) => {
    setLoadingId(ambassadorId)
    await updateAmbassadorStatus(ambassadorId, status)
    setLoadingId(null)
  }

  if (ambassadors.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-4 text-gray-500">No ambassadors in the system yet</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-3 font-medium text-gray-500">Ambassador</th>
            <th className="pb-3 font-medium text-gray-500">Coach</th>
            <th className="pb-3 font-medium text-gray-500">Region</th>
            <th className="pb-3 font-medium text-gray-500">Status</th>
            <th className="pb-3 font-medium text-gray-500">Assessment</th>
            <th className="pb-3 font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ambassadors.map((ambassador) => (
            <tr key={ambassador.id} className="hover:bg-gray-50">
              <td className="py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {ambassador.firstName[0]}{ambassador.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {ambassador.firstName} {ambassador.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {ambassador.email || 'No email'}
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-4">
                <p className="text-gray-900">
                  {ambassador.coach.firstName} {ambassador.coach.lastName}
                </p>
                <p className="text-sm text-gray-500">{ambassador.coach.user.email}</p>
              </td>
              <td className="py-4 text-gray-600">
                {ambassador.region || '-'}
              </td>
              <td className="py-4">
                <Badge variant={statusVariants[ambassador.status]}>
                  {ambassador.status}
                </Badge>
              </td>
              <td className="py-4">
                <Badge variant="secondary">
                  {ambassador.assessmentStatus.replace('_', ' ')}
                </Badge>
              </td>
              <td className="py-4">
                <div className="flex items-center gap-2">
                  {ambassador.status === 'PENDING' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => handleStatusChange(ambassador.id, 'APPROVED')}
                        disabled={loadingId === ambassador.id}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleStatusChange(ambassador.id, 'ON_HOLD')}
                        disabled={loadingId === ambassador.id}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {ambassador.status !== 'PENDING' && (
                    <select
                      value={ambassador.status}
                      onChange={(e) =>
                        handleStatusChange(
                          ambassador.id,
                          e.target.value as 'PENDING' | 'APPROVED' | 'INACTIVE' | 'COMPLETED' | 'ON_HOLD'
                        )
                      }
                      disabled={loadingId === ambassador.id}
                      className="text-sm border rounded px-2 py-1"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
