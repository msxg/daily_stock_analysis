import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { analysisApi, DuplicateTaskError, getParsedApiError, historyApi } from '@/shared/api'
import type { HistoryItem, TaskInfo } from '@/shared/types/analysis'
import { formatDateTime, getRecentStartDate, getTodayInShanghai } from '@/shared/utils/date'
import { isObviouslyInvalidStockQuery, looksLikeStockCode, validateStockCode } from '@/shared/utils/validation'

const reportTabs = [
  { id: 'overview', label: '总览' },
  { id: 'strategy', label: '策略点位' },
  { id: 'news', label: '资讯' },
  { id: 'transparency', label: '透明度' },
  { id: 'markdown', label: 'Markdown' },
] as const

const analysisFormSchema = z.object({
  stockCode: z
    .string()
    .trim()
    .min(1, '请输入股票代码或股票名称')
    .refine((value) => !isObviouslyInvalidStockQuery(value), '请输入有效的股票代码或股票名称'),
  notify: z.boolean(),
})

type AnalysisFormValues = z.infer<typeof analysisFormSchema>
type InlineFeedback = { kind: 'success' | 'error'; message: string } | null
type ReportTabKey = (typeof reportTabs)[number]['id']
type MobilePane = 'history' | 'report'

function taskStatusText(status: string): string {
  if (status === 'pending') return '等待中'
  if (status === 'processing') return '进行中'
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  return status
}

function taskStatusClass(status: string): string {
  if (status === 'pending') return 'bg-amber-100 text-amber-700'
  if (status === 'processing') return 'bg-sky-100 text-sky-700'
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700'
  if (status === 'failed') return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-700'
}

function sentimentTone(score: number): string {
  if (score >= 75) return '偏乐观'
  if (score >= 55) return '谨慎乐观'
  if (score >= 40) return '中性'
  return '偏谨慎'
}

function sentimentClass(score: number): string {
  if (score >= 75) return 'bg-emerald-100 text-emerald-700'
  if (score >= 55) return 'bg-teal-100 text-teal-700'
  if (score >= 40) return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return '暂无'
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function shortText(value: string, max = 140): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

function normalizeDashboardStockCode(value: string | undefined): string {
  const normalized = (value || '').trim().toUpperCase()
  if (!normalized) return ''

  const hkPrefixMatch = normalized.match(/^HK(\d{1,5})$/)
  if (hkPrefixMatch) return `${hkPrefixMatch[1].padStart(5, '0')}.HK`

  const hkSuffixMatch = normalized.match(/^(\d{1,5})\.HK$/)
  if (hkSuffixMatch) return `${hkSuffixMatch[1].padStart(5, '0')}.HK`

  const cnPrefixMatch = normalized.match(/^(SH|SZ|BJ)(\d{6})$/)
  if (cnPrefixMatch) return `${cnPrefixMatch[2]}.${cnPrefixMatch[1] === 'SS' ? 'SH' : cnPrefixMatch[1]}`

  const cnSuffixMatch = normalized.match(/^(\d{6})\.(SH|SZ|SS|BJ)$/)
  if (cnSuffixMatch) return `${cnSuffixMatch[1]}.${cnSuffixMatch[2] === 'SS' ? 'SH' : cnSuffixMatch[2]}`

  return normalized
}

function findBestHistoryMatch(task: TaskInfo, items: HistoryItem[]): HistoryItem | null {
  if (!items.length) return null

  const normalizedTaskCode = normalizeDashboardStockCode(task.stockCode)
  const normalizedTaskName = (task.stockName || '').trim()

  const sameCodeItems = items.filter((item) => normalizeDashboardStockCode(item.stockCode) === normalizedTaskCode)
  const sameNameItems =
    normalizedTaskName.length > 0 ? items.filter((item) => (item.stockName || '').trim() === normalizedTaskName) : []

  const candidates = (sameCodeItems.length ? sameCodeItems : sameNameItems).slice()
  if (!candidates.length) return null

  candidates.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  return candidates[0] || null
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null)
  const [manageMode, setManageMode] = useState(false)
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<number[]>([])
  const [submitFeedback, setSubmitFeedback] = useState<InlineFeedback>(null)
  const [actionFeedback, setActionFeedback] = useState<InlineFeedback>(null)
  const [taskSelectionPendingId, setTaskSelectionPendingId] = useState<string | null>(null)
  const [activeReportTab, setActiveReportTab] = useState<ReportTabKey>('overview')
  const [mobilePane, setMobilePane] = useState<MobilePane>('report')

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<AnalysisFormValues>({
    resolver: zodResolver(analysisFormSchema),
    defaultValues: {
      stockCode: '',
      notify: true,
    },
  })

  const historyQuery = useQuery({
    queryKey: ['dashboard-history'],
    queryFn: () =>
      historyApi.getList({
        page: 1,
        limit: 20,
        startDate: getRecentStartDate(30),
        endDate: getTodayInShanghai(),
      }),
  })

  const taskQuery = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: () => analysisApi.getTasks({ limit: 8 }),
    refetchInterval: 12_000,
  })

  const historyItems = historyQuery.data?.items || []
  const effectiveSelectedRecordId = selectedRecordId ?? historyItems[0]?.id ?? null

  const visibleSelectedIds = selectedHistoryIds.filter((id) => historyItems.some((item) => item.id === id))
  const allVisibleSelected = historyItems.length > 0 && visibleSelectedIds.length === historyItems.length

  const reportQuery = useQuery({
    queryKey: ['dashboard-report', effectiveSelectedRecordId],
    queryFn: () => historyApi.getDetail(effectiveSelectedRecordId as number),
    enabled: effectiveSelectedRecordId !== null,
  })

  const newsQuery = useQuery({
    queryKey: ['dashboard-report-news', effectiveSelectedRecordId],
    queryFn: () => historyApi.getNews(effectiveSelectedRecordId as number, 10),
    enabled: effectiveSelectedRecordId !== null && activeReportTab === 'news',
  })

  const markdownQuery = useQuery({
    queryKey: ['dashboard-markdown', effectiveSelectedRecordId],
    queryFn: () => historyApi.getMarkdown(effectiveSelectedRecordId as number),
    enabled: effectiveSelectedRecordId !== null && activeReportTab === 'markdown',
  })

  const analyzeMutation = useMutation({
    mutationFn: analysisApi.analyzeAsync,
  })

  const deleteHistoryMutation = useMutation({
    mutationFn: historyApi.deleteRecords,
  })

  const onSubmit = async (values: AnalysisFormValues) => {
    setSubmitFeedback(null)
    clearErrors('stockCode')

    let normalizedStockCode = values.stockCode.trim()
    if (looksLikeStockCode(normalizedStockCode)) {
      const validation = validateStockCode(normalizedStockCode)
      if (!validation.valid) {
        setError('stockCode', { message: validation.message })
        return
      }
      normalizedStockCode = validation.normalized
    }

    try {
      const response = await analyzeMutation.mutateAsync({
        stockCode: normalizedStockCode,
        reportType: 'detailed',
        selectionSource: 'manual',
        originalQuery: values.stockCode.trim(),
        notify: values.notify,
      })

      const acceptedCount = 'accepted' in response ? response.accepted.length : 1
      const duplicateCount = 'duplicates' in response ? response.duplicates.length : 0
      const duplicateHint = duplicateCount > 0 ? `，${duplicateCount} 条重复任务已跳过` : ''
      setSubmitFeedback({ kind: 'success', message: `分析任务已提交（${acceptedCount}）${duplicateHint}` })
      reset({ stockCode: '', notify: values.notify })
      void historyQuery.refetch()
      void taskQuery.refetch()
    } catch (error) {
      if (error instanceof DuplicateTaskError) {
        setSubmitFeedback({ kind: 'error', message: `股票 ${error.stockCode} 正在分析中，请稍后重试。` })
        return
      }

      const parsed = getParsedApiError(error)
      setSubmitFeedback({ kind: 'error', message: parsed.message })
    }
  }

  const toggleHistorySelection = (recordId: number) => {
    setSelectedHistoryIds((current) => (current.includes(recordId) ? current.filter((id) => id !== recordId) : [...current, recordId]))
  }

  const selectReportRecord = (recordId: number) => {
    setSelectedRecordId(recordId)
    setActiveReportTab('overview')
    setMobilePane('report')
  }

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedHistoryIds([])
      return
    }
    setSelectedHistoryIds(historyItems.map((item) => item.id))
  }

  const deleteSelectedHistory = async () => {
    if (visibleSelectedIds.length === 0) return
    if (!window.confirm(`确定删除选中的 ${visibleSelectedIds.length} 条历史记录吗？`)) return

    setActionFeedback(null)
    try {
      await deleteHistoryMutation.mutateAsync(visibleSelectedIds)
      if (effectiveSelectedRecordId !== null && visibleSelectedIds.includes(effectiveSelectedRecordId)) {
        setSelectedRecordId(null)
      }
      setActionFeedback({ kind: 'success', message: `已删除 ${visibleSelectedIds.length} 条历史记录。` })
      setSelectedHistoryIds([])
      setManageMode(false)
      void historyQuery.refetch()
      void taskQuery.refetch()
    } catch (error) {
      const parsed = getParsedApiError(error)
      setActionFeedback({ kind: 'error', message: parsed.message })
    }
  }

  const copySummary = async () => {
    if (!reportQuery.data) return
    const text = [
      `分析总结：${reportQuery.data.summary.analysisSummary}`,
      `操作建议：${reportQuery.data.summary.operationAdvice}`,
      `趋势预测：${reportQuery.data.summary.trendPrediction}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setActionFeedback({ kind: 'success', message: '报告摘要已复制。' })
    } catch {
      setActionFeedback({ kind: 'error', message: '复制失败，请检查浏览器剪贴板权限。' })
    }
  }

  const openMarkdownTab = () => {
    setActiveReportTab('markdown')
  }

  const gotoChatWithContext = () => {
    if (effectiveSelectedRecordId === null) {
      navigate('/chat')
      return
    }
    navigate(`/chat?from=report&recordId=${effectiveSelectedRecordId}`)
  }

  const handleSelectTaskReport = async (task: TaskInfo) => {
    setActionFeedback(null)

    if (task.status !== 'completed') {
      setMobilePane('report')
      setActionFeedback({ kind: 'error', message: '该任务尚未生成可查看报告，请等待分析完成。' })
      return
    }

    const visibleMatch = findBestHistoryMatch(task, historyItems)
    if (visibleMatch) {
      selectReportRecord(visibleMatch.id)
      return
    }

    setTaskSelectionPendingId(task.taskId)
    try {
      const response = await historyApi.getList({
        stockCode: task.stockCode,
        page: 1,
        limit: 20,
      })
      const matchedReport = findBestHistoryMatch(task, response.items)

      if (!matchedReport) {
        setMobilePane('report')
        setActionFeedback({
          kind: 'error',
          message: `未找到 ${task.stockName || task.stockCode} 的已生成报告。`,
        })
        return
      }

      selectReportRecord(matchedReport.id)
    } catch (error) {
      setMobilePane('report')
      setActionFeedback({ kind: 'error', message: getParsedApiError(error).message })
    } finally {
      setTaskSelectionPendingId(null)
    }
  }

  const reportData = reportQuery.data
  const reportDetails = reportData?.details
  const rawResult = asRecord(reportDetails?.rawResult)
  const dashboardMeta = asRecord(rawResult?.dashboard)
  const battlePlan = asRecord(dashboardMeta?.battlePlan)
  const contextSnapshot = asRecord(reportDetails?.contextSnapshot)
  const realtimeQuote = asRecord(contextSnapshot?.realtimeQuote)
  const trendResult = asRecord(contextSnapshot?.trendResult)
  const fundamentalContext = asRecord(contextSnapshot?.fundamentalContext)
  const fundamentalErrors = asStringArray(fundamentalContext?.errors).slice(0, 5)
  const actionChecklist = asStringArray(battlePlan?.actionChecklist)
  const relatedBoards = reportDetails?.belongBoards || []
  const sentimentScore = reportData?.summary.sentimentScore ?? 50

  return (
    <section className="space-y-4" data-testid="page-dashboard">
      <div className="rounded-3xl border border-teal-900/10 bg-white/85 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <h2 hidden data-testid="page-title-dashboard">
          分析台
        </h2>

        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={handleSubmit(onSubmit)} data-testid="analysis-form">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">股票代码 / 名称</span>
            <input
              {...register('stockCode')}
              className="h-11 rounded-xl border border-teal-900/15 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              placeholder="例如：600519 / HK00700 / AAPL"
              autoComplete="off"
              aria-label="股票代码"
            />
          </label>

          <label className="inline-flex items-center gap-2 rounded-xl border border-teal-900/15 bg-white px-3 py-2 text-sm text-slate-700 md:self-end">
            <input {...register('notify')} type="checkbox" className="h-4 w-4 accent-teal-600" />
            推送通知
          </label>

          <button
            type="submit"
            className="h-11 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 md:self-end"
            disabled={analyzeMutation.isPending}
          >
            {analyzeMutation.isPending ? '提交中...' : '提交分析'}
          </button>
        </form>

        {errors.stockCode ? <p className="mt-2 text-sm font-medium text-rose-600">{errors.stockCode.message}</p> : null}
        {submitFeedback ? (
          <p className={`mt-2 text-sm font-medium ${submitFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
            {submitFeedback.message}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-teal-900/10 bg-white/80 p-2 lg:hidden" data-testid="mobile-view-switcher">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMobilePane('history')}
            aria-pressed={mobilePane === 'history'}
            data-testid="mobile-pane-history"
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              mobilePane === 'history'
                ? 'bg-teal-500/12 text-teal-900 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.24)]'
                : 'bg-white text-slate-600'
            }`}
          >
            历史与任务
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('report')}
            aria-pressed={mobilePane === 'report'}
            data-testid="mobile-pane-report"
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              mobilePane === 'report'
                ? 'bg-teal-500/12 text-teal-900 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.24)]'
                : 'bg-white text-slate-600'
            }`}
          >
            报告详情
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={`${mobilePane === 'history' ? 'block' : 'hidden'} space-y-3 lg:block`}>
          <article className="rounded-2xl border border-teal-900/10 bg-white/80 p-4" data-testid="task-panel">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-teal-900/80">任务状态</p>
              <button
                type="button"
                onClick={() => void taskQuery.refetch()}
                className="rounded-lg border border-teal-900/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={taskQuery.isFetching}
              >
                {taskQuery.isFetching ? '刷新中...' : '刷新任务'}
              </button>
            </div>

            {taskQuery.error ? <p className="text-sm text-rose-600">{getParsedApiError(taskQuery.error).message}</p> : null}
            {!taskQuery.error && (taskQuery.data?.tasks.length ?? 0) === 0 ? (
              <p className="rounded-xl border border-dashed border-teal-900/20 bg-teal-50/70 p-3 text-sm text-slate-600">当前没有任务。</p>
            ) : null}

            <div className="space-y-2">
              {(taskQuery.data?.tasks || []).map((task) => (
                <button
                  key={task.taskId}
                  type="button"
                  onClick={() => void handleSelectTaskReport(task)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                    reportData && normalizeDashboardStockCode(task.stockCode) === normalizeDashboardStockCode(reportData.meta.stockCode)
                      ? 'border-teal-500/35 bg-teal-500/10 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.22)]'
                      : 'border-teal-900/10 bg-white hover:bg-teal-50/60'
                  }`}
                  data-testid={`task-item-${task.taskId}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{task.stockName || task.stockCode}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${taskStatusClass(task.status)}`}>
                      {taskStatusText(task.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{task.stockCode}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {taskSelectionPendingId === task.taskId ? '正在定位对应报告...' : task.message || `进度 ${task.progress}%`}
                  </p>
                </button>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-teal-900/10 bg-white/80 p-4" data-testid="history-panel">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-teal-900/80">历史分析</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setManageMode((value) => !value)
                    setSelectedHistoryIds([])
                  }}
                  className="rounded-lg border border-teal-900/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-teal-50"
                >
                  {manageMode ? '退出管理' : '管理模式'}
                </button>
                <button
                  type="button"
                  onClick={() => void historyQuery.refetch()}
                  className="rounded-lg border border-teal-900/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={historyQuery.isFetching}
                >
                  {historyQuery.isFetching ? '刷新中...' : '刷新历史'}
                </button>
              </div>
            </div>

            {manageMode ? (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-teal-900/10 bg-teal-50/70 px-3 py-2 text-xs">
                <button type="button" className="font-semibold text-teal-900" onClick={toggleSelectAllVisible}>
                  {allVisibleSelected ? '取消全选' : '全选'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={visibleSelectedIds.length === 0 || deleteHistoryMutation.isPending}
                  onClick={() => void deleteSelectedHistory()}
                >
                  {deleteHistoryMutation.isPending ? '删除中...' : `删除选中 (${visibleSelectedIds.length})`}
                </button>
              </div>
            ) : null}

            {historyQuery.error ? <p className="text-sm text-rose-600">{getParsedApiError(historyQuery.error).message}</p> : null}
            {!historyQuery.error && historyItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-teal-900/20 bg-teal-50/70 p-3 text-sm text-slate-600">暂无历史记录，先提交一次分析任务。</p>
            ) : null}

            <div className="space-y-2">
              {historyItems.map((item) => {
                const active = effectiveSelectedRecordId === item.id
                const selectedInManage = visibleSelectedIds.includes(item.id)
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border px-2.5 py-2 transition ${
                      active
                        ? 'border-teal-500/35 bg-teal-500/10 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.22)]'
                        : 'border-teal-900/10 bg-white hover:bg-teal-50/60'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {manageMode ? (
                        <input
                          type="checkbox"
                          checked={selectedInManage}
                          onChange={() => toggleHistorySelection(item.id)}
                          className="mt-1 h-4 w-4 accent-teal-600"
                          aria-label={`选择历史-${item.id}`}
                        />
                      ) : null}
                      <button
                          type="button"
                          onClick={() => {
                            selectReportRecord(item.id)
                          }}
                          className="w-full text-left"
                        >
                        <p className="text-sm font-semibold text-slate-900">{item.stockName || item.stockCode}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.stockCode}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </article>
        </aside>

        <article
          className={`${mobilePane === 'report' ? 'block' : 'hidden'} rounded-2xl border border-teal-900/10 bg-white/80 p-4 lg:block`}
          data-testid="dashboard-report-panel"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-teal-900/80">报告摘要</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-teal-900/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void copySummary()}
                disabled={!reportData}
              >
                复制摘要
              </button>
              <button
                type="button"
                className="rounded-lg border border-teal-900/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={openMarkdownTab}
                disabled={effectiveSelectedRecordId === null}
              >
                查看 Markdown
              </button>
              <button
                type="button"
                className="rounded-lg border border-teal-900/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-teal-50"
                onClick={gotoChatWithContext}
              >
                追问 AI
              </button>
            </div>
          </div>

          {actionFeedback ? (
            <p className={`mb-3 text-sm font-medium ${actionFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
              {actionFeedback.message}
            </p>
          ) : null}

          {effectiveSelectedRecordId === null ? (
            <div className="mt-4 rounded-2xl border border-dashed border-teal-900/20 bg-teal-50/70 p-5 text-sm text-slate-600">
              先提交分析任务或选择一条历史记录，即可查看报告摘要。
            </div>
          ) : null}

          {effectiveSelectedRecordId !== null && reportQuery.isFetching ? (
            <div className="mt-4 rounded-2xl border border-dashed border-teal-900/20 bg-teal-50/70 p-5 text-sm text-slate-600">正在加载报告详情...</div>
          ) : null}

          {effectiveSelectedRecordId !== null && reportQuery.error ? (
            <div className="mt-4 rounded-2xl border border-rose-300/70 bg-rose-50 p-5 text-sm text-rose-700">
              {getParsedApiError(reportQuery.error).message}
            </div>
          ) : null}

          {reportData ? (
            <div className="mt-3 space-y-3">
              <header className="rounded-2xl border border-teal-900/10 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {reportData.meta.stockName} · {reportData.meta.stockCode}
                  </p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sentimentClass(sentimentScore)}`}>
                    情绪 {sentimentScore} · {sentimentTone(sentimentScore)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">报告时间：{formatDateTime(reportData.meta.createdAt)}</p>
              </header>

              <nav className="flex flex-wrap gap-2" aria-label="报告标签">
                {reportTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveReportTab(tab.id)}
                    aria-pressed={activeReportTab === tab.id}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      activeReportTab === tab.id
                        ? 'border-teal-500/35 bg-teal-500/12 text-teal-900 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.22)]'
                        : 'border-teal-900/10 bg-white text-slate-600 hover:bg-teal-50'
                    }`}
                    data-testid={`report-tab-${tab.id}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              {activeReportTab === 'overview' ? (
                <section className="space-y-3" data-testid="report-tab-content-overview">
                  <div className="grid gap-3 md:grid-cols-3">
                    <article className="rounded-xl border border-teal-900/10 bg-white p-4 md:col-span-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">分析总结</p>
                      <p className="mt-2 text-sm text-slate-700">{reportData.summary.analysisSummary}</p>
                    </article>
                    <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">操作建议</p>
                      <p className="mt-2 text-sm text-slate-700">{reportData.summary.operationAdvice}</p>
                    </article>
                    <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">趋势预测</p>
                      <p className="mt-2 text-sm text-slate-700">{reportData.summary.trendPrediction}</p>
                    </article>
                  </div>

                  <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">关联板块</p>
                    {relatedBoards.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {relatedBoards.slice(0, 12).map((board) => (
                          <span key={`${board.name}-${board.code || 'na'}`} className="rounded-full border border-teal-900/15 bg-teal-50 px-2.5 py-1 text-xs text-teal-900">
                            {board.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">暂无板块数据。</p>
                    )}
                  </article>
                </section>
              ) : null}

              {activeReportTab === 'strategy' ? (
                <section className="space-y-3" data-testid="report-tab-content-strategy">
                  <div className="grid gap-3 md:grid-cols-2">
                    <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">理想买点</p>
                      <p className="mt-2 text-sm text-slate-700">{reportData.strategy?.idealBuy || '暂未给出，建议结合盘中量价确认。'}</p>
                    </article>
                    <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">次优买点</p>
                      <p className="mt-2 text-sm text-slate-700">{reportData.strategy?.secondaryBuy || '暂未给出，建议等待更清晰回踩信号。'}</p>
                    </article>
                    <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">止损建议</p>
                      <p className="mt-2 text-sm text-slate-700">{reportData.strategy?.stopLoss || '暂未给出，请结合仓位风险自行设置。'}</p>
                    </article>
                    <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">止盈建议</p>
                      <p className="mt-2 text-sm text-slate-700">{reportData.strategy?.takeProfit || '暂未给出，建议按波动分段止盈。'}</p>
                    </article>
                  </div>

                  {actionChecklist.length > 0 ? (
                    <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">执行清单</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {actionChecklist.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  ) : null}
                </section>
              ) : null}

              {activeReportTab === 'news' ? (
                <section className="space-y-3" data-testid="report-tab-content-news">
                  <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">资讯摘要</p>
                    <p className="mt-2 text-sm text-slate-700">{reportDetails?.newsContent || '暂无资讯摘要。'}</p>
                  </article>

                  <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">资讯列表</p>
                    {newsQuery.isFetching ? <p className="mt-2 text-sm text-slate-600">正在加载资讯...</p> : null}
                    {newsQuery.error ? <p className="mt-2 text-sm text-rose-600">{getParsedApiError(newsQuery.error).message}</p> : null}
                    {!newsQuery.isFetching && !newsQuery.error && (newsQuery.data?.items.length ?? 0) === 0 ? (
                      <p className="mt-2 text-sm text-slate-600">暂无资讯数据。</p>
                    ) : null}
                    <div className="mt-2 space-y-2">
                      {(newsQuery.data?.items || []).map((item) => (
                        <a
                          key={`${item.url}-${item.title}`}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg border border-teal-900/10 bg-slate-50 px-3 py-2 transition hover:border-teal-400/40 hover:bg-teal-50/50"
                        >
                          <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-600">{shortText(item.snippet)}</p>
                        </a>
                      ))}
                    </div>
                  </article>
                </section>
              ) : null}

              {activeReportTab === 'transparency' ? (
                <section className="space-y-3" data-testid="report-tab-content-transparency">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">模型与来源</p>
                      <dl className="mt-2 space-y-1 text-sm text-slate-700">
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">模型</dt>
                          <dd className="text-right">{asString(reportData.meta.modelUsed)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">报告类型</dt>
                          <dd className="text-right">{reportData.meta.reportType}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">语言</dt>
                          <dd className="text-right">{asString(reportData.meta.reportLanguage)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">来源链路</dt>
                          <dd className="text-right">{asString(rawResult?.dataSources)}</dd>
                        </div>
                      </dl>
                    </article>

                    <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">行情快照</p>
                      <dl className="mt-2 space-y-1 text-sm text-slate-700">
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">最新价</dt>
                          <dd className="text-right">{asString(realtimeQuote?.price)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">涨跌幅</dt>
                          <dd className="text-right">{asString(realtimeQuote?.changePct)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">量比</dt>
                          <dd className="text-right">{asString(realtimeQuote?.volumeRatio)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">换手率</dt>
                          <dd className="text-right">{asString(realtimeQuote?.turnoverRate)}</dd>
                        </div>
                      </dl>
                    </article>

                    <article className="rounded-xl border border-teal-900/10 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">趋势信号</p>
                      <dl className="mt-2 space-y-1 text-sm text-slate-700">
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">趋势状态</dt>
                          <dd className="text-right">{asString(trendResult?.trendStatus)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">信号强度</dt>
                          <dd className="text-right">{asString(trendResult?.signalScore)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">建议方向</dt>
                          <dd className="text-right">{asString(rawResult?.decisionType)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-slate-500">置信等级</dt>
                          <dd className="text-right">{asString(rawResult?.confidenceLevel)}</dd>
                        </div>
                      </dl>
                    </article>
                  </div>

                  {fundamentalErrors.length > 0 ? (
                    <article className="rounded-xl border border-amber-200/70 bg-amber-50 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-amber-700">数据缺口提示</p>
                      <ul className="mt-2 space-y-1 text-sm text-amber-800">
                        {fundamentalErrors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </article>
                  ) : null}
                </section>
              ) : null}

              {activeReportTab === 'markdown' ? (
                <section className="rounded-2xl border border-teal-900/10 bg-white p-4" data-testid="report-tab-content-markdown">
                  {markdownQuery.isFetching ? <p className="text-sm text-slate-600">正在加载 Markdown...</p> : null}
                  {markdownQuery.error ? <p className="text-sm text-rose-600">{getParsedApiError(markdownQuery.error).message}</p> : null}
                  {!markdownQuery.isFetching && !markdownQuery.error ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-teal-900/10 bg-slate-50 p-3 text-xs text-slate-700">
                      {markdownQuery.data || '暂无 Markdown 内容。'}
                    </pre>
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : null}
        </article>
      </div>
    </section>
  )
}
