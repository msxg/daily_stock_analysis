import { expect, test } from '@playwright/test'
import { ensureBackendAuthenticated } from './auth'

test.describe('Dashboard backend integration @backend', () => {
  test.skip(process.env.RUN_BACKEND_E2E !== '1', 'Set RUN_BACKEND_E2E=1 to run backend integration tests')

  test('loads history and tasks from real backend through proxy', async ({ page }) => {
    await ensureBackendAuthenticated(page, '/')
    const historyResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/history')
        && response.request().method() === 'GET'
        && response.status() === 200,
    )
    const taskResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/analysis/tasks')
        && response.request().method() === 'GET'
        && response.status() === 200,
    )
    await page.reload()
    await expect(page.getByTestId('page-dashboard')).toBeVisible()
    await expect(page.getByTestId('task-panel')).toBeVisible()
    await expect(page.getByTestId('history-panel')).toBeVisible()

    const historyResponse = await historyResponsePromise
    const taskResponse = await taskResponsePromise
    expect(historyResponse.status()).toBe(200)
    expect(taskResponse.status()).toBe(200)

    const historyPayload = (await historyResponse.json()) as {
      total: number
      items: Array<{ stock_name?: string; stock_code: string }>
    }

    if (historyPayload.total === 0) {
      await expect(page.getByText('暂无历史记录，先提交一次分析任务。')).toBeVisible()
      return
    }

    const first = historyPayload.items[0]
    const label = first.stock_name || first.stock_code
    await expect(page.getByTestId('history-panel').getByRole('button', { name: new RegExp(label) })).toBeVisible()
    await expect(page.getByTestId('dashboard-report-panel')).toBeVisible()

    await page.getByRole('button', { name: '策略点位' }).click()
    await expect(page.getByTestId('report-tab-content-strategy')).toBeVisible()

    await page.getByRole('button', { name: '查看 Markdown' }).click()
    await expect(page.getByTestId('report-tab-content-markdown')).toBeVisible()
  })
})
