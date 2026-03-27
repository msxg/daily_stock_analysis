import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/app/App'
import { server } from '../../tests/mocks/server'

describe('Dashboard API baseline', () => {
  it('submits analysis and loads history report summary', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/')
    render(<App />)

    await user.type(screen.getByLabelText('股票代码'), '600519')
    await user.click(screen.getByRole('button', { name: '提交分析' }))

    expect(await screen.findByText('分析任务已提交（1）')).toBeInTheDocument()
    expect(await screen.findByText('分析完成')).toBeInTheDocument()

    const historyPanel = await screen.findByTestId('history-panel')
    expect(await within(historyPanel).findByRole('button', { name: /贵州茅台/ })).toBeInTheDocument()
    expect(await screen.findByText(/趋势保持震荡上行/)).toBeInTheDocument()
  })

  it('switches report tabs and loads tab-specific content', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/')
    render(<App />)

    await screen.findByText(/趋势保持震荡上行/)

    await user.click(screen.getByRole('button', { name: '策略点位' }))
    expect(await screen.findByText(/1800 元附近分批介入/)).toBeInTheDocument()
    expect(screen.getByTestId('report-tab-content-strategy')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '资讯' }))
    expect(await screen.findByText('白酒板块午后走强')).toBeInTheDocument()
    expect(screen.getByTestId('report-tab-content-news')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '透明度' }))
    expect(await screen.findByText('mock:msw')).toBeInTheDocument()
    expect(screen.getByTestId('report-tab-content-transparency')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '查看 Markdown' }))
    const markdownText = await screen.findByText(/继续观察回踩后的承接力度/)
    const markdownPre = markdownText.closest('pre')
    expect(markdownPre).not.toBeNull()
    expect(markdownPre).toHaveClass('overflow-x-auto')
    expect(markdownPre).not.toHaveClass('max-h-80')
    expect(markdownPre).not.toHaveClass('overflow-auto')
    expect(screen.getByTestId('report-tab-content-markdown')).toBeInTheDocument()
  })

  it('switches report panel when clicking a completed task card', async () => {
    const user = userEvent.setup()

    server.use(
      http.get('/api/v1/analysis/tasks', () =>
        HttpResponse.json({
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
      ),
      http.get('/api/v1/history', ({ request }) => {
        const stockCode = new URL(request.url).searchParams.get('stock_code')

        if (stockCode === '600875.SH') {
          return HttpResponse.json({
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
          })
        }

        return HttpResponse.json({
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
        })
      }),
      http.get('/api/v1/history/:recordId', ({ params }) => {
        const recordId = Number(params.recordId)

        if (recordId === 102) {
          return HttpResponse.json({
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
          })
        }

        return HttpResponse.json({
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
        })
      }),
    )

    window.history.pushState({}, '', '/')
    render(<App />)

    const reportPanel = await screen.findByTestId('dashboard-report-panel')
    expect(await within(reportPanel).findByText(/贵州茅台 · 600519/)).toBeInTheDocument()
    expect(await within(reportPanel).findByText(/趋势保持震荡上行/)).toBeInTheDocument()

    await user.click(await screen.findByTestId('task-item-task-mock-002'))

    expect(await within(reportPanel).findByText(/东方电气 · 600875\.SH/)).toBeInTheDocument()
    expect(await within(reportPanel).findByText(/电网设备景气修复/)).toBeInTheDocument()
  })

  it('shows validation error for invalid mixed query', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/')
    render(<App />)

    await user.type(screen.getByLabelText('股票代码'), 'abc123')
    await user.click(screen.getByRole('button', { name: '提交分析' }))

    expect(await screen.findByText('请输入有效的股票代码或股票名称')).toBeInTheDocument()
  })

  it('supports mobile report/history pane switcher', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/')
    render(<App />)

    const historyPaneButton = screen.getByTestId('mobile-pane-history')
    const reportPaneButton = screen.getByTestId('mobile-pane-report')

    expect(reportPaneButton).toHaveAttribute('aria-pressed', 'true')
    expect(historyPaneButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(historyPaneButton)
    expect(historyPaneButton).toHaveAttribute('aria-pressed', 'true')
    expect(reportPaneButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(reportPaneButton)
    expect(reportPaneButton).toHaveAttribute('aria-pressed', 'true')
    expect(historyPaneButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('supports management mode and bulk delete history', async () => {
    const user = userEvent.setup()
    let deleted = false
    let deletedPayload: unknown = null

    server.use(
      http.get('/api/v1/history', () => {
        if (deleted) {
          return HttpResponse.json({ total: 0, page: 1, limit: 20, items: [] })
        }

        return HttpResponse.json({
          total: 2,
          page: 1,
          limit: 20,
          items: [
            {
              id: 201,
              query_id: 'q-mock-201',
              stock_code: '000001',
              stock_name: '平安银行',
              report_type: 'detailed',
              sentiment_score: 53,
              operation_advice: '持有',
              created_at: '2026-03-26T09:10:00+08:00',
            },
            {
              id: 202,
              query_id: 'q-mock-202',
              stock_code: '00700.HK',
              stock_name: '腾讯控股',
              report_type: 'detailed',
              sentiment_score: 58,
              operation_advice: '观察',
              created_at: '2026-03-26T09:00:00+08:00',
            },
          ],
        })
      }),
      http.get('/api/v1/history/:recordId', ({ params }) => {
        return HttpResponse.json({
          meta: {
            id: Number(params.recordId),
            query_id: 'q-detail',
            stock_code: '000001',
            stock_name: '平安银行',
            report_type: 'detailed',
            created_at: '2026-03-26T09:10:00+08:00',
          },
          summary: {
            analysis_summary: '测试摘要',
            operation_advice: '测试建议',
            trend_prediction: '测试预测',
            sentiment_score: 53,
          },
        })
      }),
      http.delete('/api/v1/history', async ({ request }) => {
        deletedPayload = await request.json()
        deleted = true
        return HttpResponse.json({ deleted: 2 })
      }),
    )

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    window.history.pushState({}, '', '/')
    render(<App />)

    await screen.findByText(/平安银行/)
    await screen.findByText(/腾讯控股/)

    await user.click(screen.getByRole('button', { name: '管理模式' }))
    await user.click(screen.getByRole('button', { name: '全选' }))
    await user.click(screen.getByRole('button', { name: /删除选中/ }))

    expect(deletedPayload).toEqual({ record_ids: [201, 202] })
    expect(await screen.findByText('已删除 2 条历史记录。')).toBeInTheDocument()
    expect(await screen.findByText('暂无历史记录，先提交一次分析任务。')).toBeInTheDocument()

    confirmSpy.mockRestore()
  })
})
