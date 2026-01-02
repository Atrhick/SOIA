'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateCoachProfile, uploadProfilePhoto } from '@/lib/actions/onboarding'
import { Camera, ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload
    setIsUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('photo', file)

    const result = await uploadProfilePhoto(formData)

    if (result.error) {
      setError(result.error)
      setPhotoPreview(null)
    } else {
      setSuccess('Photo uploaded successfully!')
    }

    setIsUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    const formData = new FormData(e.currentTarget)
    const result = await updateCoachProfile(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Profile updated successfully!')
      setTimeout(() => router.push('/coach/onboarding'), 1500)
    }

    setIsLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/coach/onboarding">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complete Your Profile</h1>
          <p className="text-gray-600">Fill in your information to complete onboarding</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {success && (
        <div className="p-4 bg-green-50 text-green-600 rounded-lg">{success}</div>
      )}

      {/* Photo Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
          <CardDescription>Upload a professional photo (JPEG, PNG, or WebP, max 5MB)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                {photoPreview ? (
                  <Image
                    src={photoPreview}
                    alt="Profile preview"
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              isLoading={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Choose Photo'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Tell us about yourself</CardDescription>
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

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                placeholder="Tell us about yourself, your background, and your passion for coaching..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              />
            </div>

            <Input
              id="phone"
              name="phone"
              label="Phone Number"
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

            <div className="flex justify-end gap-3 pt-4">
              <Link href="/coach/onboarding">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
              <Button type="submit" isLoading={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                Save Profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
