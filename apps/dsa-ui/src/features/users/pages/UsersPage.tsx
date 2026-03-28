import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { authApi, getParsedApiError } from '@/shared/api'

type InlineFeedback = { kind: 'success' | 'error'; message: string } | null

export function UsersPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newUserUsername, setNewUserUsername] = useState('')
  const [newUserDisplayName, setNewUserDisplayName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserPasswordConfirm, setNewUserPasswordConfirm] = useState('')
  const [newUserIsSystemAdmin, setNewUserIsSystemAdmin] = useState(false)
  const [userFeedback, setUserFeedback] = useState<InlineFeedback>(null)
  const [resetTargetUserId, setResetTargetUserId] = useState<number | null>(null)
  const [resetTargetUsername, setResetTargetUsername] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('')
  const [deleteTargetUserId, setDeleteTargetUserId] = useState<number | null>(null)
  const [deleteTargetUsername, setDeleteTargetUsername] = useState('')

  const authMeQuery = useQuery({
    queryKey: ['users-auth-me'],
    queryFn: () => authApi.getMe(),
    retry: false,
  })
  const canManageUsers = useMemo(() => {
    const authContext = authMeQuery.data
    if (!authContext) return false
    if (!authContext.authEnabled) return true
    return !!authContext.user?.isSystemAdmin || authContext.capabilities.includes('users.manage')
  }, [authMeQuery.data])

  const usersQuery = useQuery({
    queryKey: ['users-list'],
    queryFn: () => authApi.listUsers(),
    enabled: canManageUsers,
  })
  const createUserMutation = useMutation({
    mutationFn: authApi.createUser,
  })
  const resetUserPasswordMutation = useMutation({
    mutationFn: (payload: { userId: number; newPassword: string; newPasswordConfirm: string }) =>
      authApi.resetUserPassword(payload.userId, {
        newPassword: payload.newPassword,
        newPasswordConfirm: payload.newPasswordConfirm,
      }),
  })
  const deleteUserMutation = useMutation({
    mutationFn: authApi.deleteUser,
  })

  const users = usersQuery.data?.users ?? []
  const currentUserId = authMeQuery.data?.user?.id
  const hasDialogOpen = createDialogOpen || !!resetTargetUserId || !!deleteTargetUserId

  const resetCreateForm = () => {
    setNewUserUsername('')
    setNewUserDisplayName('')
    setNewUserEmail('')
    setNewUserPassword('')
    setNewUserPasswordConfirm('')
    setNewUserIsSystemAdmin(false)
  }

  const closeCreateDialog = () => {
    setCreateDialogOpen(false)
    resetCreateForm()
  }

  const closeResetDialog = () => {
    setResetTargetUserId(null)
    setResetTargetUsername('')
    setResetPassword('')
    setResetPasswordConfirm('')
  }

  const closeDeleteDialog = () => {
    setDeleteTargetUserId(null)
    setDeleteTargetUsername('')
  }

  const handleCreateUser = async () => {
    setUserFeedback(null)
    const username = newUserUsername.trim()
    const password = newUserPassword
    const passwordConfirm = newUserPasswordConfirm
    const displayName = newUserDisplayName.trim()
    const email = newUserEmail.trim()

    if (!username) {
      setUserFeedback({ kind: 'error', message: '请输入用户名。' })
      return
    }
    if (!password) {
      setUserFeedback({ kind: 'error', message: '请输入初始密码。' })
      return
    }
    if (password !== passwordConfirm) {
      setUserFeedback({ kind: 'error', message: '两次输入的密码不一致。' })
      return
    }

    try {
      const result = await createUserMutation.mutateAsync({
        username,
        password,
        passwordConfirm,
        displayName: displayName || undefined,
        email: email || undefined,
        isSystemAdmin: newUserIsSystemAdmin,
      })
      closeCreateDialog()
      await usersQuery.refetch()
      setUserFeedback({ kind: 'success', message: `已创建用户：${result.user.username}` })
    } catch (error) {
      setUserFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleOpenResetDialog = (userId: number, username: string) => {
    setUserFeedback(null)
    setResetTargetUserId(userId)
    setResetTargetUsername(username)
    setResetPassword('')
    setResetPasswordConfirm('')
  }

  const handleResetUserPassword = async () => {
    if (!resetTargetUserId) return
    setUserFeedback(null)
    if (!resetPassword) {
      setUserFeedback({ kind: 'error', message: '请输入新密码。' })
      return
    }
    if (resetPassword !== resetPasswordConfirm) {
      setUserFeedback({ kind: 'error', message: '两次输入的新密码不一致。' })
      return
    }

    try {
      await resetUserPasswordMutation.mutateAsync({
        userId: resetTargetUserId,
        newPassword: resetPassword,
        newPasswordConfirm: resetPasswordConfirm,
      })
      setUserFeedback({ kind: 'success', message: `已重置用户密码：${resetTargetUsername}` })
      closeResetDialog()
    } catch (error) {
      setUserFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleOpenDeleteDialog = (userId: number, username: string) => {
    setUserFeedback(null)
    setDeleteTargetUserId(userId)
    setDeleteTargetUsername(username)
  }

  const handleConfirmDeleteUser = async () => {
    if (!deleteTargetUserId) return
    setUserFeedback(null)

    try {
      await deleteUserMutation.mutateAsync(deleteTargetUserId)
      await usersQuery.refetch()
      setUserFeedback({ kind: 'success', message: `已删除用户：${deleteTargetUsername}` })
      if (resetTargetUserId === deleteTargetUserId) {
        closeResetDialog()
      }
      closeDeleteDialog()
    } catch (error) {
      setUserFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  if (authMeQuery.isFetching) {
    return (
      <section className="space-y-[var(--dsa-layout-gap)]" data-testid="page-users">
        <h2 hidden data-testid="page-title-users">
          用户管理
        </h2>
        <p className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-[var(--dsa-card-padding)] text-sm text-slate-600">正在加载权限信息...</p>
      </section>
    )
  }

  if (!canManageUsers) {
    return (
      <section className="space-y-[var(--dsa-layout-gap)]" data-testid="page-users">
        <h2 hidden data-testid="page-title-users">
          用户管理
        </h2>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-[var(--dsa-card-padding)] text-sm text-rose-700" data-testid="users-no-permission">
          当前账号没有用户管理权限，仅系统管理员可访问该页面。
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-[var(--dsa-layout-gap)]" data-testid="page-users">
      <h2 hidden data-testid="page-title-users">
        用户管理
      </h2>

      <section className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-[var(--dsa-card-padding)]" data-testid="users-list-panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">用户列表</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetCreateForm()
                setUserFeedback(null)
                setCreateDialogOpen(true)
              }}
              className="rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-1.5 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
              disabled={createUserMutation.isPending || resetUserPasswordMutation.isPending || deleteUserMutation.isPending}
              data-testid="users-create-open"
            >
              新增
            </button>
            <button
              type="button"
              onClick={() => void usersQuery.refetch()}
              className="rounded-lg border dsa-theme-border-default bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:dsa-theme-bg-soft disabled:opacity-60"
              disabled={usersQuery.isFetching}
              data-testid="users-refresh"
            >
              {usersQuery.isFetching ? '刷新中...' : '刷新列表'}
            </button>
          </div>
        </div>

        {usersQuery.isFetching ? <p className="mt-3 text-sm text-slate-600">正在加载用户列表...</p> : null}
        {usersQuery.error ? <p className="mt-3 text-sm text-rose-700">{getParsedApiError(usersQuery.error).message}</p> : null}

        {!usersQuery.isFetching && !usersQuery.error ? (
          <div className="mt-3 overflow-x-auto rounded-xl border dsa-theme-border-subtle bg-white">
            <table className="min-w-full text-sm" data-testid="users-list-table">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">账号</th>
                  <th className="px-3 py-2 text-left">显示名</th>
                  <th className="px-3 py-2 text-left">邮箱</th>
                  <th className="px-3 py-2 text-left">角色</th>
                  <th className="px-3 py-2 text-left">状态</th>
                  <th className="px-3 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t dsa-theme-border-subtle" data-testid={`users-row-${user.username}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{user.username}</td>
                    <td className="px-3 py-2 text-slate-700">{user.displayName || '--'}</td>
                    <td className="px-3 py-2 text-slate-600">{user.email || '--'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          user.isSystemAdmin ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {user.isSystemAdmin ? '系统管理员' : '普通用户'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{user.status || '--'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-md border dsa-theme-border-default bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:dsa-theme-bg-soft disabled:opacity-60"
                          onClick={() => handleOpenResetDialog(user.id, user.username)}
                          data-testid={`users-reset-open-${user.username}`}
                          disabled={resetUserPasswordMutation.isPending || deleteUserMutation.isPending}
                        >
                          重置密码
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                          onClick={() => handleOpenDeleteDialog(user.id, user.username)}
                          data-testid={`users-delete-${user.username}`}
                          disabled={
                            deleteUserMutation.isPending
                            || resetUserPasswordMutation.isPending
                            || user.id === currentUserId
                          }
                        >
                          删除用户
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!hasDialogOpen && userFeedback ? (
          <p className={`mt-3 text-sm font-medium ${userFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {userFeedback.message}
          </p>
        ) : null}
      </section>

      {createDialogOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" data-testid="users-create-dialog">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            onClick={closeCreateDialog}
            aria-label="关闭新增用户窗口"
          />
          <section className="relative z-10 w-full max-w-2xl rounded-2xl border dsa-theme-border-subtle bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.24)]">
            <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">新增用户</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input
                value={newUserUsername}
                onChange={(event) => setNewUserUsername(event.target.value)}
                placeholder="用户名（必填）"
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                data-testid="users-username"
              />
              <input
                value={newUserDisplayName}
                onChange={(event) => setNewUserDisplayName(event.target.value)}
                placeholder="显示名（可选）"
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                data-testid="users-display-name"
              />
              <input
                value={newUserEmail}
                onChange={(event) => setNewUserEmail(event.target.value)}
                placeholder="邮箱（可选）"
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                data-testid="users-email"
              />
              <label className="inline-flex items-center gap-2 rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newUserIsSystemAdmin}
                  onChange={(event) => setNewUserIsSystemAdmin(event.target.checked)}
                  data-testid="users-admin-toggle"
                />
                授权为系统管理员
              </label>
              <input
                type="password"
                value={newUserPassword}
                onChange={(event) => setNewUserPassword(event.target.value)}
                placeholder="初始密码（必填）"
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                data-testid="users-password"
              />
              <input
                type="password"
                value={newUserPasswordConfirm}
                onChange={(event) => setNewUserPasswordConfirm(event.target.value)}
                placeholder="确认初始密码（必填）"
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                data-testid="users-password-confirm"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {userFeedback ? (
                <p
                  className={`mr-auto self-center text-sm font-medium ${
                    userFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                  data-testid="users-create-feedback"
                >
                  {userFeedback.message}
                </p>
              ) : null}
              <button
                type="button"
                onClick={closeCreateDialog}
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:dsa-theme-bg-soft"
                data-testid="users-create-cancel"
                disabled={createUserMutation.isPending}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleCreateUser()}
                className="rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-2 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
                disabled={createUserMutation.isPending}
                data-testid="users-create"
              >
                {createUserMutation.isPending ? '创建中...' : '创建用户'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {resetTargetUserId ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" data-testid="users-reset-panel">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            onClick={closeResetDialog}
            aria-label="关闭重置密码窗口"
          />
          <section className="relative z-10 w-full max-w-xl rounded-2xl border dsa-theme-border-subtle bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.24)]">
            <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">管理员重置密码</p>
            <p className="mt-1 text-sm text-slate-700">
              目标用户：<span className="font-semibold">{resetTargetUsername}</span>
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                placeholder="新密码"
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                data-testid="users-reset-password"
              />
              <input
                type="password"
                value={resetPasswordConfirm}
                onChange={(event) => setResetPasswordConfirm(event.target.value)}
                placeholder="确认新密码"
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                data-testid="users-reset-password-confirm"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {userFeedback ? (
                <p
                  className={`mr-auto self-center text-sm font-medium ${
                    userFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                  data-testid="users-reset-feedback"
                >
                  {userFeedback.message}
                </p>
              ) : null}
              <button
                type="button"
                onClick={closeResetDialog}
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:dsa-theme-bg-soft"
                data-testid="users-reset-cancel"
                disabled={resetUserPasswordMutation.isPending}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleResetUserPassword()}
                className="rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-2 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
                data-testid="users-reset-submit"
                disabled={resetUserPasswordMutation.isPending}
              >
                {resetUserPasswordMutation.isPending ? '提交中...' : '确认重置'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteTargetUserId ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" data-testid="users-delete-dialog">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            onClick={closeDeleteDialog}
            aria-label="关闭删除用户确认窗口"
          />
          <section className="relative z-10 w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.24)]">
            <p className="text-xs uppercase tracking-[0.16em] text-rose-600">删除确认</p>
            <p className="mt-2 text-sm text-slate-700">
              确认删除用户 <span className="font-semibold text-slate-900">{deleteTargetUsername}</span> 吗？该操作不可恢复。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              {userFeedback ? (
                <p
                  className={`mr-auto self-center text-sm font-medium ${
                    userFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                  data-testid="users-delete-feedback"
                >
                  {userFeedback.message}
                </p>
              ) : null}
              <button
                type="button"
                onClick={closeDeleteDialog}
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:dsa-theme-bg-soft"
                data-testid="users-delete-cancel"
                disabled={deleteUserMutation.isPending}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteUser()}
                className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                data-testid="users-delete-confirm"
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? '删除中...' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
