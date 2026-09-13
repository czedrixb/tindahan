import { defineConfig, devices } from '@playwright/test'
import baseConfig from './playwright.config'

export default defineConfig({
  ...baseConfig,
  projects: [
    {
      name: 'mobile-webkit',
      // Desktop-only workspace coverage doesn't apply to this phone-width
      // viewport - see the same exclusion on playwright.config.ts's
      // mobile-chrome project.
      testIgnore: /20-desktop-workspace\.spec\.ts/,
      use: {
        ...devices['iPhone 13'],
        storageState: './tests/e2e/.auth/storage-state.json',
      },
    },
  ],
})
