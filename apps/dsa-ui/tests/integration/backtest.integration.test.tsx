import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/app/App'

vi.mock('@/shared/ui/charts/AreaTrendChart', () => ({
  AreaTrendChart: () => <div data-testid="mock-area-chart" />,
}))

describe('Backtest workspace', () => {
  it('supports filtering and running backtest', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/')
    render(<App />)

    await user.click(screen.getAllByRole('link', { name: '回测' })[0])
    expect(await screen.findByTestId('page-backtest')).toBeInTheDocument()
    expect(await screen.findByTestId('backtest-kpi-accuracy')).toBeInTheDocument()
    expect(await screen.findByTestId('backtest-results-table')).toBeInTheDocument()

    await user.clear(screen.getByTestId('backtest-code-input'))
    await user.type(screen.getByTestId('backtest-code-input'), '600519')
    await user.click(screen.getByTestId('backtest-filter-submit'))
    expect((await screen.findAllByText('600519')).length).toBeGreaterThan(0)

    await user.click(screen.getByTestId('backtest-run-submit'))
    expect(await screen.findByTestId('backtest-run-summary')).toBeInTheDocument()
    expect(await screen.findByText('回测任务执行完成，结果已刷新。')).toBeInTheDocument()
  })
})
