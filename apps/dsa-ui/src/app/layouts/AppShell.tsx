import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Menu, X } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { navRoutes, getRouteDescription, getRouteLabel } from '@/app/router/routeManifest'
import { authApi, getParsedApiError } from '@/shared/api'
import { cn } from '@/shared/lib/cn'
import { useShellStore } from '@/shared/store/useShellStore'

export function AppShell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { mobileMenuOpen, closeMobileMenu, toggleMobileMenu } = useShellStore()
  const pageLabel = getRouteLabel(location.pathname)
  const pageDescription = getRouteDescription(location.pathname)
  const [logoutFeedback, setLogoutFeedback] = useState<string | null>(null)

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
  })

  const handleLogout = async () => {
    setLogoutFeedback(null)
    try {
      await logoutMutation.mutateAsync()
      queryClient.clear()
      navigate('/login', { replace: true })
    } catch (error) {
      setLogoutFeedback(getParsedApiError(error).message)
    }
  }

  return (
    <div
      className="dsa-theme-shell-bg relative min-h-screen overflow-x-hidden text-slate-900"
      data-testid="app-shell"
    >
      <div
        className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full dsa-theme-glow-left blur-3xl"
        data-testid="shell-glow-left"
      />
      <div
        className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full dsa-theme-glow-right blur-3xl"
        data-testid="shell-glow-right"
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[var(--dsa-shell-sidebar-width)] shrink-0 border-r dsa-theme-border-subtle bg-white/70 px-4 py-5 backdrop-blur-xl lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-content-center rounded-2xl dsa-theme-gradient-diagonal text-white dsa-theme-shadow-brand">
              <span className="text-sm font-bold tracking-wide">DSA</span>
            </div>
            <div>
              <p className="text-lg font-semibold">Money Intelligence</p>
            </div>
          </div>

          <nav className="space-y-1.5" aria-label="主导航">
            {navRoutes.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                      isActive
                        ? 'dsa-theme-bg-accent dsa-theme-text-accent dsa-theme-shadow-active'
                        : 'text-slate-600 hover:bg-white/80 hover:text-slate-900',
                    )
                  }
                  data-testid={`desktop-nav-${item.shortLabel}`}
                  onClick={closeMobileMenu}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b dsa-theme-border-subtle bg-white/75 px-[var(--dsa-shell-content-padding)] py-2.5 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleMobileMenu}
                  className="grid h-10 w-10 place-content-center rounded-xl border dsa-theme-border-subtle bg-white/80 text-slate-700 shadow-sm transition-colors hover:bg-white lg:hidden"
                  aria-label="切换导航菜单"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">{pageLabel}</h1>
                  {pageDescription ? (
                    <p className="mt-0.5 text-xs text-slate-600" data-testid="shell-page-description">
                      {pageDescription}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-end gap-2">
                {logoutFeedback ? <p className="hidden text-xs text-rose-700 md:block">{logoutFeedback}</p> : null}
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border dsa-theme-border-default bg-white px-3 text-xs font-semibold text-slate-700 transition hover:dsa-theme-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="shell-logout-button"
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {logoutMutation.isPending ? '退出中...' : '退出登录'}
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-[var(--dsa-shell-content-padding)] pb-20 pt-4 md:pb-8">
            <Outlet />
          </main>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-900/32 backdrop-blur-sm lg:hidden" onClick={closeMobileMenu}>
          <aside
            className="h-full w-[82%] max-w-xs border-r dsa-theme-border-subtle bg-white/92 px-4 py-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="mb-5 px-2 text-xs uppercase tracking-[0.24em] dsa-theme-text-accent-muted">Navigation</p>
            <nav className="space-y-2" aria-label="移动端导航">
              {navRoutes.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive ? 'dsa-theme-bg-accent-strong dsa-theme-text-accent' : 'text-slate-600',
                      )
                    }
                    onClick={closeMobileMenu}
                    data-testid={`mobile-drawer-${item.shortLabel}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>
          </aside>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t dsa-theme-border-subtle bg-white/92 backdrop-blur-xl lg:hidden">
        {navRoutes.map((item) => {
          const Icon = item.icon
          const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={cn(
                'flex min-w-0 flex-col items-center gap-1 px-2 text-[11px] font-semibold',
                active ? 'dsa-theme-text-accent' : 'text-slate-500',
              )}
              onClick={closeMobileMenu}
              data-testid={`mobile-tab-${item.shortLabel}`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.shortLabel}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
