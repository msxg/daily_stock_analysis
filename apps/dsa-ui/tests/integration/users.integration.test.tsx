import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'
import { server } from '../../tests/mocks/server'

describe('Users workspace', () => {
  it('shows user management as a dedicated nav entry and supports user creation', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/')
    render(<App />)

    await user.click(await screen.findByTestId('desktop-nav-用户'))
    expect(await screen.findByTestId('page-users')).toBeInTheDocument()
    expect(within(screen.getByTestId('users-list-table')).getByText('admin')).toBeInTheDocument()

    await user.click(screen.getByTestId('users-create-open'))
    expect(await screen.findByTestId('users-create-dialog')).toBeInTheDocument()
    await user.type(screen.getByTestId('users-username'), 'ops_user')
    await user.type(screen.getByTestId('users-display-name'), 'Ops User')
    await user.type(screen.getByTestId('users-email'), 'ops@example.com')
    await user.type(screen.getByTestId('users-password'), 'Ops@123456')
    await user.type(screen.getByTestId('users-password-confirm'), 'Ops@123456')
    await user.click(screen.getByTestId('users-create'))

    expect(await screen.findByText('已创建用户：ops_user')).toBeInTheDocument()
    expect(await screen.findByTestId('users-row-ops_user')).toBeInTheDocument()

    await user.click(screen.getByTestId('users-reset-open-ops_user'))
    expect(await screen.findByTestId('users-reset-panel')).toBeInTheDocument()
    await user.type(screen.getByTestId('users-reset-password'), 'Ops@654321')
    await user.type(screen.getByTestId('users-reset-password-confirm'), 'Ops@654321')
    await user.click(screen.getByTestId('users-reset-submit'))
    expect(await screen.findByText('已重置用户密码：ops_user')).toBeInTheDocument()

    await user.click(screen.getByTestId('users-delete-ops_user'))
    expect(await screen.findByTestId('users-delete-dialog')).toBeInTheDocument()
    await user.click(screen.getByTestId('users-delete-confirm'))
    expect(await screen.findByText('已删除用户：ops_user')).toBeInTheDocument()
    expect(screen.queryByTestId('users-row-ops_user')).not.toBeInTheDocument()
  })

  it('hides user-management nav entry for non-admin users', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({
          authenticated: true,
          auth_enabled: true,
          user: {
            id: 2,
            username: 'demo_user',
            display_name: 'Demo User',
            is_system_admin: false,
          },
          active_tenant: {
            id: 1,
            slug: 'default',
            name: 'Default Workspace',
            role: 'user',
          },
          available_tenants: [
            {
              id: 1,
              slug: 'default',
              name: 'Default Workspace',
              role: 'user',
            },
          ],
          capabilities: ['chat.read', 'chat.write'],
        }),
      ),
      http.get('/api/v1/auth/status', () =>
        HttpResponse.json({
          auth_enabled: true,
          logged_in: true,
          password_set: true,
          password_changeable: true,
          setup_state: 'enabled',
        }),
      ),
    )

    window.history.pushState({}, '', '/')
    render(<App />)

    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '用户管理' })).not.toBeInTheDocument()
  })

  it('falls back to POST delete endpoint when DELETE is not allowed', async () => {
    const user = userEvent.setup()

    server.use(
      http.delete('/api/v1/auth/users/:userId', () =>
        HttpResponse.json(
          { detail: 'Method Not Allowed' },
          { status: 405 },
        ),
      ),
    )

    window.history.pushState({}, '', '/')
    render(<App />)

    await user.click(await screen.findByTestId('desktop-nav-用户'))
    expect(await screen.findByTestId('page-users')).toBeInTheDocument()
    expect(await screen.findByTestId('users-row-demo_user')).toBeInTheDocument()

    await user.click(screen.getByTestId('users-delete-demo_user'))
    expect(await screen.findByTestId('users-delete-dialog')).toBeInTheDocument()
    await user.click(screen.getByTestId('users-delete-confirm'))
    expect(await screen.findByText('已删除用户：demo_user')).toBeInTheDocument()
    expect(screen.queryByTestId('users-row-demo_user')).not.toBeInTheDocument()
  })
})
