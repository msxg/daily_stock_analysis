import { expect, test } from '@playwright/test'
import { ensureBackendAuthenticated } from './auth'

function pickSessions(payload: unknown): Array<{ title?: string }> {
  if (Array.isArray(payload)) return payload as Array<{ title?: string }>
  if (payload && typeof payload === 'object') {
    const root = payload as Record<string, unknown>
    if (Array.isArray(root.sessions)) return root.sessions as Array<{ title?: string }>
    const data = root.data
    if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).sessions)) {
      return (data as Record<string, unknown>).sessions as Array<{ title?: string }>
    }
  }
  return []
}

test.describe('Chat backend integration @backend', () => {
  test.skip(process.env.RUN_BACKEND_E2E !== '1', 'Set RUN_BACKEND_E2E=1 to run backend integration tests')

  test('loads chat sessions from real backend and keeps local new-session flow', async ({ page }) => {
    await ensureBackendAuthenticated(page, '/chat')
    const sessionsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/agent/chat/sessions')
        && response.request().method() === 'GET'
        && response.status() === 200,
    )
    await page.reload()
    await expect(page.getByTestId('page-chat')).toBeVisible()
    await expect(page.getByTestId('chat-session-manager-toggle')).toBeVisible()
    await expect(page.getByTestId('chat-export-session')).toBeVisible()
    await expect(page.getByTestId('chat-send-session')).toBeVisible()
    await expect(page.getByTestId('chat-skill-select')).toBeVisible()
    await expect(page.getByTestId('chat-input')).toBeVisible()
    await expect(page.getByTestId('chat-send-message')).toBeVisible()

    const sessionsResponse = await sessionsResponsePromise
    expect(sessionsResponse.status()).toBe(200)

    const sessions = pickSessions(await sessionsResponse.json())

    await expect(page.getByTestId('chat-current-session-title')).toContainText('新会话')
    await expect(page.getByTestId('chat-current-session-id')).toContainText('local-')
    await expect(page.getByTestId('chat-session-context-status')).toContainText('本地草稿')
    await page.getByTestId('chat-session-manager-toggle').click()
    await expect(page.getByTestId('chat-session-panel')).toBeVisible()
    if (sessions.length > 0 && sessions[0].title) {
      const titlePrefix = sessions[0].title.slice(0, 6)
      await expect(page.getByTestId('chat-session-list')).toContainText(titlePrefix)
    }

    await page.getByTestId('chat-new-session').click()
    await expect(page.getByTestId('chat-current-session-title')).toContainText('新会话')
    await expect(page.getByTestId('chat-current-session-id')).toContainText('local-')
  })
})
