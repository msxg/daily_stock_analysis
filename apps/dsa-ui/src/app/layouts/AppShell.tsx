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
      className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_40%),radial-gradient(circle_at_85%_10%,_rgba(34,197,94,0.14),_transparent_38%),_linear-gradient(180deg,_#f7faf9_0%,_#eff6f4_100%)] text-slate-900"
      data-testid="app-shell"
    >
      <div
        className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-teal-200/40 blur-3xl"
        data-testid="shell-glow-left"
      />
      <div
        className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl"
        data-testid="shell-glow-right"
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[var(--dsa-shell-sidebar-width)] shrink-0 border-r border-teal-900/10 bg-white/70 px-4 py-5 backdrop-blur-xl lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-content-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-[0_14px_28px_rgba(13,148,136,0.28)]">
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
                        ? 'bg-teal-500/12 text-teal-900 shadow-[inset_0_0_0_1px_rgba(15,118,110,0.24)]'
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
          <header className="sticky top-0 z-30 border-b border-teal-900/10 bg-white/75 px-[var(--dsa-shell-content-padding)] py-2.5 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleMobileMenu}
                  className="grid h-10 w-10 place-content-center rounded-xl border border-teal-900/10 bg-white/80 text-slate-700 shadow-sm transition-colors hover:bg-white lg:hidden"
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
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal-900/15 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
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
            className="h-full w-[82%] max-w-xs border-r border-teal-900/10 bg-white/92 px-4 py-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="mb-5 px-2 text-xs uppercase tracking-[0.24em] text-teal-900/80">Navigation</p>
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
                        isActive ? 'bg-teal-500/14 text-teal-900' : 'text-slate-600',
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

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-teal-900/10 bg-white/92 backdrop-blur-xl lg:hidden">
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
                active ? 'text-teal-900' : 'text-slate-500',
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
