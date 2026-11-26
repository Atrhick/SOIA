'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseCourseFolder } from '@/lib/lms/markdown-import'
import { createCourseFromImport } from '@/lib/lms/server'

const MAX_FILES = 80
const MAX_FILE_CHARS = 600_000
// Server actions accept 2 MB bodies (next.config.js), so stay under that.
const MAX_TOTAL_CHARS = 1_800_000

const filesSchema = z
  .array(z.object({ name: z.string().min(1).max(300), content: z.string().max(MAX_FILE_CHARS, 'One of the files is too large (600 KB limit)') }))
  .min(1, 'Choose at least one markdown file')
  .max(MAX_FILES, `Up to ${MAX_FILES} files at a time`)
  .refine((fs) => fs.reduce((a, f) => a + f.content.length, 0) <= MAX_TOTAL_CHARS, { message: 'The files are too large together (about 1.8 MB limit)' })

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

/** Reads the files and shows what would be created. Nothing is saved. */
export async function previewCourseImport(files: { name: string; content: string }[]) {
  if (!(await requireAdmin())) return { error: 'Unauthorized - Admin only' }
  const parsed = filesSchema.safeParse(files)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Check the files' }
  const course = parseCourseFolder(parsed.data)
  if (!course.modules.length) return { error: 'No weeks with lessons were found. Each file needs "## Lesson" headings.' }
  return {
    preview: {
      title: course.title,
      description: course.description,
      category: course.category,
      tags: course.tags,
      allowedRoles: course.allowedRoles,
      dripDays: course.dripDays,
      outcomes: course.outcomes,
      estimatedDuration: course.estimatedDuration,
      warnings: course.warnings,
      modules: course.modules.map((m) => ({
        title: m.title,
        sourceFile: m.sourceFile,
        lessons: m.lessons.map((l) => ({
          title: l.title,
          estimatedDuration: l.estimatedDuration,
          textBlocks: l.blocks.filter((b) => b.type === 'TEXT').length,
          exercises: l.blocks.filter((b) => b.type === 'EXERCISE').length,
          prompts: l.blocks.reduce((a, b) => a + (b.type === 'EXERCISE' ? b.content.prompts.length : 0), 0),
        })),
      })),
    },
  }
}

/** Creates a new DRAFT course from the files, in one transaction. */
export async function importCourseFromMarkdown(files: { name: string; content: string }[], title?: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Unauthorized - Admin only' }
  if (session.user.isImpersonating) return { error: 'Switch back to your own account to import a course' }
  const parsed = filesSchema.safeParse(files)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Check the files' }
  const cleanTitle = z.string().trim().max(200).optional().safeParse(title)
  const course = parseCourseFolder(parsed.data)
  if (!course.modules.length) return { error: 'No weeks with lessons were found. Each file needs "## Lesson" headings.' }

  try {
    const courseId = await prisma.$transaction(
      (tx) => createCourseFromImport(tx, course, session.user.id, { title: cleanTitle.success ? cleanTitle.data : undefined }),
      { timeout: 60_000 }
    )
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'LMS_COURSE_IMPORTED',
        entityType: 'LMSCourse',
        entityId: courseId,
        details: JSON.stringify({
          files: parsed.data.length,
          modules: course.modules.length,
          lessons: course.modules.reduce((a, m) => a + m.lessons.length, 0),
        }),
      },
    })
    revalidatePath('/admin/lms')
    return { success: true, courseId, warnings: course.warnings }
  } catch (error) {
    console.error('Error importing course:', error)
    return { error: 'The import failed and nothing was saved. Please try again.' }
  }
}
