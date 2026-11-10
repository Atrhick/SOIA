import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // Only the app's own tests; agent worktrees under .claude/ hold copies of the repo.
  test: { include: ['src/**/*.test.ts'], exclude: ['node_modules/**', '.claude/**'] },
})
