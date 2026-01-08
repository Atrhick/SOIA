'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateAmbassadorProfile } from '@/lib/actions/ambassador-auth'
import {
  User,
  Camera,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Youtube,
  Globe,
  Edit,
  X,
  Save,
} from 'lucide-react'

interface ProfileFormProps {
  ambassador: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    region: string | null
    bio: string | null
    photoUrl: string | null
    instagramUrl: string | null
    facebookUrl: string | null
    twitterUrl: string | null
    tiktokUrl: string | null
    linkedinUrl: string | null
    youtubeUrl: string | null
    websiteUrl: string | null
  }
}

export function ProfileForm({ ambassador }: ProfileFormProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    firstName: ambassador.firstName,
    lastName: ambassador.lastName,
    phone: ambassador.phone || '',
    region: ambassador.region || '',
    bio: ambassador.bio || '',
    photoUrl: ambassador.photoUrl || '',
    instagramUrl: ambassador.instagramUrl || '',
    facebookUrl: ambassador.facebookUrl || '',
    twitterUrl: ambassador.twitterUrl || '',
    tiktokUrl: ambassador.tiktokUrl || '',
    linkedinUrl: ambassador.linkedinUrl || '',
    youtubeUrl: ambassador.youtubeUrl || '',
    websiteUrl: ambassador.websiteUrl || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    const form = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      form.set(key, value)
    })

    const result = await updateAmbassadorProfile(form)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setIsEditing(false)
    }
    setIsSubmitting(false)
  }

  const handleCancel = () => {
    setFormData({
      firstName: ambassador.firstName,
      lastName: ambassador.lastName,
      phone: ambassador.phone || '',
      region: ambassador.region || '',
      bio: ambassador.bio || '',
      photoUrl: ambassador.photoUrl || '',
      instagramUrl: ambassador.instagramUrl || '',
      facebookUrl: ambassador.facebookUrl || '',
      twitterUrl: ambassador.twitterUrl || '',
      tiktokUrl: ambassador.tiktokUrl || '',
      linkedinUrl: ambassador.linkedinUrl || '',
      youtubeUrl: ambassador.youtubeUrl || '',
      websiteUrl: ambassador.websiteUrl || '',
    })
    setIsEditing(false)
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              {formData.photoUrl ? (
                <img
                  src={formData.photoUrl}
                  alt={`${formData.firstName} ${formData.lastName}`}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white/30"
                />
              ) : (
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center border-4 border-white/30">
                  <User className="w-10 h-10" />
                </div>
              )}
              {isEditing && (
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5">
                  <Camera className="w-4 h-4 text-amber-600" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {formData.firstName} {formData.lastName}
              </h1>
              <p className="text-amber-100">Ambassador</p>
            </div>
          </div>
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          Profile updated successfully!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-amber-500" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  {isEditing ? (
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      required
                    />
                  ) : (
                    <p className="text-gray-900 py-2">{formData.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  {isEditing ? (
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      required
                    />
                  ) : (
                    <p className="text-gray-900 py-2">{formData.lastName}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <p className="text-gray-500 py-2">{ambassador.email || 'Not set'}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="Your phone number"
                  />
                ) : (
                  <p className="text-gray-900 py-2">
                    {formData.phone || 'Not set'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                {isEditing ? (
                  <Input
                    id="region"
                    value={formData.region}
                    onChange={(e) =>
                      setFormData({ ...formData, region: e.target.value })
                    }
                    placeholder="Your region"
                  />
                ) : (
                  <p className="text-gray-900 py-2">
                    {formData.region || 'Not set'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Profile Photo & Bio */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-500" />
                Photo & Bio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="photoUrl">Profile Photo URL</Label>
                {isEditing ? (
                  <Input
                    id="photoUrl"
                    value={formData.photoUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, photoUrl: e.target.value })
                    }
                    placeholder="https://example.com/photo.jpg"
                  />
                ) : (
                  <p className="text-gray-900 py-2">
                    {formData.photoUrl || 'No photo set'}
                  </p>
                )}
                {isEditing && (
                  <p className="text-xs text-gray-500">
                    Enter a URL to your profile photo
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                {isEditing ? (
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) =>
                      setFormData({ ...formData, bio: e.target.value })
                    }
                    placeholder="Tell us about yourself..."
                    rows={4}
                  />
                ) : (
                  <p className="text-gray-900 py-2">
                    {formData.bio || 'No bio set'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Social Media Links */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-amber-500" />
                Social Media Links
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instagramUrl" className="flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-pink-500" />
                    Instagram
                  </Label>
                  {isEditing ? (
                    <Input
                      id="instagramUrl"
                      value={formData.instagramUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, instagramUrl: e.target.value })
                      }
                      placeholder="https://instagram.com/username"
                    />
                  ) : formData.instagramUrl ? (
                    <a
                      href={formData.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-500 hover:underline py-2 block truncate"
                    >
                      {formData.instagramUrl}
                    </a>
                  ) : (
                    <p className="text-gray-500 py-2">Not set</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facebookUrl" className="flex items-center gap-2">
                    <Facebook className="w-4 h-4 text-blue-600" />
                    Facebook
                  </Label>
                  {isEditing ? (
                    <Input
                      id="facebookUrl"
                      value={formData.facebookUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, facebookUrl: e.target.value })
                      }
                      placeholder="https://facebook.com/username"
                    />
                  ) : formData.facebookUrl ? (
                    <a
                      href={formData.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline py-2 block truncate"
                    >
                      {formData.facebookUrl}
                    </a>
                  ) : (
                    <p className="text-gray-500 py-2">Not set</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitterUrl" className="flex items-center gap-2">
                    <Twitter className="w-4 h-4 text-sky-500" />
                    Twitter / X
                  </Label>
                  {isEditing ? (
                    <Input
                      id="twitterUrl"
                      value={formData.twitterUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, twitterUrl: e.target.value })
                      }
                      placeholder="https://twitter.com/username"
                    />
                  ) : formData.twitterUrl ? (
                    <a
                      href={formData.twitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-500 hover:underline py-2 block truncate"
                    >
                      {formData.twitterUrl}
                    </a>
                  ) : (
                    <p className="text-gray-500 py-2">Not set</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tiktokUrl" className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                    TikTok
                  </Label>
                  {isEditing ? (
                    <Input
                      id="tiktokUrl"
                      value={formData.tiktokUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, tiktokUrl: e.target.value })
                      }
                      placeholder="https://tiktok.com/@username"
                    />
                  ) : formData.tiktokUrl ? (
                    <a
                      href={formData.tiktokUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-900 hover:underline py-2 block truncate"
                    >
                      {formData.tiktokUrl}
                    </a>
                  ) : (
                    <p className="text-gray-500 py-2">Not set</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedinUrl" className="flex items-center gap-2">
                    <Linkedin className="w-4 h-4 text-blue-700" />
                    LinkedIn
                  </Label>
                  {isEditing ? (
                    <Input
                      id="linkedinUrl"
                      value={formData.linkedinUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, linkedinUrl: e.target.value })
                      }
                      placeholder="https://linkedin.com/in/username"
                    />
                  ) : formData.linkedinUrl ? (
                    <a
                      href={formData.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline py-2 block truncate"
                    >
                      {formData.linkedinUrl}
                    </a>
                  ) : (
                    <p className="text-gray-500 py-2">Not set</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="youtubeUrl" className="flex items-center gap-2">
                    <Youtube className="w-4 h-4 text-red-600" />
                    YouTube
                  </Label>
                  {isEditing ? (
                    <Input
                      id="youtubeUrl"
                      value={formData.youtubeUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, youtubeUrl: e.target.value })
                      }
                      placeholder="https://youtube.com/@channel"
                    />
                  ) : formData.youtubeUrl ? (
                    <a
                      href={formData.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:underline py-2 block truncate"
                    >
                      {formData.youtubeUrl}
                    </a>
                  ) : (
                    <p className="text-gray-500 py-2">Not set</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-600" />
                    Website
                  </Label>
                  {isEditing ? (
                    <Input
                      id="websiteUrl"
                      value={formData.websiteUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, websiteUrl: e.target.value })
                      }
                      placeholder="https://yourwebsite.com"
                    />
                  ) : formData.websiteUrl ? (
                    <a
                      href={formData.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:underline py-2 block truncate"
                    >
                      {formData.websiteUrl}
                    </a>
                  ) : (
                    <p className="text-gray-500 py-2">Not set</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex justify-end gap-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
