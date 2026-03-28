import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/app/App'
import { server } from '../../tests/mocks/server'

vi.mock('@/shared/ui/charts/AreaTrendChart', () => ({
  AreaTrendChart: () => <div data-testid="mock-area-chart" />,
}))

describe('App shell routing', () => {
  it('logs out and returns to login page', async () => {
    const user = userEvent.setup()
    let loggedIn = true

    server.use(
      http.get('/api/v1/auth/me', () => {
        if (!loggedIn) {
          return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
        }
        return HttpResponse.json({
          authenticated: true,
          auth_enabled: true,
          user: {
            id: 1,
            username: 'admin',
            display_name: 'Admin',
            is_system_admin: true,
          },
          active_tenant: {
            id: 1,
            slug: 'default',
            name: 'Default Workspace',
            role: 'system_admin',
          },
          available_tenants: [
            {
              id: 1,
              slug: 'default',
              name: 'Default Workspace',
              role: 'system_admin',
            },
          ],
          capabilities: ['system.config.read', 'system.config.write'],
        })
      }),
      http.get('/api/v1/auth/status', () =>
        HttpResponse.json({
          auth_enabled: true,
          logged_in: loggedIn,
          password_set: true,
          password_changeable: true,
          setup_state: 'enabled',
        }),
      ),
      http.post('/api/v1/auth/logout', () => {
        loggedIn = false
        return HttpResponse.json({ success: true })
      }),
    )

    window.history.pushState({}, '', '/')
    render(<App />)

    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
    await user.click(screen.getByTestId('shell-logout-button'))
    expect(await screen.findByTestId('page-login')).toBeInTheDocument()
  })

  it('redirects to login when auth is enabled but session is missing', async () => {
    server.use(
      http.get('/api/v1/auth/me', () => HttpResponse.json({ error: 'unauthorized' }, { status: 401 })),
      http.get('/api/v1/auth/status', () =>
        HttpResponse.json({
          auth_enabled: true,
          logged_in: false,
          password_set: true,
          password_changeable: true,
          setup_state: 'enabled',
        }),
      ),
    )

    window.history.pushState({}, '', '/')
    render(<App />)

    expect(await screen.findByTestId('page-login')).toBeInTheDocument()
  })

  it('renders dashboard by default', () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('page-title-dashboard')).toHaveTextContent('分析台')
    expect(screen.getByTestId('shell-page-description')).toHaveTextContent(
      '支持分析提交、任务查询、历史管理，以及报告多维 Tab 浏览。',
    )
  })

  it('switches to chat page from nav link', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/')
    render(<App />)

    await user.click(screen.getAllByRole('link', { name: '问股' })[0])
    expect(await screen.findByTestId('page-chat')).toBeInTheDocument()
    expect(screen.getByTestId('page-title-chat')).toHaveTextContent('问股')
    expect(screen.getByTestId('shell-page-description')).toHaveTextContent(
      '支持 Markdown 消息、流式进度、分析台上下文追问和移动端双视图切换。',
    )
  })

  it('keeps shell header as the visible title source for main workspace pages', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(screen.getByTestId('page-title-dashboard')).not.toBeVisible()

    await user.click(screen.getAllByRole('link', { name: '持仓' })[0])
    expect(await screen.findByTestId('page-portfolio')).toBeInTheDocument()
    expect(screen.getByTestId('page-title-portfolio')).not.toBeVisible()
    expect(screen.getByTestId('shell-page-description')).toHaveTextContent(
      '拆分为总览、持仓、录入、导入、流水五个任务面板，并保持全部后端 API 兼容。',
    )

    await user.click(screen.getAllByRole('link', { name: '回测' })[0])
    expect(await screen.findByTestId('page-backtest')).toBeInTheDocument()
    expect(screen.getByTestId('page-title-backtest')).not.toBeVisible()
    expect(screen.getByTestId('shell-page-description')).toHaveTextContent(
      '支持筛选、运行、KPI、趋势图与分页结果表，图表统一使用 lightweight-charts。',
    )

    await user.click(screen.getAllByRole('link', { name: '设置' })[0])
    expect(await screen.findByTestId('page-settings')).toBeInTheDocument()
    expect(screen.getByTestId('page-title-settings')).not.toBeVisible()
    expect(screen.getByTestId('shell-page-description')).toHaveTextContent(
      '支持分类导航、Theme 切换、配置校验、认证管理、渠道测试和桌面端 env 导入导出。',
    )
  })
})
