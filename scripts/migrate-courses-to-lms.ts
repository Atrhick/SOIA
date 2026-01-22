/**
 * Migration Script: Old Courses to New LMS Structure
 *
 * This script migrates data from the old Course model to the new LMS structure.
 *
 * Migration mapping:
 * - Course → LMSCourse + LMSModule + LMSLesson + LMSContentBlock
 * - QuizQuestion/QuizOption → Survey + SurveyQuestion + SurveyOption
 * - QuizResult → LMSEnrollment (with completed status)
 *
 * Run with: npx tsx scripts/migrate-courses-to-lms.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface MigrationResult {
  coursesProcessed: number
  coursesCreated: number
  surveysCreated: number
  enrollmentsCreated: number
  errors: string[]
}

async function migrateCoursesToLMS(): Promise<MigrationResult> {
  const result: MigrationResult = {
    coursesProcessed: 0,
    coursesCreated: 0,
    surveysCreated: 0,
    enrollmentsCreated: 0,
    errors: [],
  }

  console.log('Starting course migration...\n')

  // Get admin user ID for createdBy field
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  })

  if (!adminUser) {
    result.errors.push('No admin user found. Please create an admin user first.')
    return result
  }

  // Fetch all old courses with their questions and results
  const oldCourses = await prisma.course.findMany({
    include: {
      questions: {
        orderBy: { sortOrder: 'asc' },
        include: {
          options: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      results: {
        include: {
          coach: {
            include: {
              user: true,
            },
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  console.log(`Found ${oldCourses.length} old courses to migrate.\n`)

  for (const oldCourse of oldCourses) {
    result.coursesProcessed++
    console.log(`\nProcessing: "${oldCourse.name}"`)

    try {
      // Check if already migrated (by matching title)
      const existing = await prisma.lMSCourse.findFirst({
        where: { title: oldCourse.name },
      })

      if (existing) {
        console.log(`  - Skipping: Already migrated as LMS course "${existing.id}"`)
        continue
      }

      // Create LMS Course
      const lmsCourse = await prisma.lMSCourse.create({
        data: {
          title: oldCourse.name,
          description: oldCourse.description,
          status: oldCourse.isActive ? 'PUBLISHED' : 'ARCHIVED',
          allowedRoles: ['COACH'], // Old courses were for coaches
          sortOrder: oldCourse.sortOrder,
          createdBy: adminUser.id,
          publishedAt: oldCourse.isActive ? new Date() : null,
        },
      })
      result.coursesCreated++
      console.log(`  - Created LMS Course: ${lmsCourse.id}`)

      // Create a single module for the course content
      const module = await prisma.lMSModule.create({
        data: {
          courseId: lmsCourse.id,
          title: 'Course Content',
          description: 'Main course content and assessment',
          sortOrder: 0,
        },
      })
      console.log(`  - Created Module: ${module.id}`)

      // Create lesson for video content if exists
      let lessonSortOrder = 0

      if (oldCourse.videoUrl || oldCourse.embedCode) {
        const videoLesson = await prisma.lMSLesson.create({
          data: {
            moduleId: module.id,
            title: 'Course Video',
            description: 'Watch the course video to learn the material.',
            sortOrder: lessonSortOrder++,
          },
        })

        // Create video content block
        if (oldCourse.videoUrl) {
          await prisma.lMSContentBlock.create({
            data: {
              lessonId: videoLesson.id,
              type: 'VIDEO',
              title: 'Course Video',
              content: {
                url: oldCourse.videoUrl,
                provider: detectVideoProvider(oldCourse.videoUrl),
              },
              sortOrder: 0,
            },
          })
        } else if (oldCourse.embedCode) {
          // Embed code goes as TEXT content
          await prisma.lMSContentBlock.create({
            data: {
              lessonId: videoLesson.id,
              type: 'TEXT',
              title: 'Video Content',
              content: {
                content: oldCourse.embedCode,
                format: 'html',
              },
              sortOrder: 0,
            },
          })
        }

        console.log(`  - Created Video Lesson: ${videoLesson.id}`)
      }

      // Create survey from quiz questions if they exist
      if (oldCourse.questions.length > 0) {
        const survey = await prisma.survey.create({
          data: {
            title: `${oldCourse.name} - Quiz`,
            description: `Quiz for the course: ${oldCourse.name}`,
            type: 'QUIZ',
            status: 'PUBLISHED',
            allowedRoles: ['COACH'],
            passingScore: 70,
            allowRetake: true,
            showResults: true,
            isAnonymous: false,
            createdBy: adminUser.id,
            publishedAt: new Date(),
          },
        })
        result.surveysCreated++
        console.log(`  - Created Survey: ${survey.id}`)

        // Create survey questions
        for (const oldQuestion of oldCourse.questions) {
          const surveyQuestion = await prisma.surveyQuestion.create({
            data: {
              surveyId: survey.id,
              questionText: oldQuestion.questionText,
              questionType: 'MULTIPLE_CHOICE',
              isRequired: true,
              sortOrder: oldQuestion.sortOrder,
            },
          })

          // Create survey options
          for (const oldOption of oldQuestion.options) {
            await prisma.surveyOption.create({
              data: {
                questionId: surveyQuestion.id,
                optionText: oldOption.optionText,
                isCorrect: oldOption.isCorrect,
                sortOrder: oldOption.sortOrder,
              },
            })
          }
        }
        console.log(`  - Created ${oldCourse.questions.length} quiz questions`)

        // Create quiz lesson and link to survey
        const quizLesson = await prisma.lMSLesson.create({
          data: {
            moduleId: module.id,
            title: 'Course Quiz',
            description: 'Complete the quiz to demonstrate your understanding.',
            sortOrder: lessonSortOrder++,
          },
        })

        await prisma.lMSContentBlock.create({
          data: {
            lessonId: quizLesson.id,
            type: 'QUIZ',
            title: 'Course Assessment',
            content: {
              surveyId: survey.id,
              passingScore: 70,
            },
            sortOrder: 0,
          },
        })
        console.log(`  - Created Quiz Lesson: ${quizLesson.id}`)
      }

      // Migrate quiz results to enrollments
      for (const oldResult of oldCourse.results) {
        try {
          // Check if enrollment already exists
          const existingEnrollment = await prisma.lMSEnrollment.findUnique({
            where: {
              courseId_userId: {
                courseId: lmsCourse.id,
                userId: oldResult.coach.userId,
              },
            },
          })

          if (!existingEnrollment) {
            await prisma.lMSEnrollment.create({
              data: {
                userId: oldResult.coach.userId,
                courseId: lmsCourse.id,
                status: oldResult.passed ? 'COMPLETED' : 'IN_PROGRESS',
                progressPercentage: oldResult.passed ? 100 : 50,
                completedAt: oldResult.passed ? oldResult.completedAt : null,
                enrolledAt: oldResult.createdAt,
                lastAccessedAt: oldResult.completedAt,
              },
            })
            result.enrollmentsCreated++
          }
        } catch (enrollError) {
          console.log(`  - Warning: Could not migrate result for coach ${oldResult.coachId}`)
        }
      }

      if (oldCourse.results.length > 0) {
        console.log(`  - Migrated ${oldCourse.results.length} quiz results to enrollments`)
      }
    } catch (error) {
      const errorMessage = `Error migrating course "${oldCourse.name}": ${error}`
      result.errors.push(errorMessage)
      console.error(`  - ERROR: ${error}`)
    }
  }

  return result
}

function detectVideoProvider(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube'
  }
  if (url.includes('vimeo.com')) {
    return 'vimeo'
  }
  return 'direct'
}

async function main() {
  console.log('='.repeat(60))
  console.log('LMS Course Migration Script')
  console.log('='.repeat(60))

  try {
    const result = await migrateCoursesToLMS()

    console.log('\n' + '='.repeat(60))
    console.log('Migration Summary')
    console.log('='.repeat(60))
    console.log(`Courses Processed: ${result.coursesProcessed}`)
    console.log(`LMS Courses Created: ${result.coursesCreated}`)
    console.log(`Surveys Created: ${result.surveysCreated}`)
    console.log(`Enrollments Created: ${result.enrollmentsCreated}`)

    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.errors.length}):`)
      result.errors.forEach((err) => console.log(`  - ${err}`))
    } else {
      console.log('\nNo errors occurred!')
    }

    console.log('\nMigration complete!')
  } catch (error) {
    console.error('Fatal error during migration:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
