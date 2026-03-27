import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, getParsedApiError } from '@/shared/api'

type InlineFeedback = { kind: 'success' | 'error'; message: string } | null

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [feedback, setFeedback] = useState<InlineFeedback>(null)

  const authStatusQuery = useQuery({
    queryKey: ['login-auth-status'],
    queryFn: () => authApi.getStatus(),
  })

  const loginMutation = useMutation({
    mutationFn: ({ passwordValue, passwordConfirmValue }: { passwordValue: string; passwordConfirmValue?: string }) =>
      authApi.login(passwordValue, passwordConfirmValue),
  })

  const redirect = useMemo(() => {
    const candidate = searchParams.get('redirect') || '/'
    return candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : '/'
  }, [searchParams])

  const isFirstTime = authStatusQuery.data?.setupState === 'no_password' || !authStatusQuery.data?.passwordSet

  const handleSubmit = async () => {
    setFeedback(null)
    if (!password.trim()) {
      setFeedback({ kind: 'error', message: '请输入密码。' })
      return
    }
    if (isFirstTime && password !== passwordConfirm) {
      setFeedback({ kind: 'error', message: '两次密码输入不一致。' })
      return
    }

    try {
      await loginMutation.mutateAsync({
        passwordValue: password,
        passwordConfirmValue: isFirstTime ? passwordConfirm : undefined,
      })
      setFeedback({ kind: 'success', message: '登录成功，正在进入工作台...' })
      navigate(redirect, { replace: true })
    } catch (error) {
      setFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  return (
    <main
      className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.18),_transparent_52%),linear-gradient(180deg,_#f6fbf9_0%,_#eef6f4_100%)] p-6"
      data-testid="page-login"
    >
      <section className="w-full max-w-md rounded-3xl border border-teal-900/10 bg-white/90 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-700/80">Daily Stock Analysis</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900" data-testid="page-title-login">
          {isFirstTime ? '首次设置密码' : '管理员登录'}
        </h1>
        <p className="mt-2 text-sm text-slate-600" data-testid="login-status">
          {authStatusQuery.isFetching ? '正在检测认证状态...' : null}
          {!authStatusQuery.isFetching && authStatusQuery.error ? `认证状态检测失败：${getParsedApiError(authStatusQuery.error).message}` : null}
          {!authStatusQuery.isFetching && !authStatusQuery.error
            ? authStatusQuery.data?.authEnabled
              ? isFirstTime
                ? '检测到尚未设置密码，请先完成初始化。'
                : '请输入管理员密码继续。'
              : '当前系统未启用认证，登录后可在设置页开启。'
            : null}
        </p>

        <div className="mt-6 space-y-3" data-testid="login-form">
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isFirstTime ? '请设置管理员密码' : '请输入管理员密码'}
              className="rounded-xl border border-teal-900/15 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
              data-testid="login-password"
            />
          </label>

          {isFirstTime ? (
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              确认密码
              <input
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                placeholder="再次输入管理员密码"
                className="rounded-xl border border-teal-900/15 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                data-testid="login-password-confirm"
              />
            </label>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="mt-1 w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(13,148,136,0.3)] transition hover:opacity-95 disabled:opacity-60"
            disabled={loginMutation.isPending || authStatusQuery.isFetching}
            data-testid="login-submit"
          >
            {loginMutation.isPending ? '登录中...' : isFirstTime ? '完成设置并登录' : '登录'}
          </button>
        </div>

        {feedback ? (
          <p className={`mt-4 text-sm font-medium ${feedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {feedback.message}
          </p>
        ) : null}

        <Link to="/" className="mt-4 inline-flex text-sm font-semibold text-teal-900 underline decoration-teal-400/70 underline-offset-4">
          返回主界面
        </Link>
      </section>
    </main>
  )
}
