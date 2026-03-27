import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('desktop navigation and accessibility smoke @visual', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('page-dashboard')).toBeVisible()

  await page.getByRole('link', { name: '问股' }).first().click()
  await expect(page.getByTestId('page-chat')).toBeVisible()
  await expect(page.getByTestId('chat-export-session')).toBeVisible()
  await expect(page.getByTestId('chat-send-session')).toBeVisible()
  await expect(page.getByTestId('chat-skill-select')).toBeVisible()
  await expect(page.getByTestId('chat-input')).toBeVisible()
  await expect(page.getByTestId('chat-send-message')).toBeVisible()

  await expect(page.getByTestId('shell-glow-left')).toBeVisible()
  await expect(page.getByTestId('shell-glow-right')).toBeVisible()

  const accessibilityScanResults = await new AxeBuilder({ page })
    .include('[data-testid="app-shell"]')
    .analyze()
  expect(accessibilityScanResults.violations).toEqual([])
})

test('chat page supports creating local draft session @visual', async ({ page }) => {
  await page.goto('/chat')
  await expect(page.getByTestId('page-chat')).toBeVisible()
  await expect(page.getByTestId('chat-session-manager-toggle')).toBeVisible()
  await page.getByTestId('chat-session-manager-toggle').click()
  await expect(page.getByTestId('chat-session-panel')).toBeVisible()

  await page.getByTestId('chat-new-session').click()
  await expect(page.getByTestId('chat-empty-state')).toBeVisible()
  await expect(page.getByTestId('chat-current-session-title')).toContainText('新会话')
  await expect(page.getByTestId('chat-current-session-id')).toContainText('local-')
  await expect(page.getByTestId('chat-send-message')).toBeDisabled()
})

test('dashboard task cards switch report panel content @visual', async ({ page }) => {
  await page.route('**/api/v1/analysis/tasks*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 2,
        pending: 0,
        processing: 0,
        tasks: [
          {
            task_id: 'task-mock-001',
            stock_code: '600519',
            stock_name: '贵州茅台',
            status: 'completed',
            progress: 100,
            message: '分析完成',
            report_type: 'detailed',
            created_at: '2026-03-27T10:00:00+08:00',
          },
          {
            task_id: 'task-mock-002',
            stock_code: '600875.SH',
            stock_name: '东方电气',
            status: 'completed',
            progress: 100,
            message: '分析完成',
            report_type: 'detailed',
            created_at: '2026-03-27T11:00:00+08:00',
          },
        ],
      }),
    })
  })

  await page.route('**/api/v1/history**', async (route) => {
    const url = new URL(route.request().url())
    const pathname = url.pathname

    if (pathname.endsWith('/api/v1/history')) {
      const stockCode = url.searchParams.get('stock_code')
      if (stockCode === '600875.SH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            total: 1,
            page: 1,
            limit: 20,
            items: [
              {
                id: 102,
                query_id: 'q-mock-102',
                stock_code: '600875.SH',
                stock_name: '东方电气',
                report_type: 'detailed',
                sentiment_score: 61,
                operation_advice: '观察',
                created_at: '2026-03-27T11:08:00+08:00',
              },
            ],
          }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 1,
          page: 1,
          limit: 20,
          items: [
            {
              id: 101,
              query_id: 'q-mock-101',
              stock_code: '600519',
              stock_name: '贵州茅台',
              report_type: 'detailed',
              sentiment_score: 67,
              operation_advice: '持有',
              created_at: '2026-03-26T09:30:00+08:00',
            },
          ],
        }),
      })
      return
    }

    if (pathname.endsWith('/api/v1/history/102')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          meta: {
            id: 102,
            query_id: 'q-mock-102',
            stock_code: '600875.SH',
            stock_name: '东方电气',
            report_type: 'detailed',
            created_at: '2026-03-27T11:08:00+08:00',
          },
          summary: {
            analysis_summary: '电网设备景气修复，短线关注放量突破确认。',
            operation_advice: '等待放量站稳关键位后再跟进。',
            trend_prediction: '短线偏震荡，向上弹性大于向下空间。',
            sentiment_score: 61,
          },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        meta: {
          id: 101,
          query_id: 'q-mock-101',
          stock_code: '600519',
          stock_name: '贵州茅台',
          report_type: 'detailed',
          created_at: '2026-03-26T09:30:00+08:00',
        },
        summary: {
          analysis_summary: '趋势保持震荡上行，短期波动可控。',
          operation_advice: '分批持有，回踩再加仓。',
          trend_prediction: '未来 5 个交易日偏震荡上行。',
          sentiment_score: 67,
        },
      }),
    })
  })

  await page.goto('/')
  await expect(page.getByTestId('page-dashboard')).toBeVisible()
  await expect(page.getByTestId('dashboard-report-panel')).toContainText('贵州茅台')
  await expect(page.getByTestId('dashboard-report-panel')).toContainText('趋势保持震荡上行')

  await page.getByTestId('task-item-task-mock-002').click()

  await expect(page.getByTestId('dashboard-report-panel')).toContainText('东方电气')
  await expect(page.getByTestId('dashboard-report-panel')).toContainText('电网设备景气修复')
})

test('main workspace pages keep visible title and summary in shell header @visual', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '分析台', level: 1 })).toBeVisible()
  await expect(page.getByTestId('shell-page-description')).toHaveText('支持分析提交、任务查询、历史管理，以及报告多维 Tab 浏览。')
  await expect(page.getByTestId('page-title-dashboard')).not.toBeVisible()
  await expect(page.getByText(/^Workspace$/)).toHaveCount(0)
  await expect(page.getByText(/^DSA UI Alpha$/)).toHaveCount(0)
  await expect(page.getByText(/^Phase 0 Baseline$/)).toHaveCount(0)

  await page.getByRole('link', { name: '持仓' }).first().click()
  await expect(page.getByTestId('page-portfolio')).toBeVisible()
  await expect(page.getByRole('heading', { name: '持仓', level: 1 })).toBeVisible()
  await expect(page.getByTestId('shell-page-description')).toHaveText(
    '拆分为总览、持仓、录入、导入、流水五个任务面板，并保持全部后端 API 兼容。',
  )
  await expect(page.getByTestId('page-title-portfolio')).not.toBeVisible()

  await page.getByRole('link', { name: '回测' }).first().click()
  await expect(page.getByTestId('page-backtest')).toBeVisible()
  await expect(page.getByRole('heading', { name: '回测', level: 1 })).toBeVisible()
  await expect(page.getByTestId('shell-page-description')).toHaveText(
    '支持筛选、运行、KPI、趋势图与分页结果表，图表统一使用 lightweight-charts。',
  )
  await expect(page.getByTestId('page-title-backtest')).not.toBeVisible()

  await page.getByRole('link', { name: '设置' }).first().click()
  await expect(page.getByTestId('page-settings')).toBeVisible()
  await expect(page.getByRole('heading', { name: '设置', level: 1 })).toBeVisible()
  await expect(page.getByTestId('shell-page-description')).toHaveText(
    '支持分类导航、字段搜索、配置校验、认证管理、渠道测试和桌面端 env 导入导出。',
  )
  await expect(page.getByTestId('page-title-settings')).not.toBeVisible()
})

test('mobile bottom tab navigation works @visual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByTestId('page-dashboard')).toBeVisible()

  await expect(page.getByTestId('mobile-view-switcher')).toBeVisible()
  await expect(page.getByTestId('dashboard-report-panel')).toBeVisible()

  await page.getByTestId('mobile-pane-history').click()
  await expect(page.getByTestId('history-panel')).toBeVisible()
  await expect(page.getByTestId('dashboard-report-panel')).toBeHidden()

  await page.getByTestId('mobile-pane-report').click()
  await expect(page.getByTestId('dashboard-report-panel')).toBeVisible()

  await page.getByTestId('mobile-tab-回测').click()
  await expect(page.getByTestId('page-backtest')).toBeVisible()
})

test('initial load metrics stay inside baseline @perf', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })

  const navTiming = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    return {
      domContentLoaded: nav.domContentLoadedEventEnd,
      loadEventEnd: nav.loadEventEnd,
    }
  })

  expect(navTiming.domContentLoaded).toBeLessThan(3000)
  expect(navTiming.loadEventEnd).toBeLessThan(6000)
})
