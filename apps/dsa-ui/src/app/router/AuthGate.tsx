import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, useLocation } from 'react-router-dom'
import { authApi, getParsedApiError } from '@/shared/api'

type AuthGateProps = {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const location = useLocation()

  const authMeQuery = useQuery({
    queryKey: ['auth-gate-me'],
    queryFn: () => authApi.getMe(),
    retry: false,
  })

  if (authMeQuery.isFetching) {
    return <>{children}</>
  }

  if (authMeQuery.error) {
    const rawError = authMeQuery.error as { response?: { status?: number } }
    const statusCode = rawError?.response?.status
    if (statusCode === 401) {
      const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
      return <Navigate to={`/login?redirect=${redirect}`} replace />
    }
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-5 text-sm text-rose-700" data-testid="auth-gate-error">
          认证状态检测失败：{getParsedApiError(authMeQuery.error).message}
        </div>
      </div>
    )
  }

  const authContext = authMeQuery.data
  if (authContext?.authEnabled && !authContext.authenticated) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return <>{children}</>
}
