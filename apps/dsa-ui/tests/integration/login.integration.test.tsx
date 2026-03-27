import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '@/app/providers/AppProviders'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { server } from '../../tests/mocks/server'

function renderLogin(initialEntry = '/login') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div data-testid="login-redirect-home">home</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('Login page', () => {
  it('logs in and redirects to workspace route', async () => {
    const user = userEvent.setup()
    server.use(
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
    renderLogin('/login?redirect=%2F')

    expect(await screen.findByTestId('page-login')).toBeInTheDocument()
    await user.type(screen.getByTestId('login-password'), 'password-123')
    await user.click(screen.getByTestId('login-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('login-redirect-home')).toBeInTheDocument()
    })
  })

  it('shows mismatch error in first-time password setup', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/v1/auth/status', () =>
        HttpResponse.json({
          auth_enabled: true,
          logged_in: false,
          password_set: false,
          password_changeable: false,
          setup_state: 'no_password',
        }),
      ),
    )

    renderLogin('/login')
    expect(await screen.findByText('首次设置密码')).toBeInTheDocument()

    await user.type(screen.getByTestId('login-password'), 'first-password')
    await user.type(screen.getByTestId('login-password-confirm'), 'different-password')
    await user.click(screen.getByTestId('login-submit'))

    expect(await screen.findByText('两次密码输入不一致。')).toBeInTheDocument()
  })
})
