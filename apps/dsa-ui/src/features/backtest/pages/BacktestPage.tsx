import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AreaTrendChart, type TrendPoint } from '@/shared/ui/charts/AreaTrendChart'
import { backtestApi, getParsedApiError } from '@/shared/api'
import type { BacktestResultItem } from '@/shared/types/backtest'

type InlineFeedback = { kind: 'success' | 'error'; message: string } | null
const EMPTY_RESULTS: BacktestResultItem[] = []

function pct(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return '--'
  return `${value.toFixed(1)}%`
}

function statusClass(status: string): string {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700'
  if (status === 'insufficient') return 'bg-amber-100 text-amber-700'
  if (status === 'error') return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-700'
}

function outcomeClass(outcome: string | undefined): string {
  if (outcome === 'win') return 'bg-emerald-100 text-emerald-700'
  if (outcome === 'loss') return 'bg-rose-100 text-rose-700'
  if (outcome === 'neutral') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-700'
}

function pickDateLabel(row: BacktestResultItem, index: number): string {
  return row.analysisDate || row.evaluatedAt?.slice(0, 10) || `t-${index + 1}`
}

function buildTrendData(items: BacktestResultItem[]): TrendPoint[] {
  if (!items.length) return []

  const sorted = [...items].sort((left, right) => {
    const leftDate = left.analysisDate || left.evaluatedAt || ''
    const rightDate = right.analysisDate || right.evaluatedAt || ''
    return leftDate.localeCompare(rightDate)
  })

  let cumulative = 0
  let count = 0
  return sorted.map((item, index) => {
    const value = item.simulatedReturnPct ?? item.stockReturnPct ?? 0
    cumulative += value
    count += 1
    return {
      time: pickDateLabel(item, index),
      value: Number((cumulative / count).toFixed(2)),
    }
  })
}

function pickFocusCode(items: BacktestResultItem[]): string | null {
  if (!items.length) return null
  const counter = new Map<string, number>()
  items.forEach((item) => {
    counter.set(item.code, (counter.get(item.code) || 0) + 1)
  })
  const sorted = [...counter.entries()].sort((left, right) => right[1] - left[1])
  return sorted[0]?.[0] || null
}

export function BacktestPage() {
  const [codeInput, setCodeInput] = useState('')
  const [evalWindowInput, setEvalWindowInput] = useState('')
  const [forceRun, setForceRun] = useState(false)

  const [submittedCode, setSubmittedCode] = useState('')
  const [submittedEvalWindow, setSubmittedEvalWindow] = useState<number | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [actionFeedback, setActionFeedback] = useState<InlineFeedback>(null)
  const [runSummary, setRunSummary] = useState<{
    processed: number
    saved: number
    completed: number
    insufficient: number
    errors: number
  } | null>(null)

  const runMutation = useMutation({
    mutationFn: backtestApi.run,
  })

  const resultsQuery = useQuery({
    queryKey: ['backtest-results', submittedCode, submittedEvalWindow, currentPage],
    queryFn: () =>
      backtestApi.getResults({
        code: submittedCode || undefined,
        evalWindowDays: submittedEvalWindow,
        page: currentPage,
        limit: 20,
      }),
  })

  const overallPerfQuery = useQuery({
    queryKey: ['backtest-overall-performance', submittedEvalWindow],
    queryFn: () => backtestApi.getOverallPerformance(submittedEvalWindow),
  })

  const stockPerfQuery = useQuery({
    queryKey: ['backtest-stock-performance', submittedCode, submittedEvalWindow],
    queryFn: () => backtestApi.getStockPerformance(submittedCode, submittedEvalWindow),
    enabled: !!submittedCode,
  })

  const resultItems = resultsQuery.data?.items ?? EMPTY_RESULTS
  const totalItems = resultsQuery.data?.total || 0
  const totalPages = Math.max(1, Math.ceil(totalItems / 20))

  const focusCode = submittedCode || pickFocusCode(resultItems)
  const overallTrend = useMemo(() => buildTrendData(resultItems), [resultItems])
  const stockTrend = useMemo(() => {
    if (!focusCode) return []
    return buildTrendData(resultItems.filter((item) => item.code === focusCode))
  }, [focusCode, resultItems])

  const handleApplyFilter = () => {
    const normalizedCode = codeInput.trim().toUpperCase()
    const evalWindow = evalWindowInput ? Number(evalWindowInput) : undefined
    setSubmittedCode(normalizedCode)
    setSubmittedEvalWindow(evalWindow && evalWindow > 0 ? evalWindow : undefined)
    setCurrentPage(1)
    setActionFeedback(null)
  }

  const handleRunBacktest = async () => {
    const normalizedCode = codeInput.trim().toUpperCase()
    const evalWindow = evalWindowInput ? Number(evalWindowInput) : undefined

    setActionFeedback(null)
    setRunSummary(null)
    try {
      const result = await runMutation.mutateAsync({
        code: normalizedCode || undefined,
        force: forceRun || undefined,
        evalWindowDays: evalWindow && evalWindow > 0 ? evalWindow : undefined,
        minAgeDays: forceRun ? 0 : undefined,
      })
      setRunSummary(result)
      setSubmittedCode(normalizedCode)
      setSubmittedEvalWindow(evalWindow && evalWindow > 0 ? evalWindow : undefined)
      setCurrentPage(1)
      setActionFeedback({ kind: 'success', message: '回测任务执行完成，结果已刷新。' })
      await Promise.all([resultsQuery.refetch(), overallPerfQuery.refetch(), stockPerfQuery.refetch()])
    } catch (error) {
      setActionFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  return (
    <section className="space-y-3" data-testid="page-backtest">
      <header className="rounded-2xl border border-teal-900/10 bg-white/80 p-4">
        <h2 hidden data-testid="page-title-backtest">
          回测
        </h2>

        <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_120px_auto_auto_auto]">
          <input
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
            placeholder="股票代码（留空代表全量）"
            className="rounded-lg border border-teal-900/15 bg-white px-3 py-2 text-sm text-slate-800"
            data-testid="backtest-code-input"
          />
          <input
            value={evalWindowInput}
            onChange={(event) => setEvalWindowInput(event.target.value)}
            placeholder="窗口天数"
            type="number"
            min={1}
            max={120}
            className="rounded-lg border border-teal-900/15 bg-white px-3 py-2 text-sm text-slate-800"
            data-testid="backtest-window-input"
          />
          <label className="inline-flex items-center gap-2 rounded-lg border border-teal-900/15 bg-white px-3 py-2 text-xs text-slate-700">
            <input type="checkbox" checked={forceRun} onChange={(event) => setForceRun(event.target.checked)} />
            强制重跑
          </label>
          <button
            type="button"
            onClick={handleApplyFilter}
            className="rounded-lg border border-teal-900/15 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-teal-50"
            data-testid="backtest-filter-submit"
          >
            应用筛选
          </button>
          <button
            type="button"
            onClick={() => void handleRunBacktest()}
            className="rounded-lg border border-teal-900/15 bg-teal-500/12 px-3 py-2 text-xs font-semibold text-teal-900 transition hover:bg-teal-500/18 disabled:opacity-60"
            disabled={runMutation.isPending}
            data-testid="backtest-run-submit"
          >
            {runMutation.isPending ? '执行中...' : '运行回测'}
          </button>
        </div>

        {actionFeedback ? (
          <p className={`mt-3 text-sm font-medium ${actionFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {actionFeedback.message}
          </p>
        ) : null}

        {runSummary ? (
          <div className="mt-3 grid gap-2 rounded-xl border border-teal-900/10 bg-white p-3 text-xs text-slate-700 md:grid-cols-5" data-testid="backtest-run-summary">
            <p>Processed: {runSummary.processed}</p>
            <p>Saved: {runSummary.saved}</p>
            <p>Completed: {runSummary.completed}</p>
            <p>Insufficient: {runSummary.insufficient}</p>
            <p>Errors: {runSummary.errors}</p>
          </div>
        ) : null}
      </header>

      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-teal-900/10 bg-white/80 p-3">
          <p className="text-xs text-slate-500">方向准确率</p>
          <p className="mt-1 text-xl font-semibold text-slate-900" data-testid="backtest-kpi-accuracy">
            {pct(overallPerfQuery.data?.directionAccuracyPct)}
          </p>
        </article>
        <article className="rounded-2xl border border-teal-900/10 bg-white/80 p-3">
          <p className="text-xs text-slate-500">胜率</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{pct(overallPerfQuery.data?.winRatePct)}</p>
        </article>
        <article className="rounded-2xl border border-teal-900/10 bg-white/80 p-3">
          <p className="text-xs text-slate-500">平均模拟收益</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{pct(overallPerfQuery.data?.avgSimulatedReturnPct)}</p>
        </article>
        <article className="rounded-2xl border border-teal-900/10 bg-white/80 p-3">
          <p className="text-xs text-slate-500">样本数</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {overallPerfQuery.data?.completedCount ?? 0} / {overallPerfQuery.data?.totalEvaluations ?? 0}
          </p>
        </article>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <article className="rounded-2xl border border-teal-900/10 bg-white/80 p-4" data-testid="backtest-chart-overall">
          <p className="text-xs uppercase tracking-[0.16em] text-teal-900/80">全局表现趋势（累计均值）</p>
          <p className="mt-1 text-xs text-slate-500">基于当前筛选结果按日期构建。</p>
          {overallTrend.length > 1 ? <AreaTrendChart data={overallTrend} className="mt-3 w-full" /> : <p className="mt-3 text-sm text-slate-600">暂无趋势数据。</p>}
        </article>

        <article className="rounded-2xl border border-teal-900/10 bg-white/80 p-4" data-testid="backtest-chart-stock">
          <p className="text-xs uppercase tracking-[0.16em] text-teal-900/80">单股对比趋势</p>
          <p className="mt-1 text-xs text-slate-500">当前聚焦：{focusCode || '暂无'}</p>
          {stockTrend.length > 1 ? <AreaTrendChart data={stockTrend} className="mt-3 w-full" /> : <p className="mt-3 text-sm text-slate-600">暂无单股趋势数据。</p>}
          {stockPerfQuery.data ? (
            <div className="mt-3 rounded-lg border border-teal-900/10 bg-white p-3 text-xs text-slate-700">
              方向准确率 {pct(stockPerfQuery.data.directionAccuracyPct)} · 胜率 {pct(stockPerfQuery.data.winRatePct)} · 样本 {stockPerfQuery.data.completedCount}
            </div>
          ) : null}
        </article>
      </section>

      <section className="rounded-2xl border border-teal-900/10 bg-white/80 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.16em] text-teal-900/80">回测结果</p>
          <p className="text-xs text-slate-500">
            共 {totalItems} 条 · 第 {currentPage} / {totalPages} 页
          </p>
        </div>

        {resultsQuery.isFetching ? <p className="text-sm text-slate-600">正在加载结果...</p> : null}
        {resultsQuery.error ? <p className="text-sm text-rose-700">{getParsedApiError(resultsQuery.error).message}</p> : null}
        {!resultsQuery.isFetching && !resultsQuery.error && resultItems.length === 0 ? <p className="text-sm text-slate-600">暂无回测结果。</p> : null}

        {resultItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[920px] text-sm" data-testid="backtest-results-table">
              <thead className="border-b border-teal-900/10 text-xs text-slate-500">
                <tr>
                  <th className="py-2 text-left">代码</th>
                  <th className="py-2 text-left">日期</th>
                  <th className="py-2 text-left">建议</th>
                  <th className="py-2 text-left">结果</th>
                  <th className="py-2 text-right">收益率</th>
                  <th className="py-2 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                {resultItems.map((row) => (
                  <tr key={row.analysisHistoryId} className="border-b border-teal-900/5">
                    <td className="py-2 font-mono text-slate-900">{row.code}</td>
                    <td className="py-2 text-slate-700">{row.analysisDate || '--'}</td>
                    <td className="max-w-[360px] truncate py-2 text-slate-700" title={row.operationAdvice || ''}>
                      {row.operationAdvice || '--'}
                    </td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${outcomeClass(row.outcome)}`}>{row.outcome || '--'}</span>
                    </td>
                    <td className={`py-2 text-right font-mono ${(row.simulatedReturnPct || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {pct(row.simulatedReturnPct)}
                    </td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(row.evalStatus)}`}>{row.evalStatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            className="rounded-md border border-teal-900/15 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
            disabled={currentPage <= 1}
            data-testid="backtest-page-prev"
          >
            上一页
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            className="rounded-md border border-teal-900/15 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
            disabled={currentPage >= totalPages}
            data-testid="backtest-page-next"
          >
            下一页
          </button>
        </div>
      </section>
    </section>
  )
}
