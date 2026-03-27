import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTheme } from '@/app/providers/useTheme'
import { authApi, getParsedApiError, systemConfigApi } from '@/shared/api'
import { getThemeDefinition, THEME_OPTIONS } from '@/shared/theme/themeCatalog'
import type {
  ConfigValidationIssue,
  SystemConfigCategory,
  SystemConfigItem,
  TestLLMChannelResponse,
} from '@/shared/types/systemConfig'

type InlineFeedback = { kind: 'success' | 'error'; message: string } | null

const categoryLabel: Record<SystemConfigCategory, string> = {
  base: '基础配置',
  data_source: '数据源',
  ai_model: '模型与渠道',
  notification: '通知',
  system: '系统',
  agent: 'Agent',
  backtest: '回测',
  ui: 'UI',
  uncategorized: '未分类',
}

const categoryOrder: SystemConfigCategory[] = [
  'base',
  'data_source',
  'ai_model',
  'notification',
  'system',
  'agent',
  'backtest',
  'ui',
  'uncategorized',
]

const customSectionCountByCategory: Partial<Record<SystemConfigCategory, number>> = {
  ai_model: 1,
  system: 2,
  ui: 1,
}

function normalizeOption(option: string | { label: string; value: string }) {
  if (typeof option === 'string') {
    return { label: option, value: option }
  }
  return option
}

function normalizeFieldValue(item: SystemConfigItem, value: string): string {
  if (item.schema?.dataType === 'boolean') {
    return value === 'true' ? 'true' : 'false'
  }
  return value
}

function isBooleanTrue(value: string): boolean {
  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function formatDesktopEnvFilename(): string {
  const now = new Date()
  const pad = (value: number) => value.toString().padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`
  return `dsa-ui-config_${date}_${time}.env`
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [activeCategory, setActiveCategory] = useState<SystemConfigCategory>('base')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({})
  const [issuesByKey, setIssuesByKey] = useState<Record<string, ConfigValidationIssue[]>>({})
  const [configFeedback, setConfigFeedback] = useState<InlineFeedback>(null)

  const [authEnabledOverride, setAuthEnabledOverride] = useState<boolean | null>(null)
  const [authPassword, setAuthPassword] = useState('')
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('')
  const [authCurrentPassword, setAuthCurrentPassword] = useState('')
  const [authFeedback, setAuthFeedback] = useState<InlineFeedback>(null)

  const [desktopFeedback, setDesktopFeedback] = useState<InlineFeedback>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const [channelName, setChannelName] = useState('quick-test')
  const [channelProtocol, setChannelProtocol] = useState('openai')
  const [channelBaseUrl, setChannelBaseUrl] = useState('')
  const [channelApiKey, setChannelApiKey] = useState('')
  const [channelModels, setChannelModels] = useState('gpt-4o-mini')
  const [channelFeedback, setChannelFeedback] = useState<InlineFeedback>(null)
  const [channelResult, setChannelResult] = useState<TestLLMChannelResponse | null>(null)

  const configQuery = useQuery({
    queryKey: ['settings-config'],
    queryFn: () => systemConfigApi.getConfig(true),
  })

  const authStatusQuery = useQuery({
    queryKey: ['settings-auth-status'],
    queryFn: () => authApi.getStatus(),
  })

  const updateMutation = useMutation({
    mutationFn: systemConfigApi.update,
  })
  const validateMutation = useMutation({
    mutationFn: systemConfigApi.validate,
  })
  const authUpdateMutation = useMutation({
    mutationFn: (payload: { authEnabled: boolean; password?: string; passwordConfirm?: string; currentPassword?: string }) =>
      authApi.updateSettings(payload.authEnabled, payload.password, payload.passwordConfirm, payload.currentPassword),
  })
  const testChannelMutation = useMutation({
    mutationFn: systemConfigApi.testLLMChannel,
  })
  const exportEnvMutation = useMutation({
    mutationFn: systemConfigApi.exportDesktopEnv,
  })
  const importEnvMutation = useMutation({
    mutationFn: (payload: { configVersion: string; content: string }) =>
      systemConfigApi.importDesktopEnv({
        configVersion: payload.configVersion,
        content: payload.content,
        reloadNow: true,
      }),
  })

  const allItems = useMemo(() => configQuery.data?.items ?? [], [configQuery.data?.items])
  const initialValues = useMemo(() => {
    const map: Record<string, string> = {}
    allItems.forEach((item) => {
      map[item.key] = String(item.value ?? '')
    })
    return map
  }, [allItems])

  const categories = useMemo(() => {
    const value = new Set<SystemConfigCategory>()
    allItems.forEach((item) => value.add((item.schema?.category || 'uncategorized') as SystemConfigCategory))
    value.add('ui')
    if (!allItems.length) value.add('base')
    return [...value].sort((left, right) => categoryOrder.indexOf(left) - categoryOrder.indexOf(right))
  }, [allItems])

  const effectiveActiveCategory = categories.includes(activeCategory) ? activeCategory : categories[0] || 'base'

  const authEnabledDraft = authEnabledOverride ?? authStatusQuery.data?.authEnabled ?? false

  const filteredItems = useMemo(() => {
    if (effectiveActiveCategory === 'ui') {
      return []
    }

    const keyword = searchKeyword.trim().toLowerCase()
    return allItems.filter((item) => {
      const category = (item.schema?.category || 'uncategorized') as SystemConfigCategory
      if (category !== effectiveActiveCategory) return false
      if (!keyword) return true

      const title = item.schema?.title || ''
      const description = item.schema?.description || ''
      return [item.key, title, description].some((value) => value.toLowerCase().includes(keyword))
    })
  }, [effectiveActiveCategory, allItems, searchKeyword])

  const activeTheme = getThemeDefinition(theme)
  const showUiSection = effectiveActiveCategory === 'ui'
  const showSystemSections = effectiveActiveCategory === 'system'
  const showAiModelSections = effectiveActiveCategory === 'ai_model'

  const dirtyKeys = useMemo(() => {
    return allItems
      .filter((item) => {
        const currentValue = normalizeFieldValue(item, draftEdits[item.key] ?? initialValues[item.key] ?? '')
        const initialValue = normalizeFieldValue(item, initialValues[item.key] ?? '')
        return currentValue !== initialValue
      })
      .map((item) => item.key)
  }, [allItems, draftEdits, initialValues])

  const handleDraftValueChange = (key: string, value: string) => {
    setDraftEdits((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const handleResetDraft = () => {
    setDraftEdits({})
    setIssuesByKey({})
    setConfigFeedback({ kind: 'success', message: '草稿已重置。' })
  }

  const handleSaveConfig = async () => {
    if (!configQuery.data) return

    const changedItems = allItems
      .filter((item) => (draftEdits[item.key] ?? initialValues[item.key] ?? '') !== (initialValues[item.key] ?? ''))
      .map((item) => ({
        key: item.key,
        value: normalizeFieldValue(item, draftEdits[item.key] ?? initialValues[item.key] ?? ''),
      }))

    if (!changedItems.length) {
      setConfigFeedback({ kind: 'success', message: '当前没有可保存的变更。' })
      return
    }

    setConfigFeedback(null)
    setIssuesByKey({})

    try {
      const validateResult = await validateMutation.mutateAsync({
        items: changedItems,
      })
      const issueMap: Record<string, ConfigValidationIssue[]> = {}
      ;(validateResult.issues || []).forEach((issue) => {
        if (!issueMap[issue.key]) issueMap[issue.key] = []
        issueMap[issue.key].push(issue)
      })
      setIssuesByKey(issueMap)

      if (!validateResult.valid) {
        setConfigFeedback({ kind: 'error', message: '配置校验未通过，请修正高亮字段后再保存。' })
        return
      }

      const updateResult = await updateMutation.mutateAsync({
        configVersion: configQuery.data.configVersion,
        maskToken: configQuery.data.maskToken,
        reloadNow: true,
        items: changedItems,
      })

      await configQuery.refetch()
      setDraftEdits({})
      setConfigFeedback({
        kind: 'success',
        message: updateResult.warnings.length
          ? `配置已保存（含警告：${updateResult.warnings.join('；')}）`
          : '配置已保存。',
      })
    } catch (error) {
      setConfigFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleSaveAuthSettings = async () => {
    setAuthFeedback(null)
    if (authPassword && authPassword !== authPasswordConfirm) {
      setAuthFeedback({ kind: 'error', message: '两次密码输入不一致。' })
      return
    }

    try {
      await authUpdateMutation.mutateAsync({
        authEnabled: authEnabledDraft,
        password: authPassword || undefined,
        passwordConfirm: authPasswordConfirm || undefined,
        currentPassword: authCurrentPassword || undefined,
      })
      setAuthPassword('')
      setAuthPasswordConfirm('')
      setAuthCurrentPassword('')
      await authStatusQuery.refetch()
      setAuthEnabledOverride(null)
      setAuthFeedback({ kind: 'success', message: '认证设置已更新。' })
    } catch (error) {
      setAuthFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleExportDesktopEnv = async () => {
    setDesktopFeedback(null)
    try {
      const payload = await exportEnvMutation.mutateAsync()
      const blob = new Blob([payload.content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = formatDesktopEnvFilename()
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      setDesktopFeedback({ kind: 'success', message: '已导出 .env 配置备份。' })
    } catch (error) {
      setDesktopFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleImportDesktopEnv = async (file: File) => {
    if (!configQuery.data) return
    setDesktopFeedback(null)
    try {
      const content = await file.text()
      await importEnvMutation.mutateAsync({
        configVersion: configQuery.data.configVersion,
        content,
      })
      await configQuery.refetch()
      setDesktopFeedback({ kind: 'success', message: '已导入 .env 备份并刷新配置。' })
    } catch (error) {
      setDesktopFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleTestChannel = async () => {
    setChannelFeedback(null)
    setChannelResult(null)
    try {
      const result = await testChannelMutation.mutateAsync({
        name: channelName.trim() || 'quick-test',
        protocol: channelProtocol,
        baseUrl: channelBaseUrl.trim() || undefined,
        apiKey: channelApiKey.trim() || undefined,
        models: channelModels
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        enabled: true,
        timeoutSeconds: 20,
      })
      setChannelResult(result)
      setChannelFeedback({ kind: result.success ? 'success' : 'error', message: result.message })
    } catch (error) {
      setChannelFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const renderFieldControl = (item: SystemConfigItem) => {
    const value = draftEdits[item.key] ?? initialValues[item.key] ?? ''
    const schema = item.schema
    if (!schema) {
      return (
        <textarea
          value={value}
          onChange={(event) => handleDraftValueChange(item.key, event.target.value)}
          className="min-h-24 w-full rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-800"
        />
      )
    }

    if (schema.uiControl === 'switch' || schema.dataType === 'boolean') {
      return (
        <label className="inline-flex items-center gap-2 rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isBooleanTrue(value)}
            onChange={(event) => handleDraftValueChange(item.key, event.target.checked ? 'true' : 'false')}
          />
          {isBooleanTrue(value) ? '已开启' : '已关闭'}
        </label>
      )
    }

    if (schema.uiControl === 'textarea') {
      return (
        <textarea
          value={value}
          onChange={(event) => handleDraftValueChange(item.key, event.target.value)}
          className="min-h-24 w-full rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-800"
        />
      )
    }

    if (schema.uiControl === 'select' && schema.options?.length) {
      const options = schema.options.map(normalizeOption)
      return (
        <select
          value={value}
          onChange={(event) => handleDraftValueChange(item.key, event.target.value)}
          className="w-full rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-800"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    }

    const inputType = schema.uiControl === 'password' ? 'password' : schema.uiControl === 'number' ? 'number' : 'text'
    return (
      <input
        type={inputType}
        value={value}
        onChange={(event) => handleDraftValueChange(item.key, event.target.value)}
        className="w-full rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-800"
      />
    )
  }

  return (
    <section className="space-y-[var(--dsa-layout-gap)]" data-testid="page-settings">
      <header className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-[var(--dsa-card-padding)]">
        <h2 hidden data-testid="page-title-settings">
          设置
        </h2>

        <div className="grid gap-[var(--dsa-layout-gap)] md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="搜索 key / 字段标题 / 描述"
            className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-800"
            data-testid="settings-search"
          />
          <button
            type="button"
            onClick={handleResetDraft}
            className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:dsa-theme-bg-soft"
            data-testid="settings-reset"
          >
            重置草稿
          </button>
          <button
            type="button"
            onClick={() => void handleSaveConfig()}
            className="rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-2 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
            disabled={!dirtyKeys.length || updateMutation.isPending || validateMutation.isPending}
            data-testid="settings-save"
          >
            {updateMutation.isPending || validateMutation.isPending ? '保存中...' : `保存配置${dirtyKeys.length ? ` (${dirtyKeys.length})` : ''}`}
          </button>
        </div>
        {configFeedback ? (
          <p className={`mt-3 text-sm font-medium ${configFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {configFeedback.message}
          </p>
        ) : null}
      </header>

      <div className="grid gap-[var(--dsa-layout-gap)] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-[var(--dsa-card-padding)]">
          <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">配置分类</p>
          <div className="mt-2 space-y-2">
            {categories.map((category) => {
              const itemCount = allItems.filter((item) => (item.schema?.category || 'uncategorized') === category).length
              const count = itemCount + (customSectionCountByCategory[category] || 0)
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    effectiveActiveCategory === category
                      ? 'dsa-theme-border-accent dsa-theme-bg-accent dsa-theme-text-accent'
                      : 'dsa-theme-border-subtle bg-white text-slate-600 hover:dsa-theme-bg-soft'
                  }`}
                  data-testid={`settings-category-${category}`}
                >
                  <span>{categoryLabel[category] || category}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{count}</span>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="space-y-[var(--dsa-layout-gap)]">
          <section className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-[var(--dsa-card-padding)]">
            <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">
              {effectiveActiveCategory === 'ui' ? 'UI 偏好' : '当前分类配置项'}
            </p>

            {showUiSection ? (
              <div className="mt-3" data-testid="settings-ui-panel">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Theme</p>
                    <p className="mt-1 text-sm text-slate-600">
                      切换 DSA UI 的主色调，立即生效，并自动保存在当前浏览器。
                    </p>
                  </div>
                  <div className="rounded-full dsa-theme-bg-accent px-3 py-1 text-xs font-semibold dsa-theme-text-accent">
                    当前主题：{activeTheme.label}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2" data-testid="settings-ui-theme-select">
                  {THEME_OPTIONS.map((option) => {
                    const selected = option.id === theme
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTheme(option.id)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'dsa-theme-border-accent dsa-theme-bg-accent dsa-theme-shadow-active'
                            : 'dsa-theme-border-subtle bg-white hover:dsa-theme-bg-soft'
                        }`}
                        data-testid={`settings-ui-theme-${option.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                            <p className="mt-1 text-xs text-slate-600">{option.description}</p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              selected ? 'dsa-theme-bg-accent-strong dsa-theme-text-accent' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {selected ? '当前主题' : '点击切换'}
                          </span>
                        </div>
                        <div className="mt-4 flex gap-2">
                          {option.swatches.map((swatch) => (
                            <span
                              key={`${option.id}-${swatch}`}
                              className="h-8 flex-1 rounded-xl border border-white/70 shadow-sm"
                              style={{ background: swatch }}
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <>
                {configQuery.isFetching ? <p className="mt-3 text-sm text-slate-600">正在加载配置...</p> : null}
                {configQuery.error ? <p className="mt-3 text-sm text-rose-700">{getParsedApiError(configQuery.error).message}</p> : null}
                {!configQuery.isFetching && !configQuery.error && filteredItems.length === 0 ? <p className="mt-3 text-sm text-slate-600">当前分类暂无匹配项。</p> : null}
                <div className="mt-3 space-y-3">
                  {filteredItems.map((item) => (
                    <article
                      key={item.key}
                      className={`rounded-xl border bg-white p-3 ${
                        issuesByKey[item.key]?.length ? 'border-rose-300/80' : 'dsa-theme-border-subtle'
                      }`}
                      data-testid={`settings-field-${item.key}`}
                    >
                      <div className="mb-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{item.key}</p>
                        <p className="text-sm font-medium text-slate-900">{item.schema?.title || item.key}</p>
                        {item.schema?.description ? <p className="mt-1 text-xs text-slate-500">{item.schema.description}</p> : null}
                      </div>
                      {renderFieldControl(item)}
                      {issuesByKey[item.key]?.length ? (
                        <ul className="mt-2 space-y-1 text-xs text-rose-700">
                          {issuesByKey[item.key].map((issue, index) => (
                            <li key={`${issue.code}-${index}`}>[{issue.severity}] {issue.message}</li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>

          {showSystemSections ? (
            <>
              <section className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-[var(--dsa-card-padding)]" data-testid="settings-auth-panel">
                <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">认证设置</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="inline-flex items-center gap-2 rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={authEnabledDraft}
                        onChange={(event) => setAuthEnabledOverride(event.target.checked)}
                        data-testid="settings-auth-toggle"
                      />
                    启用管理员认证
                  </label>
                  <div className="rounded-lg border dsa-theme-border-subtle bg-white px-3 py-2 text-xs text-slate-600">
                    当前状态：{authStatusQuery.data?.loggedIn ? '已登录' : '未登录'} · 密码{authStatusQuery.data?.passwordSet ? '已设置' : '未设置'}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <input
                    type="password"
                    value={authCurrentPassword}
                    onChange={(event) => setAuthCurrentPassword(event.target.value)}
                    placeholder="当前密码（修改时填写）"
                    className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="新密码（可选）"
                    className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    value={authPasswordConfirm}
                    onChange={(event) => setAuthPasswordConfirm(event.target.value)}
                    placeholder="确认新密码"
                    className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleSaveAuthSettings()}
                  className="mt-3 rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-2 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
                  disabled={authUpdateMutation.isPending}
                  data-testid="settings-auth-save"
                >
                  {authUpdateMutation.isPending ? '保存中...' : '保存认证设置'}
                </button>
                {authFeedback ? (
                  <p className={`mt-2 text-sm font-medium ${authFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {authFeedback.message}
                  </p>
                ) : null}
              </section>

              <section className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-[var(--dsa-card-padding)]" data-testid="settings-env-panel">
                <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">桌面端 .env 导入导出</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleExportDesktopEnv()}
                    className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:dsa-theme-bg-soft disabled:opacity-60"
                    disabled={exportEnvMutation.isPending}
                    data-testid="settings-export-env"
                  >
                    {exportEnvMutation.isPending ? '导出中...' : '导出 .env'}
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-2 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
                    disabled={importEnvMutation.isPending}
                    data-testid="settings-import-env"
                  >
                    {importEnvMutation.isPending ? '导入中...' : '导入 .env'}
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".env,.txt"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file) {
                        void handleImportDesktopEnv(file)
                      }
                    }}
                  />
                </div>
                {desktopFeedback ? (
                  <p className={`mt-2 text-sm font-medium ${desktopFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {desktopFeedback.message}
                  </p>
                ) : null}
              </section>
            </>
          ) : null}

          {showAiModelSections ? (
            <section className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-[var(--dsa-card-padding)]" data-testid="settings-llm-panel">
              <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">LLM 渠道连通性测试</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  value={channelName}
                  onChange={(event) => setChannelName(event.target.value)}
                  placeholder="渠道名称"
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                />
                <input
                  value={channelProtocol}
                  onChange={(event) => setChannelProtocol(event.target.value)}
                  placeholder="协议（openai / anthropic ...）"
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                />
                <input
                  value={channelBaseUrl}
                  onChange={(event) => setChannelBaseUrl(event.target.value)}
                  placeholder="Base URL（可选）"
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                />
                <input
                  value={channelApiKey}
                  onChange={(event) => setChannelApiKey(event.target.value)}
                  placeholder="API Key（可选）"
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                />
              </div>
              <input
                value={channelModels}
                onChange={(event) => setChannelModels(event.target.value)}
                placeholder="模型列表，逗号分隔"
                className="mt-2 w-full rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleTestChannel()}
                className="mt-3 rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-2 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
                disabled={testChannelMutation.isPending}
                data-testid="settings-test-channel"
              >
                {testChannelMutation.isPending ? '测试中...' : '测试渠道'}
              </button>
              {channelFeedback ? (
                <p className={`mt-2 text-sm font-medium ${channelFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {channelFeedback.message}
                </p>
              ) : null}
              {channelResult ? (
                <p className="mt-1 text-xs text-slate-600">
                  协议：{channelResult.resolvedProtocol || '--'} · 模型：{channelResult.resolvedModel || '--'} · 延迟：{channelResult.latencyMs ?? '--'}ms
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      {dirtyKeys.length > 0 ? (
        <aside
          className="fixed inset-x-4 bottom-20 z-20 rounded-xl border dsa-theme-border-default bg-white/95 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.15)] backdrop-blur-xl lg:inset-x-auto lg:left-[max(22rem,calc(50%-34rem))] lg:right-8 lg:bottom-6"
          data-testid="settings-save-bar"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600">检测到 {dirtyKeys.length} 项未保存修改</p>
            <button
              type="button"
              onClick={() => void handleSaveConfig()}
              className="rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-1.5 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover"
            >
              立即保存
            </button>
          </div>
        </aside>
      ) : null}
    </section>
  )
}
