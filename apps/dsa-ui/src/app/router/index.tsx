import type { RouteObject } from 'react-router-dom'
import { createBrowserRouter, createMemoryRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/app/layouts/AppShell'
import { AuthGate } from '@/app/router/AuthGate'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { BacktestPage } from '@/features/backtest/pages/BacktestPage'
import { ChatPage } from '@/features/chat/pages/ChatPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { PortfolioPage } from '@/features/portfolio/pages/PortfolioPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'

const appRoutes: RouteObject[] = [
  {
    element: (
      <AuthGate>
        <AppShell />
      </AuthGate>
    ),
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/chat', element: <ChatPage /> },
      { path: '/portfolio', element: <PortfolioPage /> },
      { path: '/backtest', element: <BacktestPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]

type CreateAppRouterOptions = {
  useMemoryRouter?: boolean
  initialEntries?: string[]
}

function getCurrentLocation(): string {
  if (typeof window === 'undefined') {
    return '/'
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}` || '/'
}

export function createAppRouter(options: CreateAppRouterOptions = {}) {
  const useMemoryRouter = options.useMemoryRouter ?? Boolean(import.meta.env.MODE === 'test' || import.meta.env.VITEST)

  if (useMemoryRouter) {
    return createMemoryRouter(appRoutes, {
      initialEntries: options.initialEntries ?? [getCurrentLocation()],
    })
  }

  return createBrowserRouter(appRoutes)
}

export const appRouter = createAppRouter()
