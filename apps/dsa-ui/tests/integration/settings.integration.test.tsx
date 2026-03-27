import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/app/App'
import { THEME_STORAGE_KEY } from '@/shared/theme/themeCatalog'

describe('Settings workspace', () => {
  it('supports saving config, auth update and env export/import', async () => {
    const user = userEvent.setup()
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:settings-env')
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    window.history.pushState({}, '', '/')
    render(<App />)

    await user.click(screen.getAllByRole('link', { name: '设置' })[0])
    expect(await screen.findByTestId('page-settings')).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-theme', 'rose')

    await user.click(screen.getByTestId('settings-category-ui'))
    expect(await screen.findByTestId('settings-ui-panel')).toBeInTheDocument()
    expect(screen.getByText('Theme')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-auth-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('settings-env-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('settings-llm-panel')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('settings-ui-theme-mint'))
    expect(document.documentElement).toHaveAttribute('data-theme', 'mint')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('mint')

    await user.click(screen.getByTestId('settings-category-ai_model'))
    const modelField = await screen.findByTestId('settings-field-OPENAI_MODEL')
    const modelInput = within(modelField).getByDisplayValue('gpt-4o-mini')
    await user.clear(modelInput)
    await user.type(modelInput, 'gpt-5')

    expect(await screen.findByTestId('settings-save-bar')).toBeInTheDocument()
    await user.click(screen.getByTestId('settings-save'))
    expect(await screen.findByText(/配置已保存/)).toBeInTheDocument()

    await user.click(screen.getByTestId('settings-category-system'))
    expect(await screen.findByTestId('settings-auth-panel')).toBeInTheDocument()
    expect(screen.getByTestId('settings-env-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-llm-panel')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('settings-auth-toggle'))
    await user.click(screen.getByTestId('settings-auth-save'))
    expect(await screen.findByText('认证设置已更新。')).toBeInTheDocument()

    await user.click(screen.getByTestId('settings-export-env'))
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrlSpy).toHaveBeenCalledTimes(1)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['ENABLE_NOTIFY=true'], 'backup.env', { type: 'text/plain' }))
    expect(await screen.findByText('已导入 .env 备份并刷新配置。')).toBeInTheDocument()

    await user.click(screen.getByTestId('settings-category-ai_model'))
    expect(await screen.findByTestId('settings-llm-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-auth-panel')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('settings-test-channel'))
    expect(await screen.findByText(/测试成功/)).toBeInTheDocument()

    createObjectUrlSpy.mockRestore()
    revokeObjectUrlSpy.mockRestore()
    clickSpy.mockRestore()
  })
})
