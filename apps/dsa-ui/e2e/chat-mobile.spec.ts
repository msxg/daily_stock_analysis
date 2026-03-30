import { expect, test } from '@playwright/test'
import { ensureBackendAuthenticated } from './auth'

test.describe('Chat mobile layout', () => {
  test.use({ viewport: { width: 375, height: 667 } }) // iPhone SE viewport

  test('mobile layout renders correctly without horizontal overflow', async ({ page }) => {
    // Navigate to chat page
    await page.goto('/chat')

    // Wait for page to load (may show login if auth is enabled)
    await page.waitForLoadState('networkidle')

    // Check that the page does not have horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10) // Allow 10px tolerance
  })

  test('mobile page body has correct max-width constraint', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('networkidle')

    // Verify body/content doesn't exceed viewport
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyScrollWidth).toBeLessThanOrEqual(375 + 10) // Allow 10px tolerance
  })
})

test.describe('Chat mobile layout with backend @backend', () => {
  test.use({ viewport: { width: 375, height: 667 } }) // iPhone SE viewport
  test.skip(process.env.RUN_BACKEND_E2E !== '1', 'Set RUN_BACKEND_E2E=1 to run backend integration tests')

  test('mobile layout with authenticated session', async ({ page }) => {
    await ensureBackendAuthenticated(page, '/chat')

    // Wait for page to load
    await expect(page.getByTestId('page-chat')).toBeVisible()

    // Check that the page does not have horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10) // Allow 10px tolerance

    // Verify mobile switcher is visible
    await expect(page.getByTestId('chat-mobile-switcher')).toBeVisible()
    await expect(page.getByTestId('chat-mobile-pane-sessions')).toBeVisible()
    await expect(page.getByTestId('chat-mobile-pane-messages')).toBeVisible()
  })

  test('mobile session list panel renders correctly', async ({ page }) => {
    await ensureBackendAuthenticated(page, '/chat')
    await expect(page.getByTestId('page-chat')).toBeVisible()

    // Switch to sessions pane
    await page.getByTestId('chat-mobile-pane-sessions').click()

    // Check mobile session panel is visible
    const sessionPanel = page.getByTestId('chat-mobile-session-panel')
    await expect(sessionPanel).toBeVisible()

    // Check that session panel does not overflow
    const panelBox = await sessionPanel.boundingBox()
    expect(panelBox).not.toBeNull()
    if (panelBox) {
      expect(panelBox.x).toBeGreaterThanOrEqual(0)
      expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(375 + 10) // Allow 10px tolerance
    }
  })

  test('mobile messages panel with skill panel layout', async ({ page }) => {
    await ensureBackendAuthenticated(page, '/chat')
    await expect(page.getByTestId('page-chat')).toBeVisible()

    // Switch to messages pane
    await page.getByTestId('chat-mobile-pane-messages').click()

    // Check message panel is visible
    const messagePanel = page.getByTestId('chat-message-panel')
    await expect(messagePanel).toBeVisible()

    // Check skill panel is within viewport
    const skillPanelBox = await page.getByTestId('chat-skill-panel').boundingBox()
    expect(skillPanelBox).not.toBeNull()
    if (skillPanelBox) {
      expect(skillPanelBox.x).toBeGreaterThanOrEqual(0)
      expect(skillPanelBox.x + skillPanelBox.width).toBeLessThanOrEqual(375 + 10) // Allow 10px tolerance
    }

    // Check input area is visible and within viewport
    const inputBox = await page.getByTestId('chat-input').boundingBox()
    expect(inputBox).not.toBeNull()
    if (inputBox) {
      expect(inputBox.x).toBeGreaterThanOrEqual(0)
      expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(375 + 10) // Allow 10px tolerance
    }

    // Check send button is visible
    await expect(page.getByTestId('chat-send-message')).toBeVisible()
  })

  test('mobile message list does not overflow horizontally', async ({ page }) => {
    await ensureBackendAuthenticated(page, '/chat')
    await expect(page.getByTestId('page-chat')).toBeVisible()

    // Switch to messages pane
    await page.getByTestId('chat-mobile-pane-messages').click()

    // Check message list does not overflow horizontally
    const messageList = page.getByTestId('chat-message-list')
    await expect(messageList).toBeVisible()

    // Verify no horizontal overflow in message list
    const overflowX = await messageList.evaluate((el) => {
      return el.scrollWidth > el.clientWidth + 10
    })
    expect(overflowX).toBe(false)
  })
})