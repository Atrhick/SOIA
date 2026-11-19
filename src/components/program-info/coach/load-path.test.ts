import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/actions/feature-config', () => ({ isFeatureEnabled: vi.fn() }))
vi.mock('@/lib/actions/program-info', () => ({ getMyPageDetail: vi.fn(), getMyProgramPages: vi.fn() }))
import { programIdOfOwnerPath } from './load'
import { viewForPath } from '@/app/(auth)/login/signed-in-notice'

describe('owner page links', () => {
  it('finds the program id', () => {
    expect(programIdOfOwnerPath('/coach/programs/abc123/setup')).toBe('abc123')
    expect(programIdOfOwnerPath('/ambassador/programs/x9')).toBe('x9')
    expect(programIdOfOwnerPath('/coach/programs')).toBeNull()
    expect(programIdOfOwnerPath('/admin/program-pages/abc')).toBeNull()
  })
  it('knows which view a page needs', () => {
    expect(viewForPath('/coach/programs/a/setup')?.role).toBe('COACH')
    expect(viewForPath('/team/support')?.role).toBe('SUB_ADMIN')
    expect(viewForPath('/running-costs')).toBeNull()
  })
})
