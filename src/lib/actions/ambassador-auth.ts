'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const createAmbassadorSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  phone: z.string().optional(),
  phoneCountryCode: z.string().optional(),
  region: z.string().optional(),
  // Address fields
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  // Parent/Guardian fields (required for under 18)
  parentFirstName: z.string().optional(),
  parentLastName: z.string().optional(),
  parentEmail: z.string().optional(),
  parentPhone: z.string().optional(),
  parentPhoneCountryCode: z.string().optional(),
  parentRelationship: z.string().optional(),
})

function calculateAge(dateOfBirth: Date): number {
  const today = new Date()
  let age = today.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = today.getMonth() - dateOfBirth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--
  }
  return age
}

export async function createAmbassadorAccount(formData: FormData) {
  const session = await auth()
  if (!session || (session.user.role !== 'COACH' && session.user.role !== 'ADMIN')) {
    return { error: 'Unauthorized' }
  }

  let coachId: string

  if (session.user.role === 'ADMIN') {
    // Admin must specify which coach to assign
    const assignedCoachId = formData.get('coachId') as string
    if (!assignedCoachId) {
      return { error: 'Coach assignment is required' }
    }
    // Verify the coach exists
    const coach = await prisma.coachProfile.findUnique({
      where: { id: assignedCoachId },
    })
    if (!coach) {
      return { error: 'Selected coach not found' }
    }
    coachId = assignedCoachId
  } else {
    // Coach creates ambassador under themselves
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: session.user.id },
    })
    if (!coachProfile) {
      return { error: 'Coach profile not found' }
    }
    coachId = coachProfile.id
  }

  const rawData = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    dateOfBirth: formData.get('dateOfBirth') as string,
    phone: formData.get('phone') as string || undefined,
    phoneCountryCode: formData.get('phoneCountryCode') as string || undefined,
    region: formData.get('region') as string || undefined,
    // Address fields
    address1: formData.get('address1') as string || undefined,
    address2: formData.get('address2') as string || undefined,
    city: formData.get('city') as string || undefined,
    state: formData.get('state') as string || undefined,
    postalCode: formData.get('postalCode') as string || undefined,
    country: formData.get('country') as string || undefined,
    // Parent/Guardian fields
    parentFirstName: formData.get('parentFirstName') as string || undefined,
    parentLastName: formData.get('parentLastName') as string || undefined,
    parentEmail: formData.get('parentEmail') as string || undefined,
    parentPhone: formData.get('parentPhone') as string || undefined,
    parentPhoneCountryCode: formData.get('parentPhoneCountryCode') as string || undefined,
    parentRelationship: formData.get('parentRelationship') as string || undefined,
  }

  const validated = createAmbassadorSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  const data = validated.data
  const dob = new Date(data.dateOfBirth)
  const age = calculateAge(dob)

  // Validate age is between 10-24
  if (age < 10 || age > 24) {
    return { error: 'Ambassador must be between 10 and 24 years old' }
  }

  // If under 18, require parental consent info
  const requiresParentalConsent = age < 18
  if (requiresParentalConsent) {
    if (!data.parentFirstName || !data.parentLastName) {
      return { error: 'Parent/Guardian name is required for ambassadors under 18' }
    }
    if (!data.parentEmail) {
      return { error: 'Parent/Guardian email is required for ambassadors under 18' }
    }
    if (!data.parentRelationship) {
      return { error: 'Parent/Guardian relationship is required for ambassadors under 18' }
    }
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  })

  if (existingUser) {
    return { error: 'An account with this email already exists' }
  }

  // Check if parent email already exists (if provided)
  if (data.parentEmail) {
    const existingParent = await prisma.user.findUnique({
      where: { email: data.parentEmail },
    })
    if (existingParent) {
      return { error: 'An account with the parent/guardian email already exists' }
    }
  }

  try {
    const hashedPassword = await bcrypt.hash(data.password, 12)

    // Create user and ambassador in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user account for ambassador
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          role: 'AMBASSADOR',
          status: 'ACTIVE',
        },
      })

      // Create parent user account if under 18
      let parentUser = null
      if (requiresParentalConsent && data.parentEmail) {
        // Generate a temporary password for parent (they should reset it)
        const tempParentPassword = Math.random().toString(36).slice(-10) + 'A1!'
        const hashedParentPassword = await bcrypt.hash(tempParentPassword, 12)

        parentUser = await tx.user.create({
          data: {
            email: data.parentEmail,
            password: hashedParentPassword,
            role: 'PARENT',
            status: 'ACTIVE',
          },
        })
      }

      // Create ambassador profile
      const ambassador = await tx.ambassador.create({
        data: {
          userId: user.id,
          coachId: coachId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          phoneCountryCode: data.phoneCountryCode,
          dateOfBirth: dob,
          region: data.region,
          // Address fields
          address1: data.address1,
          address2: data.address2,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country || 'US',
          // Parent/Guardian fields
          parentFirstName: data.parentFirstName,
          parentLastName: data.parentLastName,
          parentEmail: data.parentEmail,
          parentPhone: data.parentPhone,
          parentPhoneCountryCode: data.parentPhoneCountryCode,
          parentRelationship: data.parentRelationship,
          parentalConsentGiven: requiresParentalConsent,
          parentalConsentDate: requiresParentalConsent ? new Date() : null,
          parentUserId: parentUser?.id,
          status: 'PENDING',
        },
      })

      // Create initial onboarding progress for all active tasks
      const tasks = await tx.ambassadorOnboardingTask.findMany({
        where: { isActive: true },
      })

      if (tasks.length > 0) {
        await tx.ambassadorOnboardingProgress.createMany({
          data: tasks.map((task) => ({
            ambassadorId: ambassador.id,
            taskId: task.id,
            status: 'NOT_STARTED',
          })),
        })
      }

      return { user, ambassador, parentUser }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_AMBASSADOR_ACCOUNT',
        entityType: 'Ambassador',
        entityId: result.ambassador.id,
        details: JSON.stringify({
          ambassadorEmail: data.email,
          coachId: coachId,
          createdBy: session.user.role,
          age: age,
          requiresParentalConsent: requiresParentalConsent,
          parentAccountCreated: !!result.parentUser,
          parentEmail: result.parentUser ? data.parentEmail : null,
        }),
      },
    })

    revalidatePath('/coach/ambassadors')
    revalidatePath('/admin/ambassadors')
    return { success: true, ambassadorId: result.ambassador.id }
  } catch (error) {
    console.error('Error creating ambassador account:', error)
    return { error: 'Failed to create ambassador account' }
  }
}

export async function getCoachesForAssignment() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const coaches = await prisma.coachProfile.findMany({
    where: {
      user: {
        status: 'ACTIVE',
      },
    },
    include: {
      user: {
        select: { email: true },
      },
    },
    orderBy: { firstName: 'asc' },
  })

  return {
    coaches: coaches.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      email: c.user.email,
    })),
  }
}

export async function resetAmbassadorPassword(ambassadorId: string, newPassword: string) {
  const session = await auth()
  if (!session || (session.user.role !== 'COACH' && session.user.role !== 'ADMIN')) {
    return { error: 'Unauthorized' }
  }

  if (newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters' }
  }

  try {
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: ambassadorId },
      include: { user: true, coach: true },
    })

    if (!ambassador || !ambassador.userId) {
      return { error: 'Ambassador not found or has no login' }
    }

    // If coach, verify they own this ambassador
    if (session.user.role === 'COACH') {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: session.user.id },
      })

      if (!coachProfile || ambassador.coachId !== coachProfile.id) {
        return { error: 'You can only reset passwords for your own ambassadors' }
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: ambassador.userId },
      data: { password: hashedPassword },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'RESET_AMBASSADOR_PASSWORD',
        entityType: 'Ambassador',
        entityId: ambassadorId,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Error resetting ambassador password:', error)
    return { error: 'Failed to reset password' }
  }
}

export async function getAmbassadorProfile() {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') {
    return null
  }

  const ambassador = await prisma.ambassador.findUnique({
    where: { userId: session.user.id },
    include: {
      coach: {
        include: {
          user: {
            select: { email: true },
          },
        },
      },
      onboardingProgress: {
        include: { task: true },
        orderBy: { task: { sortOrder: 'asc' } },
      },
      businessIdea: true,
      classEnrollments: {
        include: {
          class: {
            include: {
              coach: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
  })

  return ambassador
}

const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  region: z.string().optional(),
  bio: z.string().optional(),
  photoUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  twitterUrl: z.string().optional(),
  tiktokUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),
  websiteUrl: z.string().optional(),
})

export async function updateAmbassadorProfile(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') {
    return { error: 'Unauthorized' }
  }

  const ambassador = await prisma.ambassador.findUnique({
    where: { userId: session.user.id },
  })

  if (!ambassador) {
    return { error: 'Ambassador profile not found' }
  }

  const rawData = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    phone: formData.get('phone') as string || undefined,
    region: formData.get('region') as string || undefined,
    bio: formData.get('bio') as string || undefined,
    photoUrl: formData.get('photoUrl') as string || undefined,
    instagramUrl: formData.get('instagramUrl') as string || undefined,
    facebookUrl: formData.get('facebookUrl') as string || undefined,
    twitterUrl: formData.get('twitterUrl') as string || undefined,
    tiktokUrl: formData.get('tiktokUrl') as string || undefined,
    linkedinUrl: formData.get('linkedinUrl') as string || undefined,
    youtubeUrl: formData.get('youtubeUrl') as string || undefined,
    websiteUrl: formData.get('websiteUrl') as string || undefined,
  }

  const validated = updateProfileSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    await prisma.ambassador.update({
      where: { id: ambassador.id },
      data: validated.data,
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_AMBASSADOR_PROFILE',
        entityType: 'Ambassador',
        entityId: ambassador.id,
      },
    })

    revalidatePath('/ambassador/profile')
    return { success: true }
  } catch (error) {
    console.error('Error updating ambassador profile:', error)
    return { error: 'Failed to update profile' }
  }
}
