import { expect, type Page, test } from '@playwright/test'

const E2E_USERNAME = process.env.DSA_UI_E2E_USERNAME || process.env.DSA_E2E_USERNAME || 'admin'
const E2E_PASSWORD = process.env.DSA_UI_E2E_PASSWORD || process.env.DSA_E2E_PASSWORD || ''

export async function ensureBackendAuthenticated(page: Page, targetPath: string): Promise<void> {
  await page.goto(targetPath)

  let redirectedToLogin = false
  try {
    await page.waitForURL(/\/login(\?|$)/, { timeout: 3_000 })
    redirectedToLogin = true
  } catch {
    redirectedToLogin = false
  }

  if (!redirectedToLogin) {
    return
  }

  test.skip(
    !E2E_PASSWORD,
    'Backend auth is enabled. Set DSA_UI_E2E_PASSWORD (or DSA_E2E_PASSWORD) to run @backend e2e tests.',
  )

  await expect(page.getByTestId('page-login')).toBeVisible()
  await page.getByTestId('login-username').fill(E2E_USERNAME)
  await page.getByTestId('login-password').fill(E2E_PASSWORD)

  const confirmInput = page.getByTestId('login-password-confirm')
  if ((await confirmInput.count()) > 0) {
    await confirmInput.fill(E2E_PASSWORD)
  }

  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 })
}
