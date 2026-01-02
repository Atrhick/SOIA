'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createAmbassador } from '@/lib/actions/ambassadors'
import { ArrowLeft, Save, UserPlus } from 'lucide-react'

export default function NewAmbassadorPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const result = await createAmbassador(formData)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      router.push('/coach/ambassadors')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/coach/ambassadors">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Ambassador</h1>
          <p className="text-gray-600">Enter the ambassador&apos;s information</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Ambassador Information
          </CardTitle>
          <CardDescription>
            New ambassadors will be added with &quot;Pending&quot; status until approved by admin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                id="firstName"
                name="firstName"
                label="First Name"
                placeholder="John"
                required
              />
              <Input
                id="lastName"
                name="lastName"
                label="Last Name"
                placeholder="Doe"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                id="email"
                name="email"
                label="Email (optional)"
                type="email"
                placeholder="john@example.com"
              />
              <Input
                id="phone"
                name="phone"
                label="Phone (optional)"
                type="tel"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <Input
              id="region"
              name="region"
              label="Region/Location"
              placeholder="Atlanta, GA"
            />

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Any additional information about this ambassador..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/coach/ambassadors">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
              <Button type="submit" isLoading={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                Add Ambassador
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
