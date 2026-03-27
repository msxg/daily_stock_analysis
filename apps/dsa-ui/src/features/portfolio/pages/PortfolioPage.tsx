import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getParsedApiError, portfolioApi } from '@/shared/api'
import type {
  PortfolioCashDirection,
  PortfolioCorporateActionType,
  PortfolioCostMethod,
  PortfolioSide,
  PortfolioTradeListItem,
  PortfolioCashLedgerListItem,
  PortfolioCorporateActionListItem,
} from '@/shared/types/portfolio'

type InlineFeedback = { kind: 'success' | 'error'; message: string } | null
type WorkspaceTab = 'overview' | 'holdings' | 'entry' | 'import' | 'events'
type AccountOption = 'all' | number
type EventType = 'trade' | 'cash' | 'corporate'

const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'overview', label: '总览' },
  { id: 'holdings', label: '持仓明细' },
  { id: 'entry', label: '手工录入' },
  { id: 'import', label: 'CSV 导入' },
  { id: 'events', label: '流水与修正' },
]

const DEFAULT_EVENT_PAGE_SIZE = 20
const EMPTY_ACCOUNTS: never[] = []
const EMPTY_BROKERS: never[] = []

function formatMoney(value: number | undefined, currency = 'CNY'): string {
  if (value == null || Number.isNaN(value)) return '--'
  return `${currency} ${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPct(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return '--'
  return `${value.toFixed(2)}%`
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview')
  const [selectedAccount, setSelectedAccount] = useState<AccountOption>('all')
  const [costMethod, setCostMethod] = useState<PortfolioCostMethod>('fifo')
  const [actionFeedback, setActionFeedback] = useState<InlineFeedback>(null)

  const [createAccountForm, setCreateAccountForm] = useState({
    name: '',
    broker: 'Demo',
    market: 'cn' as 'cn' | 'hk' | 'us',
    baseCurrency: 'CNY',
  })

  const [tradeForm, setTradeForm] = useState({
    symbol: '',
    tradeDate: todayIsoDate(),
    side: 'buy' as PortfolioSide,
    quantity: '',
    price: '',
    fee: '',
    tax: '',
    note: '',
  })
  const [cashForm, setCashForm] = useState({
    eventDate: todayIsoDate(),
    direction: 'in' as PortfolioCashDirection,
    amount: '',
    currency: '',
    note: '',
  })
  const [corpForm, setCorpForm] = useState({
    symbol: '',
    effectiveDate: todayIsoDate(),
    actionType: 'cash_dividend' as PortfolioCorporateActionType,
    cashDividendPerShare: '',
    splitRatio: '',
    note: '',
  })

  const [selectedBroker, setSelectedBroker] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvDryRun, setCsvDryRun] = useState(true)
  const [csvParseSummary, setCsvParseSummary] = useState<string | null>(null)
  const [csvCommitSummary, setCsvCommitSummary] = useState<string | null>(null)

  const [eventType, setEventType] = useState<EventType>('trade')
  const [eventPage, setEventPage] = useState(1)
  const [eventDateFrom, setEventDateFrom] = useState('')
  const [eventDateTo, setEventDateTo] = useState('')
  const [eventSymbol, setEventSymbol] = useState('')
  const [eventSide, setEventSide] = useState<'' | PortfolioSide>('')
  const [eventDirection, setEventDirection] = useState<'' | PortfolioCashDirection>('')
  const [eventActionType, setEventActionType] = useState<'' | PortfolioCorporateActionType>('')

  const accountsQuery = useQuery({
    queryKey: ['portfolio-accounts'],
    queryFn: () => portfolioApi.getAccounts(false),
  })

  const accounts = accountsQuery.data?.accounts ?? EMPTY_ACCOUNTS
  const effectiveSelectedAccount: AccountOption =
    selectedAccount === 'all' || accounts.some((item) => item.id === selectedAccount) ? selectedAccount : 'all'
  const queryAccountId = effectiveSelectedAccount === 'all' ? undefined : effectiveSelectedAccount
  const writeBlocked = effectiveSelectedAccount === 'all'
  const selectedAccountItem =
    effectiveSelectedAccount === 'all' ? null : accounts.find((item) => item.id === effectiveSelectedAccount) || null

  const snapshotQuery = useQuery({
    queryKey: ['portfolio-snapshot', queryAccountId, costMethod],
    queryFn: () =>
      portfolioApi.getSnapshot({
        accountId: queryAccountId,
        costMethod,
      }),
  })

  const riskQuery = useQuery({
    queryKey: ['portfolio-risk', queryAccountId, costMethod],
    queryFn: () =>
      portfolioApi.getRisk({
        accountId: queryAccountId,
        costMethod,
      }),
  })

  const brokersQuery = useQuery({
    queryKey: ['portfolio-import-brokers'],
    queryFn: () => portfolioApi.listImportBrokers(),
  })

  const brokers = brokersQuery.data?.brokers ?? EMPTY_BROKERS
  const effectiveSelectedBroker =
    selectedBroker && brokers.some((item) => item.broker === selectedBroker) ? selectedBroker : brokers[0]?.broker || ''

  const eventsQuery = useQuery({
    queryKey: [
      'portfolio-events',
      eventType,
      queryAccountId,
      eventPage,
      eventDateFrom,
      eventDateTo,
      eventSymbol,
      eventSide,
      eventDirection,
      eventActionType,
    ],
    queryFn: async () => {
      if (eventType === 'trade') {
        return portfolioApi.listTrades({
          accountId: queryAccountId,
          dateFrom: eventDateFrom || undefined,
          dateTo: eventDateTo || undefined,
          symbol: eventSymbol || undefined,
          side: eventSide || undefined,
          page: eventPage,
          pageSize: DEFAULT_EVENT_PAGE_SIZE,
        })
      }

      if (eventType === 'cash') {
        return portfolioApi.listCashLedger({
          accountId: queryAccountId,
          dateFrom: eventDateFrom || undefined,
          dateTo: eventDateTo || undefined,
          direction: eventDirection || undefined,
          page: eventPage,
          pageSize: DEFAULT_EVENT_PAGE_SIZE,
        })
      }

      return portfolioApi.listCorporateActions({
        accountId: queryAccountId,
        dateFrom: eventDateFrom || undefined,
        dateTo: eventDateTo || undefined,
        symbol: eventSymbol || undefined,
        actionType: eventActionType || undefined,
        page: eventPage,
        pageSize: DEFAULT_EVENT_PAGE_SIZE,
      })
    },
  })

  const createAccountMutation = useMutation({
    mutationFn: portfolioApi.createAccount,
  })
  const refreshFxMutation = useMutation({
    mutationFn: () => portfolioApi.refreshFx({ accountId: queryAccountId }),
  })
  const createTradeMutation = useMutation({
    mutationFn: portfolioApi.createTrade,
  })
  const createCashMutation = useMutation({
    mutationFn: portfolioApi.createCashLedger,
  })
  const createCorpMutation = useMutation({
    mutationFn: portfolioApi.createCorporateAction,
  })
  const parseCsvMutation = useMutation({
    mutationFn: ({ broker, file }: { broker: string; file: File }) => portfolioApi.parseCsvImport(broker, file),
  })
  const commitCsvMutation = useMutation({
    mutationFn: ({ accountId, broker, file, dryRun }: { accountId: number; broker: string; file: File; dryRun: boolean }) =>
      portfolioApi.commitCsvImport(accountId, broker, file, dryRun),
  })
  const deleteEventMutation = useMutation({
    mutationFn: async (payload: { eventType: EventType; id: number }) => {
      if (payload.eventType === 'trade') return portfolioApi.deleteTrade(payload.id)
      if (payload.eventType === 'cash') return portfolioApi.deleteCashLedger(payload.id)
      return portfolioApi.deleteCorporateAction(payload.id)
    },
  })

  const positions = useMemo(() => {
    const snapshot = snapshotQuery.data
    if (!snapshot) return []
    return snapshot.accounts.flatMap((account) =>
      account.positions.map((position) => ({
        ...position,
        accountId: account.accountId,
        accountName: account.accountName,
      })),
    )
  }, [snapshotQuery.data])

  const topExposureRows = (riskQuery.data?.concentration.topPositions || []).slice(0, 6)
  const eventTotal = eventsQuery.data?.total || 0
  const eventPages = Math.max(1, Math.ceil(eventTotal / DEFAULT_EVENT_PAGE_SIZE))

  const refreshAll = async () => {
    await Promise.all([accountsQuery.refetch(), snapshotQuery.refetch(), riskQuery.refetch(), eventsQuery.refetch()])
  }

  const handleCreateAccount = async () => {
    const name = createAccountForm.name.trim()
    if (!name) {
      setActionFeedback({ kind: 'error', message: '账户名称不能为空。' })
      return
    }

    setActionFeedback(null)
    try {
      const created = await createAccountMutation.mutateAsync({
        name,
        broker: createAccountForm.broker.trim() || undefined,
        market: createAccountForm.market,
        baseCurrency: createAccountForm.baseCurrency.trim() || 'CNY',
      })
      await accountsQuery.refetch()
      setSelectedAccount(created.id)
      setCreateAccountForm((previous) => ({ ...previous, name: '' }))
      setActionFeedback({ kind: 'success', message: '账户创建成功，已自动切换。' })
    } catch (error) {
      setActionFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleRefreshFx = async () => {
    setActionFeedback(null)
    try {
      const result = await refreshFxMutation.mutateAsync()
      await Promise.all([snapshotQuery.refetch(), riskQuery.refetch()])
      setActionFeedback({
        kind: 'success',
        message: `汇率刷新完成：更新 ${result.updatedCount} 对，过期 ${result.staleCount} 对。`,
      })
    } catch (error) {
      setActionFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleCreateTrade = async () => {
    if (!selectedAccountItem) {
      setActionFeedback({ kind: 'error', message: '请先选择具体账户再录入交易。' })
      return
    }
    if (!tradeForm.symbol.trim() || !tradeForm.quantity || !tradeForm.price) {
      setActionFeedback({ kind: 'error', message: '交易录入缺少必填字段。' })
      return
    }

    setActionFeedback(null)
    try {
      await createTradeMutation.mutateAsync({
        accountId: selectedAccountItem.id,
        symbol: tradeForm.symbol.trim().toUpperCase(),
        tradeDate: tradeForm.tradeDate,
        side: tradeForm.side,
        quantity: Number(tradeForm.quantity),
        price: Number(tradeForm.price),
        fee: Number(tradeForm.fee || 0),
        tax: Number(tradeForm.tax || 0),
        note: tradeForm.note.trim() || undefined,
      })
      setTradeForm((previous) => ({
        ...previous,
        symbol: '',
        quantity: '',
        price: '',
        fee: '',
        tax: '',
        note: '',
      }))
      setActionFeedback({ kind: 'success', message: '交易流水录入成功。' })
      await Promise.all([snapshotQuery.refetch(), riskQuery.refetch(), eventsQuery.refetch()])
    } catch (error) {
      setActionFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleCreateCash = async () => {
    if (!selectedAccountItem) {
      setActionFeedback({ kind: 'error', message: '请先选择具体账户再录入资金流水。' })
      return
    }
    if (!cashForm.amount) {
      setActionFeedback({ kind: 'error', message: '资金流水金额不能为空。' })
      return
    }

    setActionFeedback(null)
    try {
      await createCashMutation.mutateAsync({
        accountId: selectedAccountItem.id,
        eventDate: cashForm.eventDate,
        direction: cashForm.direction,
        amount: Number(cashForm.amount),
        currency: cashForm.currency.trim() || undefined,
        note: cashForm.note.trim() || undefined,
      })
      setCashForm((previous) => ({ ...previous, amount: '', note: '' }))
      setActionFeedback({ kind: 'success', message: '资金流水录入成功。' })
      await Promise.all([snapshotQuery.refetch(), riskQuery.refetch(), eventsQuery.refetch()])
    } catch (error) {
      setActionFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleCreateCorporate = async () => {
    if (!selectedAccountItem) {
      setActionFeedback({ kind: 'error', message: '请先选择具体账户再录入公司行为。' })
      return
    }
    if (!corpForm.symbol.trim()) {
      setActionFeedback({ kind: 'error', message: '公司行为录入缺少股票代码。' })
      return
    }

    setActionFeedback(null)
    try {
      await createCorpMutation.mutateAsync({
        accountId: selectedAccountItem.id,
        symbol: corpForm.symbol.trim().toUpperCase(),
        effectiveDate: corpForm.effectiveDate,
        actionType: corpForm.actionType,
        cashDividendPerShare: corpForm.cashDividendPerShare ? Number(corpForm.cashDividendPerShare) : undefined,
        splitRatio: corpForm.splitRatio ? Number(corpForm.splitRatio) : undefined,
        note: corpForm.note.trim() || undefined,
      })
      setCorpForm((previous) => ({ ...previous, symbol: '', note: '', cashDividendPerShare: '', splitRatio: '' }))
      setActionFeedback({ kind: 'success', message: '公司行为录入成功。' })
      await Promise.all([snapshotQuery.refetch(), riskQuery.refetch(), eventsQuery.refetch()])
    } catch (error) {
      setActionFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleParseCsv = async () => {
    if (!csvFile || !effectiveSelectedBroker) {
      setActionFeedback({ kind: 'error', message: '请先选择券商和 CSV 文件。' })
      return
    }

    setActionFeedback(null)
    setCsvCommitSummary(null)
    try {
      const result = await parseCsvMutation.mutateAsync({ broker: effectiveSelectedBroker, file: csvFile })
      setCsvParseSummary(`解析完成：有效 ${result.recordCount} 条，跳过 ${result.skippedCount} 条，错误 ${result.errorCount} 条。`)
      setActionFeedback({ kind: 'success', message: 'CSV 解析完成。' })
    } catch (error) {
      setActionFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleCommitCsv = async () => {
    if (!csvFile || !effectiveSelectedBroker) {
      setActionFeedback({ kind: 'error', message: '请先选择券商和 CSV 文件。' })
      return
    }
    if (!selectedAccountItem) {
      setActionFeedback({ kind: 'error', message: '请先选择具体账户再提交导入。' })
      return
    }

    setActionFeedback(null)
    try {
      const result = await commitCsvMutation.mutateAsync({
        accountId: selectedAccountItem.id,
        broker: effectiveSelectedBroker,
        file: csvFile,
        dryRun: csvDryRun,
      })
      setCsvCommitSummary(`提交结果：写入 ${result.insertedCount} 条，重复 ${result.duplicateCount} 条，失败 ${result.failedCount} 条。`)
      setActionFeedback({ kind: 'success', message: csvDryRun ? 'CSV 预演完成。' : 'CSV 提交完成。' })
      if (!csvDryRun) {
        await Promise.all([snapshotQuery.refetch(), riskQuery.refetch(), eventsQuery.refetch()])
      }
    } catch (error) {
      setActionFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const handleDeleteEvent = async (targetEventType: EventType, eventId: number) => {
    if (writeBlocked) {
      setActionFeedback({ kind: 'error', message: '全部账户视图禁写，请切换具体账户后再删除流水。' })
      return
    }
    if (!window.confirm('确认删除这条流水吗？')) return

    setActionFeedback(null)
    try {
      await deleteEventMutation.mutateAsync({ eventType: targetEventType, id: eventId })
      setActionFeedback({ kind: 'success', message: '流水删除成功。' })
      await Promise.all([snapshotQuery.refetch(), riskQuery.refetch(), eventsQuery.refetch()])
    } catch (error) {
      setActionFeedback({ kind: 'error', message: getParsedApiError(error).message })
    }
  }

  const renderEventRow = (item: PortfolioTradeListItem | PortfolioCashLedgerListItem | PortfolioCorporateActionListItem) => {
    if (eventType === 'trade') {
      const trade = item as PortfolioTradeListItem
      return (
        <div key={`trade-${trade.id}`} className="flex items-center justify-between gap-2 rounded-lg border dsa-theme-border-subtle bg-white px-3 py-2 text-xs">
          <p className="text-slate-700">
            {trade.tradeDate} · {trade.side === 'buy' ? '买入' : '卖出'} · {trade.symbol} · {trade.quantity} @ {trade.price}
          </p>
          <button
            type="button"
            onClick={() => void handleDeleteEvent('trade', trade.id)}
            className="rounded-md border border-rose-300/80 dsa-theme-bg-soft px-2 py-1 font-semibold text-rose-700 disabled:opacity-60"
            disabled={deleteEventMutation.isPending || writeBlocked}
            data-testid={`portfolio-delete-trade-${trade.id}`}
          >
            删除
          </button>
        </div>
      )
    }

    if (eventType === 'cash') {
      const cash = item as PortfolioCashLedgerListItem
      return (
        <div key={`cash-${cash.id}`} className="flex items-center justify-between gap-2 rounded-lg border dsa-theme-border-subtle bg-white px-3 py-2 text-xs">
          <p className="text-slate-700">
            {cash.eventDate} · {cash.direction === 'in' ? '流入' : '流出'} · {cash.amount} {cash.currency}
          </p>
          <button
            type="button"
            onClick={() => void handleDeleteEvent('cash', cash.id)}
            className="rounded-md border border-rose-300/80 dsa-theme-bg-soft px-2 py-1 font-semibold text-rose-700 disabled:opacity-60"
            disabled={deleteEventMutation.isPending || writeBlocked}
            data-testid={`portfolio-delete-cash-${cash.id}`}
          >
            删除
          </button>
        </div>
      )
    }

    const corporate = item as PortfolioCorporateActionListItem
    return (
      <div key={`corporate-${corporate.id}`} className="flex items-center justify-between gap-2 rounded-lg border dsa-theme-border-subtle bg-white px-3 py-2 text-xs">
        <p className="text-slate-700">
          {corporate.effectiveDate} · {corporate.symbol} · {corporate.actionType === 'cash_dividend' ? '现金分红' : '拆并股调整'}
        </p>
        <button
          type="button"
          onClick={() => void handleDeleteEvent('corporate', corporate.id)}
          className="rounded-md border border-rose-300/80 dsa-theme-bg-soft px-2 py-1 font-semibold text-rose-700 disabled:opacity-60"
          disabled={deleteEventMutation.isPending || writeBlocked}
          data-testid={`portfolio-delete-corporate-${corporate.id}`}
        >
          删除
        </button>
      </div>
    )
  }

  return (
    <section className="space-y-3" data-testid="page-portfolio">
      <header className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-4">
        <h2 hidden data-testid="page-title-portfolio">
          持仓
        </h2>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:dsa-theme-bg-soft disabled:opacity-60"
            disabled={
              accountsQuery.isFetching || snapshotQuery.isFetching || riskQuery.isFetching || eventsQuery.isFetching
            }
            data-testid="portfolio-refresh"
          >
            刷新全部
          </button>
        </div>

        <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            账户视图
            <select
              value={String(effectiveSelectedAccount)}
              onChange={(event) => {
                setSelectedAccount(event.target.value === 'all' ? 'all' : Number(event.target.value))
                setEventPage(1)
              }}
              className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-800"
              data-testid="portfolio-account-select"
            >
              <option value="all">全部账户</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} (#{account.id})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600">
            成本法
            <select
              value={costMethod}
              onChange={(event) => setCostMethod(event.target.value as PortfolioCostMethod)}
              className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-800"
              data-testid="portfolio-cost-method"
            >
              <option value="fifo">先进先出（FIFO）</option>
              <option value="avg">均价成本（AVG）</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => void handleRefreshFx()}
            className="self-end rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-2 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
            disabled={refreshFxMutation.isPending || snapshotQuery.isFetching}
            data-testid="portfolio-fx-refresh"
          >
            {refreshFxMutation.isPending ? '刷新中...' : '刷新汇率'}
          </button>

          <div className="self-end rounded-lg border dsa-theme-border-subtle dsa-theme-bg-soft-70 px-3 py-2 text-xs text-slate-700">
            写入范围：
            {effectiveSelectedAccount === 'all' ? '全部账户（禁写）' : `账户 #${effectiveSelectedAccount}`}
          </div>
        </div>

        {writeBlocked ? (
          <p
            className="mt-3 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
            data-testid="portfolio-write-protection"
          >
            当前处于全部账户视图，所有写操作（录入/导入/删除）已自动禁用。请切换具体账户后再操作。
          </p>
        ) : null}

        {actionFeedback ? (
          <p className={`mt-3 text-sm font-medium ${actionFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {actionFeedback.message}
          </p>
        ) : null}
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="持仓工作区标签">
        {workspaceTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === tab.id
                ? 'dsa-theme-border-accent dsa-theme-bg-accent dsa-theme-text-accent dsa-theme-shadow-active'
                : 'dsa-theme-border-subtle bg-white text-slate-600 hover:dsa-theme-bg-soft'
            }`}
            data-testid={`portfolio-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <section className="grid gap-3 xl:grid-cols-[minmax(0,1.75fr)_minmax(270px,1fr)]">
          <div className="space-y-3">
            <article className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">账户总览</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border dsa-theme-border-subtle bg-white p-3">
                  <p className="text-xs text-slate-500">总权益</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(snapshotQuery.data?.totalEquity, snapshotQuery.data?.currency || 'CNY')}</p>
                </div>
                <div className="rounded-xl border dsa-theme-border-subtle bg-white p-3">
                  <p className="text-xs text-slate-500">总市值</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(snapshotQuery.data?.totalMarketValue, snapshotQuery.data?.currency || 'CNY')}</p>
                </div>
                <div className="rounded-xl border dsa-theme-border-subtle bg-white p-3">
                  <p className="text-xs text-slate-500">总现金</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(snapshotQuery.data?.totalCash, snapshotQuery.data?.currency || 'CNY')}</p>
                </div>
                <div className="rounded-xl border dsa-theme-border-subtle bg-white p-3">
                  <p className="text-xs text-slate-500">汇率状态</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{snapshotQuery.data?.fxStale ? '存在过期汇率' : '汇率最新'}</p>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">风险提示</p>
                <p className="text-xs text-slate-500">成本法：{costMethod.toUpperCase()}</p>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border dsa-theme-border-subtle bg-white p-3">
                  <p className="text-xs text-slate-500">最大回撤</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(riskQuery.data?.drawdown.maxDrawdownPct)}</p>
                </div>
                <div className="rounded-xl border dsa-theme-border-subtle bg-white p-3">
                  <p className="text-xs text-slate-500">当前回撤</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(riskQuery.data?.drawdown.currentDrawdownPct)}</p>
                </div>
                <div className="rounded-xl border dsa-theme-border-subtle bg-white p-3">
                  <p className="text-xs text-slate-500">止损触发数</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{riskQuery.data?.stopLoss.triggeredCount ?? 0}</p>
                </div>
              </div>
            </article>
          </div>

          <article className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">集中度 Top</p>
            <div className="mt-3 space-y-3">
              {topExposureRows.length === 0 ? <p className="text-sm text-slate-600">暂无集中度数据。</p> : null}
              {topExposureRows.map((row) => (
                <div key={row.symbol}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-700">{row.symbol}</span>
                    <span className="font-semibold dsa-theme-text-accent">{row.weightPct.toFixed(2)}%</span>
                  </div>
                  <div className="h-2 rounded-full dsa-theme-bg-soft">
                    <div className="h-2 rounded-full dsa-theme-gradient-inline" style={{ width: `${Math.min(row.weightPct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border dsa-theme-border-subtle bg-white p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">新建账户</p>
              <div className="mt-2 grid gap-2">
                <input
                  value={createAccountForm.name}
                  onChange={(event) => setCreateAccountForm((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder="账户名称（必填）"
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-800"
                  data-testid="portfolio-create-account-name"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={createAccountForm.broker}
                    onChange={(event) => setCreateAccountForm((previous) => ({ ...previous, broker: event.target.value }))}
                    placeholder="券商"
                    className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-800"
                  />
                  <input
                    value={createAccountForm.baseCurrency}
                    onChange={(event) => setCreateAccountForm((previous) => ({ ...previous, baseCurrency: event.target.value.toUpperCase() }))}
                    placeholder="基准币种"
                    className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={createAccountForm.market}
                    onChange={(event) =>
                      setCreateAccountForm((previous) => ({ ...previous, market: event.target.value as 'cn' | 'hk' | 'us' }))
                    }
                    className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="cn">A 股</option>
                    <option value="hk">港股</option>
                    <option value="us">美股</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleCreateAccount()}
                    className="rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-2 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
                    disabled={createAccountMutation.isPending}
                    data-testid="portfolio-create-account-submit"
                  >
                    {createAccountMutation.isPending ? '创建中...' : '创建账户'}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'holdings' ? (
        <section className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">持仓明细</p>
            <span className="text-xs text-slate-500">共 {positions.length} 条</span>
          </div>
          {positions.length === 0 ? <p className="text-sm text-slate-600">当前无持仓数据。</p> : null}
          {positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm" data-testid="portfolio-holdings-table">
                <thead className="border-b dsa-theme-border-subtle text-xs text-slate-500">
                  <tr>
                    <th className="py-2 text-left">账户</th>
                    <th className="py-2 text-left">代码</th>
                    <th className="py-2 text-right">数量</th>
                    <th className="py-2 text-right">均价</th>
                    <th className="py-2 text-right">现价</th>
                    <th className="py-2 text-right">市值</th>
                    <th className="py-2 text-right">未实现盈亏</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <tr key={`${position.accountId}-${position.symbol}-${position.market}`} className="border-b dsa-theme-border-subtle">
                      <td className="py-2 text-slate-700">{position.accountName}</td>
                      <td className="py-2 font-mono text-slate-900">{position.symbol}</td>
                      <td className="py-2 text-right">{position.quantity.toFixed(2)}</td>
                      <td className="py-2 text-right">{position.avgCost.toFixed(4)}</td>
                      <td className="py-2 text-right">{position.lastPrice.toFixed(4)}</td>
                      <td className="py-2 text-right">{formatMoney(position.marketValueBase, position.valuationCurrency)}</td>
                      <td className={`py-2 text-right ${position.unrealizedPnlBase >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatMoney(position.unrealizedPnlBase, position.valuationCurrency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'entry' ? (
        <section className="grid gap-3 xl:grid-cols-3">
          <article className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-3">
            <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">交易录入</p>
            <div className="mt-3 space-y-2">
              <input
                value={tradeForm.symbol}
                onChange={(event) => setTradeForm((previous) => ({ ...previous, symbol: event.target.value }))}
                placeholder="股票代码"
                className="w-full rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={tradeForm.tradeDate}
                  onChange={(event) => setTradeForm((previous) => ({ ...previous, tradeDate: event.target.value }))}
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                />
                <select
                  value={tradeForm.side}
                  onChange={(event) => setTradeForm((previous) => ({ ...previous, side: event.target.value as PortfolioSide }))}
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                >
                  <option value="buy">买入</option>
                  <option value="sell">卖出</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={tradeForm.quantity}
                  onChange={(event) => setTradeForm((previous) => ({ ...previous, quantity: event.target.value }))}
                  placeholder="数量"
                  type="number"
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                />
                <input
                  value={tradeForm.price}
                  onChange={(event) => setTradeForm((previous) => ({ ...previous, price: event.target.value }))}
                  placeholder="价格"
                  type="number"
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCreateTrade()}
                className="w-full rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-2 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
                disabled={writeBlocked || createTradeMutation.isPending}
                data-testid="portfolio-entry-submit-trade"
              >
                {createTradeMutation.isPending ? '提交中...' : '提交交易'}
              </button>
            </div>
          </article>

          <article className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-3">
            <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">资金流水录入</p>
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={cashForm.eventDate}
                  onChange={(event) => setCashForm((previous) => ({ ...previous, eventDate: event.target.value }))}
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                />
                <select
                  value={cashForm.direction}
                  onChange={(event) => setCashForm((previous) => ({ ...previous, direction: event.target.value as PortfolioCashDirection }))}
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                >
                  <option value="in">流入</option>
                  <option value="out">流出</option>
                </select>
              </div>
              <input
                value={cashForm.amount}
                onChange={(event) => setCashForm((previous) => ({ ...previous, amount: event.target.value }))}
                placeholder="金额"
                type="number"
                className="w-full rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleCreateCash()}
                className="w-full rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-2 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
                disabled={writeBlocked || createCashMutation.isPending}
                data-testid="portfolio-entry-submit-cash"
              >
                {createCashMutation.isPending ? '提交中...' : '提交资金流水'}
              </button>
            </div>
          </article>

          <article className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-3">
            <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">公司行为录入</p>
            <div className="mt-3 space-y-2">
              <input
                value={corpForm.symbol}
                onChange={(event) => setCorpForm((previous) => ({ ...previous, symbol: event.target.value }))}
                placeholder="股票代码"
                className="w-full rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={corpForm.effectiveDate}
                  onChange={(event) => setCorpForm((previous) => ({ ...previous, effectiveDate: event.target.value }))}
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                />
                <select
                  value={corpForm.actionType}
                  onChange={(event) =>
                    setCorpForm((previous) => ({ ...previous, actionType: event.target.value as PortfolioCorporateActionType }))
                  }
                  className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                >
                  <option value="cash_dividend">现金分红</option>
                  <option value="split_adjustment">拆并股调整</option>
                </select>
              </div>
              {corpForm.actionType === 'cash_dividend' ? (
                <input
                  value={corpForm.cashDividendPerShare}
                  onChange={(event) => setCorpForm((previous) => ({ ...previous, cashDividendPerShare: event.target.value, splitRatio: '' }))}
                  placeholder="每股分红"
                  type="number"
                  className="w-full rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                />
              ) : (
                <input
                  value={corpForm.splitRatio}
                  onChange={(event) => setCorpForm((previous) => ({ ...previous, splitRatio: event.target.value, cashDividendPerShare: '' }))}
                  placeholder="拆并股比例"
                  type="number"
                  className="w-full rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
                />
              )}
              <button
                type="button"
                onClick={() => void handleCreateCorporate()}
                className="w-full rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-2 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
                disabled={writeBlocked || createCorpMutation.isPending}
                data-testid="portfolio-entry-submit-corporate"
              >
                {createCorpMutation.isPending ? '提交中...' : '提交公司行为'}
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'import' ? (
        <section className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] dsa-theme-text-accent-muted">CSV 导入</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <select
              value={effectiveSelectedBroker}
              onChange={(event) => setSelectedBroker(event.target.value)}
              className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
              data-testid="portfolio-import-broker"
            >
              {(brokersQuery.data?.brokers || []).map((item) => (
                <option key={item.broker} value={item.broker}>
                  {item.displayName ? `${item.broker}（${item.displayName}）` : item.broker}
                </option>
              ))}
            </select>

            <label className="rounded-lg border border-dashed dsa-theme-border-strong bg-white px-3 py-2 text-sm text-slate-600">
              选择文件：{csvFile?.name || '未选择'}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
                data-testid="portfolio-import-file"
              />
            </label>

            <label className="inline-flex items-center gap-2 rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-xs text-slate-700">
              <input type="checkbox" checked={csvDryRun} onChange={(event) => setCsvDryRun(event.target.checked)} />
              仅预演
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleParseCsv()}
              className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:dsa-theme-bg-soft disabled:opacity-60"
              disabled={!csvFile || parseCsvMutation.isPending}
              data-testid="portfolio-import-parse"
            >
              {parseCsvMutation.isPending ? '解析中...' : '解析文件'}
            </button>
            <button
              type="button"
              onClick={() => void handleCommitCsv()}
              className="rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-2 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:opacity-60"
              disabled={!csvFile || writeBlocked || commitCsvMutation.isPending}
              data-testid="portfolio-import-commit"
            >
              {commitCsvMutation.isPending ? '提交中...' : '提交导入'}
            </button>
          </div>

          {csvParseSummary ? <p className="mt-3 rounded-lg border dsa-theme-border-subtle bg-white px-3 py-2 text-sm text-slate-700">{csvParseSummary}</p> : null}
          {csvCommitSummary ? (
            <p className="mt-2 rounded-lg border dsa-theme-border-subtle bg-white px-3 py-2 text-sm text-slate-700">{csvCommitSummary}</p>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'events' ? (
        <section className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-4">
          <div className="grid gap-3 xl:grid-cols-[180px_repeat(5,minmax(0,1fr))]">
            <select
              value={eventType}
              onChange={(event) => {
                setEventType(event.target.value as EventType)
                setEventPage(1)
              }}
              className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
              data-testid="portfolio-events-type"
            >
              <option value="trade">交易流水</option>
              <option value="cash">资金流水</option>
              <option value="corporate">公司行为</option>
            </select>

            <input
              type="date"
              value={eventDateFrom}
              onChange={(event) => {
                setEventDateFrom(event.target.value)
                setEventPage(1)
              }}
              className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={eventDateTo}
              onChange={(event) => {
                setEventDateTo(event.target.value)
                setEventPage(1)
              }}
              className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
            />
            {(eventType === 'trade' || eventType === 'corporate') ? (
              <input
                value={eventSymbol}
                onChange={(event) => {
                  setEventSymbol(event.target.value)
                  setEventPage(1)
                }}
                placeholder="代码筛选"
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
              />
            ) : (
              <div />
            )}
            {eventType === 'trade' ? (
              <select
                value={eventSide}
                onChange={(event) => {
                  setEventSide(event.target.value as '' | PortfolioSide)
                  setEventPage(1)
                }}
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
              >
                <option value="">全部方向</option>
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
              </select>
            ) : eventType === 'cash' ? (
              <select
                value={eventDirection}
                onChange={(event) => {
                  setEventDirection(event.target.value as '' | PortfolioCashDirection)
                  setEventPage(1)
                }}
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
              >
                <option value="">全部方向</option>
                <option value="in">流入</option>
                <option value="out">流出</option>
              </select>
            ) : (
              <select
                value={eventActionType}
                onChange={(event) => {
                  setEventActionType(event.target.value as '' | PortfolioCorporateActionType)
                  setEventPage(1)
                }}
                className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm"
              >
                <option value="">全部行为</option>
                <option value="cash_dividend">现金分红</option>
                <option value="split_adjustment">拆并股调整</option>
              </select>
            )}

            <button
              type="button"
              onClick={() => void eventsQuery.refetch()}
              className="rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:dsa-theme-bg-soft disabled:opacity-60"
              disabled={eventsQuery.isFetching}
              data-testid="portfolio-events-refresh"
            >
              {eventsQuery.isFetching ? '加载中...' : '刷新流水'}
            </button>
          </div>

          <div className="mt-3 space-y-2" data-testid="portfolio-events-list">
            {eventsQuery.isFetching ? <p className="text-sm text-slate-600">正在加载流水...</p> : null}
            {!eventsQuery.isFetching && (eventsQuery.data?.items.length ?? 0) === 0 ? <p className="text-sm text-slate-600">暂无流水记录。</p> : null}
            {(eventsQuery.data?.items || []).map((item) => renderEventRow(item))}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
            <span>
              第 {eventPage} / {eventPages} 页 · 共 {eventTotal} 条
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEventPage((page) => Math.max(1, page - 1))}
                className="rounded-md border dsa-theme-border-default bg-white px-2 py-1 font-semibold text-slate-700 disabled:opacity-60"
                disabled={eventPage <= 1}
                data-testid="portfolio-events-prev"
              >
                上一页
              </button>
              <button
                type="button"
                onClick={() => setEventPage((page) => Math.min(eventPages, page + 1))}
                className="rounded-md border dsa-theme-border-default bg-white px-2 py-1 font-semibold text-slate-700 disabled:opacity-60"
                disabled={eventPage >= eventPages}
                data-testid="portfolio-events-next"
              >
                下一页
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  )
}
