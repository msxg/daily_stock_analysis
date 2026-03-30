import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSearchParams } from 'react-router-dom'
import { agentApi, getParsedApiError } from '@/shared/api'
import type { ChatRequestPayload, ChatSessionMessage, ChatStreamEvent } from '@/shared/types/chat'
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

function getMessageTimestamp(value: string | null | undefined): number {
  if (!value) return Number.NaN
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : Number.NaN
}

function MessageMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="break-words leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed break-words">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal space-y-1 pl-4 text-sm leading-relaxed break-words">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed break-words">{children}</li>,
        code: ({ children }) => (
          <code className="break-words rounded bg-slate-200/70 px-1.5 py-0.5 text-xs text-slate-800">{children}</code>
        ),
        pre: ({ children }) => (
          <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-100 p-3 text-xs text-slate-700">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="break-words border-l-2 dsa-theme-border-accent-soft pl-2.5 text-sm leading-relaxed text-slate-600 italic">
            {children}
          </blockquote>
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
  const [pendingUserMessage, setPendingUserMessage] = useState<ChatSessionMessage | null>(null)
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
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const queryClient = useQueryClient()

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
  const shouldFetchMessages = !!activeSessionId && (activeSessionId.startsWith('user_') || serverSessionIds.has(activeSessionId))
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
    enabled: shouldFetchMessages,
  })

  const currentMessages = messagesQuery.data || []
  const orderedCurrentMessages = currentMessages
    .map((message, index) => ({ message, index }))
    .sort((left, right) => {
      const leftTime = getMessageTimestamp(left.message.createdAt)
      const rightTime = getMessageTimestamp(right.message.createdAt)

      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return leftTime - rightTime
      }

      if (Number.isFinite(leftTime) && !Number.isFinite(rightTime)) {
        return -1
      }

      if (!Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
        return 1
      }

      return left.index - right.index
    })
    .map(({ message }) => message)
  const firstUserMessage = orderedCurrentMessages.find((message) => message.role === 'user') || null
  const hasAssistantMessage = orderedCurrentMessages.some((message) => message.role === 'assistant')
  const normalizedRawSessionTitle = String(currentSession?.title || '').trim()
  const visibleMessages = orderedCurrentMessages.filter((message) => {
    if (!hasAssistantMessage) return true
    if (!normalizedRawSessionTitle) return true
    if (message.role !== 'user') return true
    if (!firstUserMessage || message.id !== firstUserMessage.id) return true
    return String(message.content || '').trim() !== normalizedRawSessionTitle
  })
  const latestVisibleUserMessage = [...visibleMessages].reverse().find((message) => message.role === 'user') || null
  const latestVisibleAssistantMessage = [...visibleMessages].reverse().find((message) => message.role === 'assistant') || null
  const hasPersistedPendingUserMessage =
    !!pendingUserMessage &&
    latestVisibleUserMessage?.content.trim() === pendingUserMessage.content.trim()
  const showPendingUserMessage = !!pendingUserMessage && !hasPersistedPendingUserMessage
  const latestAssistantContent = latestVisibleAssistantMessage
    ? splitThinkingContent(latestVisibleAssistantMessage.content || '').content.trim()
    : ''
  const hasPersistedStreamReply = !isStreaming && !!streamPreview.trim() && latestAssistantContent === streamPreview.trim()
  const showStreamCard = (isStreaming || !!streamError || !!streamPreview || streamEvents.length > 0) && !hasPersistedStreamReply
  const latestStreamLabel = streamEvents.length ? formatStreamEventLabel(streamEvents[streamEvents.length - 1]) : null
  const canOperateSession = !messagesQuery.isFetching && !messagesQuery.error && orderedCurrentMessages.length > 0
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

  useEffect(() => {
    const container = messageListRef.current
    if (!container) return

    const frameId = window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [activeSessionId, visibleMessages.length, showPendingUserMessage, showStreamCard, streamEvents.length, streamPreview, streamError])

  const resetTransientStreamState = () => {
    setPendingUserMessage(null)
    setStreamError(null)
    setStreamPreview('')
    setStreamEvents([])
    setIsStreaming(false)
    streamAbortRef.current = null
  }

  useEffect(() => {
    if (!messagesQuery.error) return
    const parsed = getParsedApiError(messagesQuery.error)
    if (parsed.status !== 403) return

    const fallbackSessionId = createLocalSessionId()
    resetTransientStreamState()
    setActiveSessionId(fallbackSessionId)
    setActionFeedback({ kind: 'error', message: '检测到会话权限已变化，已切换到新会话。' })
  }, [messagesQuery.error])

  const handleCreateSession = () => {
    const newSessionId = createLocalSessionId()
    resetTransientStreamState()
    setActiveSessionId(newSessionId)
    setMobilePane('messages')
    setActionFeedback({ kind: 'success', message: '已创建新会话，可直接开始提问。' })
  }

  const handleSwitchSession = (sessionId: string) => {
    resetTransientStreamState()
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
    const markdown = formatChatSessionAsMarkdown(orderedCurrentMessages, sessionLabel)
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
    const markdown = formatChatSessionAsMarkdown(orderedCurrentMessages, sessionLabel)

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

    const optimisticUserMessage: ChatSessionMessage = {
      id: `pending-user-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    }

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
    setPendingUserMessage(optimisticUserMessage)
    setDraftMessage('')
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
        setDraftMessage((value) => (value.trim() ? value : message))
        setActionFeedback({ kind: 'error', message: errorMessage })
        return
      }

      const nextSessionId = result.sessionId || activeSessionId
      if (!followUpConsumed && followUpContext) {
        setFollowUpConsumed(true)
      }

      if (nextSessionId !== activeSessionId) {
        setActiveSessionId(nextSessionId)
      }

      await Promise.all([
        sessionsQuery.refetch(),
        nextSessionId === activeSessionId
          ? messagesQuery.refetch()
          : queryClient.fetchQuery({
              queryKey: ['chat-session-messages', nextSessionId],
              queryFn: () => agentApi.getChatSessionMessages(nextSessionId, 200),
            }),
      ])

      resetTransientStreamState()
      setActionFeedback({ kind: 'success', message: '消息已发送，AI 回复已更新。' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStreamError('本次请求已取消，可调整问题后重试。')
        setDraftMessage((value) => (value.trim() ? value : message))
        setActionFeedback({ kind: 'error', message: '已取消本次流式请求。' })
      } else {
        const parsed = getParsedApiError(error)
        setStreamError(parsed.message)
        setDraftMessage((value) => (value.trim() ? value : message))
        setActionFeedback({ kind: 'error', message: parsed.message })
      }
    } finally {
      setIsStreaming(false)
      streamAbortRef.current = null
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
          <p className="text-xs uppercase tracking-[0.2em] dsa-theme-text-accent-muted">{isDesktop ? '会话管理' : '会话列表'}</p>
          <div className="flex items-center gap-1.5">
            {isDesktop ? (
              <button
                type="button"
                onClick={() => setDesktopSessionManagerOpen(false)}
                className="rounded-lg border dsa-theme-border-default bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:dsa-theme-bg-soft"
                data-testid="chat-session-manager-close"
              >
                关闭
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleCreateFromPanel}
              className="rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-2.5 py-1.5 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover"
              data-testid={isDesktop ? 'chat-new-session' : 'chat-new-session-mobile'}
              disabled={isStreaming}
            >
              新建会话
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[calc(100vh-14rem)] overflow-x-hidden overflow-y-auto pr-1" data-testid={isDesktop ? 'chat-session-list' : 'chat-mobile-session-list'}>
          {sessionsQuery.isFetching ? (
            <p className="rounded-xl border border-dashed dsa-theme-border-strong dsa-theme-bg-soft-70 p-3 text-sm text-slate-600">正在加载会话...</p>
          ) : null}

          {sessionsQuery.error ? (
            <p className="rounded-xl border border-rose-300/70 dsa-theme-bg-soft p-3 text-sm text-rose-700">{getParsedApiError(sessionsQuery.error).message}</p>
          ) : null}

          {!sessionsQuery.isFetching && !sessionsQuery.error && sessions.length === 0 ? (
            <p className="rounded-xl border border-dashed dsa-theme-border-strong dsa-theme-bg-soft-70 p-3 text-sm text-slate-600">暂无历史会话，先创建一个新会话。</p>
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
                    ? 'dsa-theme-border-accent dsa-theme-bg-accent-soft dsa-theme-shadow-active'
                    : 'dsa-theme-border-subtle bg-white hover:dsa-theme-bg-soft-60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSwitchFromPanel(session.sessionId)}
                  className="w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
                  data-testid={isDesktop ? `chat-session-item-${session.sessionId}` : `chat-mobile-session-item-${session.sessionId}`}
                  disabled={isStreaming}
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
                      className="rounded-md border border-rose-300/80 dsa-theme-bg-soft px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={deleteMutation.isPending || isStreaming}
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
    <section className="max-w-full overflow-x-hidden space-y-3" data-testid="page-chat">
      <div className="rounded-2xl border dsa-theme-border-subtle bg-white/80 p-2 lg:hidden" data-testid="chat-mobile-switcher">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMobilePane('sessions')}
            data-testid="chat-mobile-pane-sessions"
            aria-pressed={mobilePane === 'sessions'}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              mobilePane === 'sessions'
                ? 'dsa-theme-bg-accent dsa-theme-text-accent dsa-theme-shadow-active'
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
                ? 'dsa-theme-bg-accent dsa-theme-text-accent dsa-theme-shadow-active'
                : 'bg-white text-slate-600'
            }`}
          >
            消息工作区
          </button>
        </div>
      </div>

      {mobilePane === 'sessions' ? (
        <section className="max-w-full overflow-x-hidden rounded-2xl border dsa-theme-border-subtle bg-white/80 p-3 lg:hidden" data-testid="chat-mobile-session-panel">
          {renderSessionManagerContent('mobile')}
        </section>
      ) : null}

      <article
        className={`max-w-full overflow-x-hidden ${mobilePane === 'messages' ? 'block' : 'hidden'} rounded-2xl border dsa-theme-border-subtle bg-white/80 p-4 lg:block lg:min-h-[calc(100vh-6rem)]`}
        data-testid="chat-message-panel"
      >
          <h2 hidden data-testid="page-title-chat">
            问股
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <p
              className="rounded-lg border dsa-theme-border-subtle dsa-theme-bg-soft-70 px-2.5 py-1 text-xs font-medium dsa-theme-text-accent-strong"
              data-testid="chat-session-context-status"
            >
              {isCurrentServerSession ? '云端会话 · 已持久化' : '本地草稿 · 尚未入库'} · 当前消息 {orderedCurrentMessages.length} 条 · 当前策略{' '}
              {selectedSkillDisplayName}
            </p>
            <button
              type="button"
              onClick={handleExportSession}
              className="rounded-lg border dsa-theme-border-default bg-white px-3 py-1.5 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canOperateSession}
              data-testid="chat-export-session"
            >
              导出 Markdown
            </button>
            <button
              type="button"
              onClick={() => void handleSendSession()}
              className="rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-1.5 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canOperateSession || sendMutation.isPending || isStreaming}
              data-testid="chat-send-session"
            >
              {sendMutation.isPending ? '发送中...' : '发送到通知'}
            </button>
            <button
              type="button"
              onClick={() => setDesktopSessionManagerOpen((value) => !value)}
              className="hidden rounded-lg border dsa-theme-border-default bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:dsa-theme-bg-soft lg:inline-flex"
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
                  ? 'border-rose-300/70 dsa-theme-bg-soft text-rose-700'
                  : followUpContext
                    ? 'dsa-theme-border-accent-soft dsa-theme-bg-soft dsa-theme-text-accent'
                    : 'dsa-theme-border-default bg-white text-slate-600'
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

          <div className="mt-3 flex min-h-[58vh] flex-col rounded-2xl border dsa-theme-border-subtle bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">会话消息</p>
              <div className="ml-auto flex min-w-0 max-w-full items-center gap-2 overflow-hidden">
                <span className="hidden text-[11px] uppercase tracking-[0.08em] text-slate-500 sm:inline">会话标题</span>
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
            {!messagesQuery.isFetching && !messagesQuery.error && visibleMessages.length === 0 && !showPendingUserMessage && !showStreamCard ? (
              <p className="mt-2 text-sm text-slate-600" data-testid="chat-empty-state">
                当前会话还没有消息。可以直接在下方输入区发起第一条提问。
              </p>
            ) : null}

            <div className="mt-3 min-h-[18rem] flex-1 space-y-2 overflow-x-hidden overflow-y-auto pr-1" data-testid="chat-message-list" ref={messageListRef}>
              {visibleMessages.map((message) => {
                const isUser = message.role === 'user'
                const parsedMessage = splitThinkingContent(message.content || '')
                return (
                  <div
                    key={message.id}
                    className={`overflow-hidden break-words space-y-2 rounded-xl border px-3 py-2 text-sm leading-relaxed ${
                      isUser ? 'border-sky-200/70 bg-sky-50 text-slate-800' : 'dsa-theme-border-subtle bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{isUser ? '用户' : 'AI'}</p>
                      <button
                        type="button"
                        onClick={() => void handleCopyMessage(message.id, message.content || '')}
                        className="rounded-md border dsa-theme-border-default bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:dsa-theme-bg-soft"
                        data-testid={`chat-copy-message-${message.id}`}
                      >
                        {copiedMessageId === message.id ? '已复制' : '复制'}
                      </button>
                    </div>

                    {!isUser && parsedMessage.thinking ? (
                      <details className="rounded-lg border dsa-theme-border-subtle bg-white p-2">
                        <summary className="cursor-pointer text-xs font-semibold dsa-theme-text-accent-muted">思考过程</summary>
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{parsedMessage.thinking}</p>
                      </details>
                    ) : null}

                    <MessageMarkdown content={parsedMessage.content || message.content || '（空内容）'} />
                    <p className="text-[11px] text-slate-500">{formatDateTime(message.createdAt || undefined)}</p>
                  </div>
                )
              })}

              {showPendingUserMessage && pendingUserMessage ? (
                <div
                  className="overflow-hidden break-words space-y-2 rounded-xl border border-sky-200/70 bg-sky-50 px-3 py-2 text-sm leading-relaxed text-slate-800"
                  data-testid="chat-pending-user-message"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">用户</p>
                    <span className="text-[11px] text-slate-500">刚刚发送</span>
                  </div>
                  <MessageMarkdown content={pendingUserMessage.content || '（空内容）'} />
                  <p className="text-[11px] text-slate-500">{formatDateTime(pendingUserMessage.createdAt || undefined)}</p>
                </div>
              ) : null}

              {showStreamCard ? (
                <div
                  className={`overflow-hidden break-words space-y-2 rounded-xl border px-3 py-2 text-sm leading-relaxed text-slate-800 ${
                    isStreaming
                      ? 'dsa-theme-border-subtle bg-slate-50'
                      : streamError
                        ? 'border-rose-200 bg-rose-50'
                        : 'dsa-theme-border-subtle bg-slate-50'
                  }`}
                  data-testid="chat-stream-panel"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">AI</p>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          isStreaming ? 'dsa-theme-text-accent-muted' : streamError ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                        data-testid="chat-stream-status"
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isStreaming ? 'dsa-theme-bg-accent' : streamError ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                        />
                        {isStreaming ? '思考中' : streamError ? '未完成' : '已完成'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isStreaming && streamPreview ? (
                        <button
                          type="button"
                          onClick={() => void handleCopyMessage('chat-stream-preview', streamPreview)}
                          className="rounded-md border dsa-theme-border-default bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:dsa-theme-bg-soft"
                          data-testid="chat-copy-stream-preview"
                        >
                          {copiedMessageId === 'chat-stream-preview' ? '已复制' : '复制'}
                        </button>
                      ) : null}
                      {isStreaming ? (
                        <button
                          type="button"
                          onClick={handleCancelStreaming}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                          data-testid="chat-stream-cancel"
                        >
                          取消
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {streamPreview ? (
                    <MessageMarkdown content={streamPreview} />
                  ) : (
                    <p className="text-sm leading-relaxed text-slate-600">
                      {streamError || latestStreamLabel || '正在整理这次回答，内容会直接续写在这条 AI 消息里。'}
                    </p>
                  )}

                  {streamEvents.length > 0 ? (
                    <details className="rounded-lg border dsa-theme-border-subtle bg-white/85 p-2" open={isStreaming}>
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

                  <p className="text-[11px] text-slate-500">
                    {formatDateTime(pendingUserMessage?.createdAt || undefined) || '刚刚'}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-2 shrink-0 rounded-xl border dsa-theme-border-subtle dsa-theme-bg-soft-50 p-3" data-testid="chat-composer">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
                <label htmlFor="chat-input" className="pt-1 text-xs uppercase tracking-[0.12em] text-slate-600 lg:shrink-0">
                  输入问题
                </label>
                <div className="min-w-0 w-full lg:ml-auto lg:max-w-[min(62%,52rem)] lg:text-right" data-testid="chat-skill-panel">
                  <div className="max-w-full overflow-x-auto pb-1" data-testid="chat-skill-chips">
                    <div className="flex min-w-0 flex-wrap items-center justify-start gap-1.5 lg:justify-end">
                      <span className="shrink-0 text-xs font-semibold text-slate-600">策略：</span>
                      {quickSkills.map((skill) => (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => setSelectedSkillId(skill.id)}
                          className={`max-w-[12rem] shrink-0 truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
                            effectiveSelectedSkillId === skill.id
                              ? 'dsa-theme-border-accent-strong dsa-theme-bg-accent dsa-theme-text-accent'
                              : 'dsa-theme-border-default bg-white text-slate-700 hover:dsa-theme-bg-soft'
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
                        className="h-7 min-w-[10rem] max-w-full flex-1 rounded-lg border dsa-theme-border-default bg-white px-2.5 text-[13px] text-slate-800 outline-none transition dsa-theme-focus-border-soft focus:ring-2 dsa-theme-focus-ring lg:w-[11rem] lg:flex-none"
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
                className="mt-2 w-full resize-none rounded-lg border dsa-theme-border-default bg-white px-3 py-2 text-sm text-slate-800 outline-none transition dsa-theme-focus-border-soft focus:ring-2 dsa-theme-focus-ring"
                placeholder="例如：用当前策略分析 600519，给出短线入场与止损建议。"
                data-testid="chat-input"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">Enter 发送，Shift + Enter 换行 · 默认使用流式模式</p>
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  className="rounded-lg border dsa-theme-border-default dsa-theme-bg-accent px-3 py-1.5 text-xs font-semibold dsa-theme-text-accent transition hover:dsa-theme-bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="chat-send-message"
                  disabled={!canSubmitMessage}
                >
                  {isStreaming ? '发送中...' : '发送提问'}
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
            className="absolute right-[var(--dsa-shell-content-padding)] top-[5.35rem] w-[min(420px,calc(100vw-3rem))] rounded-2xl border dsa-theme-border-default bg-white/95 p-3 shadow-[0_20px_45px_rgba(15,23,42,0.2)] backdrop-blur-xl"
            data-testid="chat-session-panel"
          >
            {renderSessionManagerContent('desktop')}
          </aside>
        </div>
      ) : null}
    </section>
  )
}
