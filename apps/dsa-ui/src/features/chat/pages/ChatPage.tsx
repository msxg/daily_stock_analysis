import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSearchParams } from 'react-router-dom'
import { agentApi, getParsedApiError } from '@/shared/api'
import type { ChatRequestPayload, ChatStreamEvent } from '@/shared/types/chat'
import { historyApi } from '@/shared/api/history'
import { formatDateTime } from '@/shared/utils/date'
import {
  CHAT_SESSION_STORAGE_KEY,
  createLocalSessionId,
  getInitialSessionIdFromStorage,
  mergeSessionsWithDraft,
  normalizeSessionTitle,
  truncateSessionTitle,
} from '@/features/chat/utils/session'
import { downloadChatSessionMarkdown, formatChatSessionAsMarkdown } from '@/features/chat/utils/export'
import { formatSkillDisplayName, pickQuickSkills, resolveDefaultSkillId } from '@/features/chat/utils/skill'
import {
  buildChatFollowUpContext,
  buildFollowUpPrompt,
  parseFollowUpRecordId,
  sanitizeFollowUpStockCode,
  sanitizeFollowUpStockName,
} from '@/features/chat/utils/followUp'
import { splitThinkingContent } from '@/features/chat/utils/message'
import { formatStreamEventLabel } from '@/features/chat/utils/stream'

type InlineFeedback = { kind: 'success' | 'error'; message: string } | null
type MobilePane = 'sessions' | 'messages'

function MessageMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        code: ({ children }) => (
          <code className="rounded bg-slate-200/70 px-1.5 py-0.5 text-xs text-slate-800">{children}</code>
        ),
        pre: ({ children }) => (
          <pre className="mb-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-3 text-xs text-slate-700 last:mb-0">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-teal-300 pl-3 text-slate-600 italic last:mb-0">{children}</blockquote>
        ),
      }}
    >
      {content || '（空内容）'}
    </ReactMarkdown>
  )
}

export function ChatPage() {
  const [searchParams] = useSearchParams()
  const [activeSessionId, setActiveSessionId] = useState(() =>
    getInitialSessionIdFromStorage(
      typeof window !== 'undefined' ? window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY) : null,
    ),
  )
  const [actionFeedback, setActionFeedback] = useState<InlineFeedback>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [mobilePane, setMobilePane] = useState<MobilePane>('messages')
  const [desktopSessionManagerOpen, setDesktopSessionManagerOpen] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [streamEvents, setStreamEvents] = useState<ChatStreamEvent[]>([])
  const [streamError, setStreamError] = useState<string | null>(null)
  const [streamPreview, setStreamPreview] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [followUpContext, setFollowUpContext] = useState<Record<string, unknown> | null>(null)
  const [followUpTarget, setFollowUpTarget] = useState<string | null>(null)
  const [followUpConsumed, setFollowUpConsumed] = useState(false)
  const streamAbortRef = useRef<AbortController | null>(null)
  const copyResetTimerRef = useRef<number | null>(null)
  const injectedRecordIdRef = useRef<number | null>(null)

  const followUpRecordId = parseFollowUpRecordId(searchParams.get('recordId'))
  const fromReport = searchParams.get('from') === 'report'

  const skillsQuery = useQuery({
    queryKey: ['chat-skills'],
    queryFn: () => agentApi.getSkills(),
  })

  const sessionsQuery = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => agentApi.getChatSessions(50),
  })

  const deleteMutation = useMutation({
    mutationFn: agentApi.deleteChatSession,
  })

  const sendMutation = useMutation({
    mutationFn: (payload: { content: string; title?: string }) => agentApi.sendChat(payload.content, payload.title),
  })

  const followUpQuery = useQuery({
    queryKey: ['chat-follow-up-report', followUpRecordId],
    queryFn: () => historyApi.getDetail(followUpRecordId as number),
    enabled: !!followUpRecordId && fromReport,
  })

  const sessions = mergeSessionsWithDraft(activeSessionId, sessionsQuery.data || [])
  const serverSessionIds = new Set((sessionsQuery.data || []).map((item) => item.sessionId))
  const currentSession = sessions.find((session) => session.sessionId === activeSessionId) || null
  const isCurrentServerSession = !!currentSession && serverSessionIds.has(currentSession.sessionId)
  const currentSessionTitle = normalizeSessionTitle(currentSession?.title, isCurrentServerSession ? '未命名会话' : '新会话')
  const currentSessionTitleCompact = truncateSessionTitle(currentSessionTitle, 24, currentSessionTitle)

  const allSkills = skillsQuery.data?.skills || []
  const effectiveSelectedSkillId = resolveDefaultSkillId(allSkills, selectedSkillId || skillsQuery.data?.defaultSkillId)
  const selectedSkill = allSkills.find((skill) => skill.id === effectiveSelectedSkillId) || null
  const selectedSkillDisplayName = formatSkillDisplayName(selectedSkill?.name) || '默认策略'
  const quickSkills = pickQuickSkills(allSkills, 4)

  const messagesQuery = useQuery({
    queryKey: ['chat-session-messages', activeSessionId],
    queryFn: () => agentApi.getChatSessionMessages(activeSessionId, 200),
    enabled: !!activeSessionId,
  })

  const currentMessages = messagesQuery.data || []
  const firstUserMessage = currentMessages.find((message) => message.role === 'user') || null
  const hasAssistantMessage = currentMessages.some((message) => message.role === 'assistant')
  const normalizedRawSessionTitle = String(currentSession?.title || '').trim()
  const visibleMessages = currentMessages.filter((message) => {
    if (!hasAssistantMessage) return true
    if (!normalizedRawSessionTitle) return true
    if (message.role !== 'user') return true
    if (!firstUserMessage || message.id !== firstUserMessage.id) return true
    return String(message.content || '').trim() !== normalizedRawSessionTitle
  })
  const canOperateSession = !messagesQuery.isFetching && !messagesQuery.error && currentMessages.length > 0
  const canSubmitMessage = !!draftMessage.trim() && !isStreaming

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, activeSessionId)
  }, [activeSessionId])

  useEffect(
    () => () => {
      if (streamAbortRef.current) {
        streamAbortRef.current.abort()
      }
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (!followUpRecordId || !followUpQuery.data) return
    if (injectedRecordIdRef.current === followUpRecordId) return

    const stockCode = sanitizeFollowUpStockCode(followUpQuery.data.meta.stockCode || null)
    const stockName = sanitizeFollowUpStockName(followUpQuery.data.meta.stockName || null)

    if (!stockCode) {
      setActionFeedback({ kind: 'error', message: '追问上下文加载失败：记录中的股票代码无效。' })
      injectedRecordIdRef.current = followUpRecordId
      return
    }

    const context = buildChatFollowUpContext(stockCode, stockName, followUpQuery.data)
    setFollowUpContext(context)
    setFollowUpTarget(stockName ? `${stockName} (${stockCode})` : stockCode)
    setFollowUpConsumed(false)
    setMobilePane('messages')
    setDraftMessage((value) => (value.trim() ? value : buildFollowUpPrompt(stockCode, stockName)))
    setActionFeedback({ kind: 'success', message: '已注入分析台上下文，可直接追问。' })
    injectedRecordIdRef.current = followUpRecordId
  }, [followUpQuery.data, followUpRecordId])

  useEffect(() => {
    if (!followUpRecordId || !followUpQuery.error) return
    setActionFeedback({
      kind: 'error',
      message: `追问上下文加载失败：${getParsedApiError(followUpQuery.error).message}`,
    })
  }, [followUpRecordId, followUpQuery.error])

  const handleCreateSession = () => {
    const newSessionId = createLocalSessionId()
    setActiveSessionId(newSessionId)
    setMobilePane('messages')
    setActionFeedback({ kind: 'success', message: '已创建新会话，可直接开始提问。' })
  }

  const handleSwitchSession = (sessionId: string) => {
    setActiveSessionId(sessionId)
    setMobilePane('messages')
    setActionFeedback(null)
  }

  const handleDeleteSession = async (sessionId: string) => {
    const target = sessions.find((item) => item.sessionId === sessionId)
    const label = target?.title || sessionId
    if (!window.confirm(`确认删除会话「${label}」吗？`)) return

    setActionFeedback(null)

    try {
      await deleteMutation.mutateAsync(sessionId)
      const refreshed = await sessionsQuery.refetch()
      const refreshedSessions = refreshed.data || []

      if (activeSessionId === sessionId) {
        const nextSessionId = refreshedSessions[0]?.sessionId || createLocalSessionId()
        setActiveSessionId(nextSessionId)
      }

      setActionFeedback({ kind: 'success', message: '会话已删除。' })
    } catch (error) {
      const parsed = getParsedApiError(error)
      setActionFeedback({ kind: 'error', message: parsed.message })
    }
  }

  const handleExportSession = () => {
    if (!canOperateSession) {
      setActionFeedback({ kind: 'error', message: '当前会话暂无可导出的消息。' })
      return
    }

    const sessionLabel = currentSession?.title || '问股会话'
    const markdown = formatChatSessionAsMarkdown(currentMessages, sessionLabel)
    downloadChatSessionMarkdown(markdown, sessionLabel)
    setActionFeedback({ kind: 'success', message: '会话已导出为 Markdown。' })
  }

  const handleSendSession = async () => {
    if (!canOperateSession) {
      setActionFeedback({ kind: 'error', message: '当前会话暂无可发送的消息。' })
      return
    }

    setActionFeedback(null)
    const sessionLabel = currentSession?.title || '问股会话'
    const markdown = formatChatSessionAsMarkdown(currentMessages, sessionLabel)

    try {
      await sendMutation.mutateAsync({
        content: markdown,
        title: sessionLabel,
      })
      setActionFeedback({ kind: 'success', message: '会话内容已发送到通知渠道。' })
    } catch (error) {
      const parsed = getParsedApiError(error)
      setActionFeedback({ kind: 'error', message: parsed.message })
    }
  }

  const handleCopyMessage = async (messageId: string, messageContent: string) => {
    try {
      await navigator.clipboard.writeText(messageContent)
      setCopiedMessageId(messageId)
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current)
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedMessageId(null)
      }, 1800)
    } catch {
      setActionFeedback({ kind: 'error', message: '复制失败，请检查浏览器剪贴板权限。' })
    }
  }

  const handleCancelStreaming = () => {
    if (!streamAbortRef.current) return
    streamAbortRef.current.abort()
    streamAbortRef.current = null
  }

  const handleSendMessage = async () => {
    const message = draftMessage.trim()
    if (!message || isStreaming) return

    const requestPayload: ChatRequestPayload = {
      message,
      sessionId: activeSessionId,
      skills: effectiveSelectedSkillId ? [effectiveSelectedSkillId] : undefined,
      context: !followUpConsumed && followUpContext ? followUpContext : undefined,
    }

    setActionFeedback(null)
    setStreamError(null)
    setStreamPreview('')
    setStreamEvents([])
    setIsStreaming(true)

    const controller = new AbortController()
    streamAbortRef.current = controller

    try {
      const result = await agentApi.chatStream(requestPayload, {
        signal: controller.signal,
        onEvent: (event) => {
          setStreamEvents((previous) => [...previous, event])
          if (event.type === 'done' && typeof event.content === 'string' && event.content) {
            setStreamPreview(event.content)
          }
        },
      })

      if (!result.success) {
        const errorMessage = result.error || '问股请求失败，请稍后重试。'
        setStreamError(errorMessage)
        setActionFeedback({ kind: 'error', message: errorMessage })
        return
      }

      const nextSessionId = result.sessionId || activeSessionId
      setDraftMessage('')
      if (!followUpConsumed && followUpContext) {
        setFollowUpConsumed(true)
      }

      if (nextSessionId !== activeSessionId) {
        setActiveSessionId(nextSessionId)
        await sessionsQuery.refetch()
      } else {
        await Promise.all([sessionsQuery.refetch(), messagesQuery.refetch()])
      }

      setActionFeedback({ kind: 'success', message: '消息已发送，AI 回复已更新。' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setActionFeedback({ kind: 'error', message: '已取消本次流式请求。' })
      } else {
        const parsed = getParsedApiError(error)
        setStreamError(parsed.message)
        setActionFeedback({ kind: 'error', message: parsed.message })
      }
    } finally {
      setIsStreaming(false)
      streamAbortRef.current = null
      await messagesQuery.refetch()
    }
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSendMessage()
    }
  }

  const renderSessionManagerContent = (mode: 'mobile' | 'desktop') => {
    const isDesktop = mode === 'desktop'

    const handleCreateFromPanel = () => {
      handleCreateSession()
    }

    const handleSwitchFromPanel = (sessionId: string) => {
      handleSwitchSession(sessionId)
    }

    return (
      <>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-teal-900/80">{isDesktop ? '会话管理' : '会话列表'}</p>
          <div className="flex items-center gap-1.5">
            {isDesktop ? (
              <button
                type="button"
                onClick={() => setDesktopSessionManagerOpen(false)}
                className="rounded-lg border border-teal-900/15 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-teal-50"
                data-testid="chat-session-manager-close"
              >
                关闭
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleCreateFromPanel}
              className="rounded-lg border border-teal-900/15 bg-teal-500/12 px-2.5 py-1.5 text-xs font-semibold text-teal-900 transition hover:bg-teal-500/18"
              data-testid={isDesktop ? 'chat-new-session' : 'chat-new-session-mobile'}
            >
              新建会话
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1" data-testid={isDesktop ? 'chat-session-list' : 'chat-mobile-session-list'}>
          {sessionsQuery.isFetching ? (
            <p className="rounded-xl border border-dashed border-teal-900/20 bg-teal-50/70 p-3 text-sm text-slate-600">正在加载会话...</p>
          ) : null}

          {sessionsQuery.error ? (
            <p className="rounded-xl border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-700">{getParsedApiError(sessionsQuery.error).message}</p>
          ) : null}

          {!sessionsQuery.isFetching && !sessionsQuery.error && sessions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-teal-900/20 bg-teal-50/70 p-3 text-sm text-slate-600">暂无历史会话，先创建一个新会话。</p>
          ) : null}

          {sessions.map((session) => {
            const isActive = session.sessionId === activeSessionId
            const isServerSession = serverSessionIds.has(session.sessionId)
            const sessionTitle = normalizeSessionTitle(session.title)
            const sessionTitleCompact = truncateSessionTitle(sessionTitle, 22, sessionTitle)

            return (
              <div
                key={session.sessionId}
                className={`rounded-xl border p-2 transition ${
                  isActive
                    ? 'border-teal-500/35 bg-teal-500/10 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.2)]'
                    : 'border-teal-900/10 bg-white hover:bg-teal-50/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSwitchFromPanel(session.sessionId)}
                  className="w-full text-left"
                  data-testid={isDesktop ? `chat-session-item-${session.sessionId}` : `chat-mobile-session-item-${session.sessionId}`}
                >
                  <p className="truncate text-sm font-semibold text-slate-900" title={sessionTitle}>
                    {sessionTitleCompact}
                  </p>
                  <p className={`mt-1 text-xs ${isActive ? 'text-slate-600' : 'text-slate-500'}`}>
                    {session.messageCount} 条消息 · {formatDateTime(session.lastActive || session.createdAt || undefined)}
                  </p>
                </button>

                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-[11px] font-medium ${isActive ? 'text-slate-600' : 'text-slate-500'}`}>
                    {isServerSession ? '云端会话' : '本地草稿'}
                  </span>
                  {isServerSession ? (
                    <button
                      type="button"
                      onClick={() => void handleDeleteSession(session.sessionId)}
                      className="rounded-md border border-rose-300/80 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={deleteMutation.isPending}
                      aria-label={`删除会话-${session.title || session.sessionId}`}
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </>
    )
  }

  return (
    <section className="space-y-3" data-testid="page-chat">
      <div className="rounded-2xl border border-teal-900/10 bg-white/80 p-2 lg:hidden" data-testid="chat-mobile-switcher">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMobilePane('sessions')}
            data-testid="chat-mobile-pane-sessions"
            aria-pressed={mobilePane === 'sessions'}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              mobilePane === 'sessions'
                ? 'bg-teal-500/12 text-teal-900 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.24)]'
                : 'bg-white text-slate-600'
            }`}
          >
            会话列表
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('messages')}
            data-testid="chat-mobile-pane-messages"
            aria-pressed={mobilePane === 'messages'}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              mobilePane === 'messages'
                ? 'bg-teal-500/12 text-teal-900 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.24)]'
                : 'bg-white text-slate-600'
            }`}
          >
            消息工作区
          </button>
        </div>
      </div>

      {mobilePane === 'sessions' ? (
        <section className="rounded-2xl border border-teal-900/10 bg-white/80 p-3 lg:hidden" data-testid="chat-mobile-session-panel">
          {renderSessionManagerContent('mobile')}
        </section>
      ) : null}

      <article
          className={`${mobilePane === 'messages' ? 'block' : 'hidden'} rounded-2xl border border-teal-900/10 bg-white/80 p-4 lg:block lg:min-h-[calc(100vh-6rem)]`}
          data-testid="chat-message-panel"
        >
          <h2 hidden data-testid="page-title-chat">
            问股
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <p
              className="rounded-lg border border-teal-900/10 bg-teal-50/70 px-2.5 py-1 text-xs font-medium text-teal-800"
              data-testid="chat-session-context-status"
            >
              {isCurrentServerSession ? '云端会话 · 已持久化' : '本地草稿 · 尚未入库'} · 当前消息 {currentMessages.length} 条 · 当前策略{' '}
              {selectedSkillDisplayName}
            </p>
            <button
              type="button"
              onClick={handleExportSession}
              className="rounded-lg border border-teal-900/15 bg-white px-3 py-1.5 text-xs font-semibold text-teal-900 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canOperateSession}
              data-testid="chat-export-session"
            >
              导出 Markdown
            </button>
            <button
              type="button"
              onClick={() => void handleSendSession()}
              className="rounded-lg border border-teal-900/15 bg-teal-500/12 px-3 py-1.5 text-xs font-semibold text-teal-900 transition hover:bg-teal-500/18 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canOperateSession || sendMutation.isPending || isStreaming}
              data-testid="chat-send-session"
            >
              {sendMutation.isPending ? '发送中...' : '发送到通知'}
            </button>
            <button
              type="button"
              onClick={() => setDesktopSessionManagerOpen((value) => !value)}
              className="hidden rounded-lg border border-teal-900/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-teal-50 lg:inline-flex"
              data-testid="chat-session-manager-toggle"
              aria-expanded={desktopSessionManagerOpen}
            >
              会话管理
            </button>
          </div>

          {followUpRecordId ? (
            <div
              className={`mt-2 rounded-xl border px-3 py-2 text-xs ${
                followUpQuery.error
                  ? 'border-rose-300/70 bg-rose-50 text-rose-700'
                  : followUpContext
                    ? 'border-teal-500/30 bg-teal-50 text-teal-900'
                    : 'border-teal-900/15 bg-white text-slate-600'
              }`}
              data-testid="chat-follow-up-banner"
            >
              {followUpQuery.isFetching ? '正在注入分析台上下文...' : null}
              {!followUpQuery.isFetching && followUpQuery.error
                ? `上下文注入失败：${getParsedApiError(followUpQuery.error).message}`
                : null}
              {!followUpQuery.isFetching && !followUpQuery.error && followUpContext
                ? `已注入追问上下文：${followUpTarget || '目标股票'} · ${followUpConsumed ? '已使用' : '待发送'}`
                : null}
            </div>
          ) : null}

          {actionFeedback ? (
            <p className={`mt-2 text-sm font-medium ${actionFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
              {actionFeedback.message}
            </p>
          ) : null}

          <div className="mt-3 flex min-h-[58vh] flex-col rounded-2xl border border-teal-900/10 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">会话消息</p>
              <div className="ml-auto flex min-w-0 max-w-full items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">会话标题</span>
                <span
                  className="max-w-[min(46vw,26rem)] truncate text-xs font-semibold text-slate-700"
                  data-testid="chat-current-session-title"
                  title={currentSessionTitle}
                >
                  {currentSessionTitleCompact}
                </span>
                <span className="sr-only font-mono text-xs" data-testid="chat-current-session-id">
                  {activeSessionId}
                </span>
              </div>
            </div>

            {messagesQuery.isFetching ? <p className="mt-2 text-sm text-slate-600">正在加载消息...</p> : null}
            {messagesQuery.error ? <p className="mt-2 text-sm text-rose-700">{getParsedApiError(messagesQuery.error).message}</p> : null}
            {!messagesQuery.isFetching && !messagesQuery.error && visibleMessages.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600" data-testid="chat-empty-state">
                当前会话还没有消息。可以直接在下方输入区发起第一条提问。
              </p>
            ) : null}

            {streamEvents.length > 0 || isStreaming || streamError ? (
              <div className="mt-3 rounded-xl border border-teal-900/10 bg-teal-50/70 p-3" data-testid="chat-stream-panel">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-900/80" data-testid="chat-stream-status">
                    {isStreaming ? '流式分析进行中' : streamError ? '流式分析失败' : '流式分析完成'}
                  </p>
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleCancelStreaming}
                      className="rounded-md border border-rose-300/80 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                      data-testid="chat-stream-cancel"
                    >
                      取消请求
                    </button>
                  ) : null}
                </div>
                {streamError ? <p className="mt-2 text-xs text-rose-700">{streamError}</p> : null}

                {streamEvents.length > 0 ? (
                  <details className="mt-2 rounded-lg border border-teal-900/10 bg-white p-2" open={isStreaming}>
                    <summary className="cursor-pointer text-xs font-semibold text-slate-700">思考过程 ({streamEvents.length})</summary>
                    <ol className="mt-2 space-y-1 text-xs text-slate-600">
                      {streamEvents.map((event, index) => (
                        <li key={`${event.type}-${index}`} data-testid={`chat-stream-event-${index}`}>
                          {formatStreamEventLabel(event)}
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 min-h-[18rem] flex-1 space-y-2 overflow-y-auto pr-1">
              {visibleMessages.map((message) => {
                const isUser = message.role === 'user'
                const parsedMessage = splitThinkingContent(message.content || '')
                return (
                  <div
                    key={message.id}
                    className={`rounded-xl border px-3 py-2 ${
                      isUser ? 'border-sky-200/70 bg-sky-50 text-slate-800' : 'border-teal-900/10 bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{isUser ? '用户' : 'AI'}</p>
                      <button
                        type="button"
                        onClick={() => void handleCopyMessage(message.id, message.content || '')}
                        className="rounded-md border border-teal-900/15 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-teal-50"
                        data-testid={`chat-copy-message-${message.id}`}
                      >
                        {copiedMessageId === message.id ? '已复制' : '复制'}
                      </button>
                    </div>

                    {!isUser && parsedMessage.thinking ? (
                      <details className="mt-2 rounded-lg border border-teal-900/10 bg-white p-2">
                        <summary className="cursor-pointer text-xs font-semibold text-teal-900/80">思考过程</summary>
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{parsedMessage.thinking}</p>
                      </details>
                    ) : null}

                    <div className="mt-2 text-sm leading-relaxed text-slate-800">
                      <MessageMarkdown content={parsedMessage.content || message.content || '（空内容）'} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{formatDateTime(message.createdAt || undefined)}</p>
                  </div>
                )
              })}

              {isStreaming && streamPreview ? (
                <div className="rounded-xl border border-teal-500/30 bg-teal-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-teal-800">AI (流式预览)</p>
                  <div className="mt-1 text-sm text-slate-800">
                    <MessageMarkdown content={streamPreview} />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-2 shrink-0 rounded-xl border border-teal-900/10 bg-teal-50/50 p-3" data-testid="chat-composer">
              <div className="flex items-start justify-between gap-4">
                <label htmlFor="chat-input" className="pt-1 text-xs uppercase tracking-[0.12em] text-slate-600">
                  输入问题
                </label>
                <div className="ml-auto min-w-0 max-w-[min(62%,52rem)] text-right" data-testid="chat-skill-panel">
                  <div className="overflow-x-auto pb-1" data-testid="chat-skill-chips">
                    <div className="inline-flex min-w-max items-center justify-end gap-1.5 whitespace-nowrap">
                      <span className="shrink-0 text-xs font-semibold text-slate-600">策略：</span>
                      {quickSkills.map((skill) => (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => setSelectedSkillId(skill.id)}
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
                            effectiveSelectedSkillId === skill.id
                              ? 'border-teal-500/40 bg-teal-500/12 text-teal-900'
                              : 'border-teal-900/15 bg-white text-slate-700 hover:bg-teal-50'
                          }`}
                        data-testid={`chat-skill-chip-${skill.id}`}
                      >
                        {formatSkillDisplayName(skill.name)}
                      </button>
                    ))}
                      <select
                        id="chat-skill-select"
                        value={effectiveSelectedSkillId}
                        onChange={(event) => setSelectedSkillId(event.target.value)}
                        aria-label="策略选择"
                        className="h-8 w-[11rem] shrink-0 rounded-lg border border-teal-900/15 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/15"
                        data-testid="chat-skill-select"
                        disabled={!allSkills.length}
                      >
                        {!allSkills.length ? <option value="">暂无可用策略</option> : null}
                        {allSkills.map((skill) => (
                          <option key={skill.id} value={skill.id}>
                            {formatSkillDisplayName(skill.name)}
                          </option>
                        ))}
                      </select>
                      {skillsQuery.isFetching ? <span className="shrink-0 text-[11px] text-slate-500">加载中...</span> : null}
                    </div>
                  </div>

                  {skillsQuery.error ? (
                    <p className="mt-1 truncate whitespace-nowrap text-[11px] text-rose-700">{getParsedApiError(skillsQuery.error).message}</p>
                  ) : null}

                  {selectedSkill ? (
                    <p className="mt-1 truncate whitespace-nowrap text-[11px] text-slate-600" data-testid="chat-selected-skill-desc">
                      {selectedSkill.description}
                    </p>
                  ) : null}
                </div>
              </div>

              <textarea
                id="chat-input"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                onKeyDown={handleInputKeyDown}
                rows={3}
                className="mt-2 w-full resize-none rounded-lg border border-teal-900/15 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/15"
                placeholder="例如：用当前策略分析 600519，给出短线入场与止损建议。"
                data-testid="chat-input"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">Enter 发送，Shift + Enter 换行 · 默认使用流式模式</p>
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  className="rounded-lg border border-teal-900/15 bg-teal-500/12 px-3 py-1.5 text-xs font-semibold text-teal-900 transition hover:bg-teal-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="chat-send-message"
                  disabled={!canSubmitMessage}
                >
                  {isStreaming ? '流式中...' : '发送提问'}
                </button>
              </div>
            </div>
          </div>
      </article>

      {desktopSessionManagerOpen ? (
        <div className="fixed inset-0 z-40 hidden lg:block" data-testid="chat-session-manager-layer">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/24 backdrop-blur-[1px]"
            onClick={() => setDesktopSessionManagerOpen(false)}
            aria-label="关闭会话管理"
          />
          <aside
            className="absolute right-[var(--dsa-shell-content-padding)] top-[5.35rem] w-[min(420px,calc(100vw-3rem))] rounded-2xl border border-teal-900/15 bg-white/95 p-3 shadow-[0_20px_45px_rgba(15,23,42,0.2)] backdrop-blur-xl"
            data-testid="chat-session-panel"
          >
            {renderSessionManagerContent('desktop')}
          </aside>
        </div>
      ) : null}
    </section>
  )
}
