'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On Hold' },
]

export function AmbassadorFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || 'all')

  const updateFilters = (newSearch: string, newStatus: string) => {
    const params = new URLSearchParams()
    if (newSearch) params.set('search', newSearch)
    if (newStatus && newStatus !== 'all') params.set('status', newStatus)
    router.push(`/coach/ambassadors?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters(search, status)
  }

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus)
    updateFilters(search, newStatus)
  }

  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    router.push('/coach/ambassadors')
  }

  const hasFilters = search || status !== 'all'

  return (
    <Card>
      <CardContent className="py-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name, email, or region..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <Button type="submit" variant="secondary">
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>

          {hasFilters && (
            <Button type="button" variant="ghost" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
