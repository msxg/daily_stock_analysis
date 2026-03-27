import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'

describe('Portfolio workspace', () => {
  it('supports account switch, entry submit and csv parse flow', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/')
    render(<App />)

    await user.click(screen.getAllByRole('link', { name: '持仓' })[0])
    expect(await screen.findByTestId('page-portfolio')).toBeInTheDocument()
    expect(screen.getByTestId('portfolio-write-protection')).toBeInTheDocument()

    await user.selectOptions(screen.getByTestId('portfolio-account-select'), '1')
    await waitFor(() => {
      expect(screen.queryByTestId('portfolio-write-protection')).not.toBeInTheDocument()
    })

    await user.click(screen.getByTestId('portfolio-tab-entry'))
    await user.type(screen.getAllByPlaceholderText('股票代码')[0], '600519')
    await user.clear(screen.getByPlaceholderText('数量'))
    await user.type(screen.getByPlaceholderText('数量'), '100')
    await user.clear(screen.getByPlaceholderText('价格'))
    await user.type(screen.getByPlaceholderText('价格'), '1820')
    await user.click(screen.getByTestId('portfolio-entry-submit-trade'))
    expect(await screen.findByText('交易流水录入成功。')).toBeInTheDocument()

    await user.click(screen.getByTestId('portfolio-tab-import'))
    const csvInput = screen.getByTestId('portfolio-import-file') as HTMLInputElement
    await user.upload(csvInput, new File(['date,code,side,qty,price'], 'demo.csv', { type: 'text/csv' }))
    await user.click(screen.getByTestId('portfolio-import-parse'))
    expect(await screen.findByText(/解析完成：有效/)).toBeInTheDocument()
  })
})
