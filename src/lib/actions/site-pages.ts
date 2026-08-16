'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Default content for each page - used when page doesn't exist yet
const DEFAULT_PAGES: Record<string, { title: string; content: string }> = {
  terms: {
    title: 'Terms of Service',
    content: `Terms of Service for NowTransformed Coaching Program

1. Agreement to Terms
By enrolling in the NowTransformed Coaching Program, you agree to be bound by these Terms of Service.

2. Program Description
The NowTransformed Coaching Program provides comprehensive training, resources, and support to build your coaching practice. The program includes:
- Complete coaching certification program
- Personal development workbook
- Access to our coaching platform
- Ongoing mentorship and support
- Marketing and business development resources

3. Enrollment
Enrollment is subject to approval by NowTransformed administration. Acceptance into the program is at the sole discretion of NowTransformed.

4. Conduct
Participants are expected to maintain professional conduct at all times, treat fellow participants with respect, and comply with all program guidelines.

5. Intellectual Property
All program materials, including but not limited to training content, workbooks, and resources, are the intellectual property of NowTransformed and may not be reproduced or distributed without written permission.

6. Limitation of Liability
NowTransformed is not liable for any indirect, incidental, or consequential damages arising from participation in the program.

7. Modifications
NowTransformed reserves the right to modify these terms at any time. Participants will be notified of any material changes.

8. Contact
For questions about these terms, contact us at info@stageoneinaction.com.`,
  },
  privacy: {
    title: 'Privacy Policy',
    content: `Privacy Policy for NowTransformed

Effective Date: January 1, 2026

1. Information We Collect
We collect information you provide directly to us, including:
- Name, email address, and phone number
- Business information (company name, website, services)
- Payment information (processed securely through third-party providers)
- Assessment and survey responses

2. How We Use Your Information
We use the information we collect to:
- Process your enrollment and manage your account
- Provide and improve our coaching program
- Communicate with you about the program
- Send administrative notices and updates

3. Information Sharing
We do not sell, trade, or rent your personal information to third parties. We may share information with:
- Service providers who assist in operating our platform
- As required by law or to protect our rights

4. Data Security
We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.

5. Your Rights
You have the right to:
- Access your personal information
- Request correction of inaccurate data
- Request deletion of your data (subject to legal requirements)

6. Cookies
Our platform may use cookies to enhance your experience. You can configure your browser to reject cookies, though some features may not function properly.

7. Changes to This Policy
We may update this privacy policy from time to time. We will notify you of any material changes.

8. Contact Us
For questions about this privacy policy, contact us at info@stageoneinaction.com.`,
  },
  'refund-policy': {
    title: 'Non-Refundable Policy',
    content: 'I understand that the program fee is non-refundable once payment is made.',
  },
  'acceptance-letter': {
    title: 'Acceptance Letter',
    content: `We are pleased to welcome you to the NowTransformed Coaching Program. As a member of our community, you will have access to comprehensive training, resources, and support to build your coaching practice.

The program includes:
- Complete coaching certification program
- Personal development workbook
- Access to our coaching platform
- Ongoing mentorship and support
- Marketing and business development resources

Please review and accept the following terms to proceed.`,
  },
}

/**
 * Get a single site page by slug (public - no auth required)
 * Seeds default content if the page doesn't exist yet
 */
export async function getSitePage(slug: string) {
  try {
    let page = await prisma.sitePage.findUnique({
      where: { slug },
    })

    // Auto-seed default content if page doesn't exist
    if (!page && DEFAULT_PAGES[slug]) {
      page = await prisma.sitePage.create({
        data: {
          slug,
          title: DEFAULT_PAGES[slug].title,
          content: DEFAULT_PAGES[slug].content,
        },
      })
    }

    if (!page) {
      return { error: 'Page not found' }
    }

    return {
      page: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        content: page.content,
        updatedAt: page.updatedAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error fetching site page:', error)
    return { error: 'Failed to fetch page' }
  }
}

/**
 * Get all site pages (admin only)
 * Seeds any missing default pages
 */
export async function getSitePages() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Ensure all default pages exist
    for (const [slug, defaults] of Object.entries(DEFAULT_PAGES)) {
      const exists = await prisma.sitePage.findUnique({ where: { slug } })
      if (!exists) {
        await prisma.sitePage.create({
          data: {
            slug,
            title: defaults.title,
            content: defaults.content,
          },
        })
      }
    }

    const pages = await prisma.sitePage.findMany({
      orderBy: { slug: 'asc' },
    })

    return {
      pages: pages.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        content: p.content,
        updatedBy: p.updatedBy,
        updatedAt: p.updatedAt.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
    }
  } catch (error) {
    console.error('Error fetching site pages:', error)
    return { error: 'Failed to fetch pages' }
  }
}

/**
 * Update a site page (admin only)
 */
export async function updateSitePage(
  slug: string,
  data: { title: string; content: string }
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  if (!data.title.trim()) {
    return { error: 'Title is required' }
  }

  try {
    const page = await prisma.sitePage.upsert({
      where: { slug },
      update: {
        title: data.title.trim(),
        content: data.content,
        updatedBy: session.user.id,
      },
      create: {
        slug,
        title: data.title.trim(),
        content: data.content,
        updatedBy: session.user.id,
      },
    })

    revalidatePath('/admin/settings')
    revalidatePath(`/${slug}`)
    if (slug === 'acceptance-letter' || slug === 'refund-policy') {
      revalidatePath('/acceptance')
    }

    return {
      page: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        content: page.content,
        updatedAt: page.updatedAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error updating site page:', error)
    return { error: 'Failed to update page' }
  }
}
