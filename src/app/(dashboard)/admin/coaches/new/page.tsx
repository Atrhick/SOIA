'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createCoach } from '@/lib/actions/coaches'
import { ArrowLeft, Save, UserPlus, Eye, EyeOff } from 'lucide-react'

export default function NewCoachPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([])

  // Fetch existing coaches for recruiter dropdown
  useEffect(() => {
    fetch('/api/coaches/list')
      .then((res) => res.json())
      .then((data) => setCoaches(data.coaches || []))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const result = await createCoach(formData)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      router.push('/admin/coaches')
    }
  }

  // Generate random password
  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const input = document.getElementById('password') as HTMLInputElement
    if (input) {
      input.value = password
      setShowPassword(true)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/coaches">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Coach</h1>
          <p className="text-gray-600">Create a new coach account</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Coach Information
          </CardTitle>
          <CardDescription>
            The coach will receive login credentials to access their portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Credentials */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Account Credentials</h3>
              <Input
                id="email"
                name="email"
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                required
              />
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 6 characters"
                      required
                      minLength={6}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button type="button" variant="outline" onClick={generatePassword}>
                    Generate
                  </Button>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium text-gray-900">Personal Information</h3>
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

              <Input
                id="phone"
                name="phone"
                label="Phone Number (optional)"
                type="tel"
                placeholder="+1 (555) 123-4567"
              />

              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  id="city"
                  name="city"
                  label="City"
                  placeholder="Atlanta"
                />
                <Input
                  id="region"
                  name="region"
                  label="State/Region"
                  placeholder="Georgia"
                />
                <Input
                  id="country"
                  name="country"
                  label="Country"
                  placeholder="USA"
                />
              </div>
            </div>

            {/* Recruiter */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium text-gray-900">Recruitment (optional)</h3>
              <div>
                <label htmlFor="recruiterId" className="block text-sm font-medium text-gray-700 mb-1">
                  Recruited By
                </label>
                <select
                  id="recruiterId"
                  name="recruiterId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <option value="">No recruiter</option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Select if this coach was recruited by another coach
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/admin/coaches">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
              <Button type="submit" isLoading={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                Create Coach
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
