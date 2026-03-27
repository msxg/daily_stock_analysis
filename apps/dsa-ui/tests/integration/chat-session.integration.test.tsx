import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/app/App'
import { server } from '../../tests/mocks/server'

describe('Chat session management', () => {
  beforeEach(() => {
    window.localStorage.removeItem('dsa_ui_chat_session_id')
  })

  it('loads sessions and switches message view', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/')
    render(<App />)

    await user.click(screen.getAllByRole('link', { name: '问股' })[0])
    expect(await screen.findByTestId('page-chat')).toBeInTheDocument()
    await user.click(screen.getByTestId('chat-session-manager-toggle'))
    expect(await screen.findByTestId('chat-session-panel')).toBeInTheDocument()

    expect(await screen.findByText('技术分析复盘')).toBeInTheDocument()
    expect(await screen.findByText('白酒板块观察')).toBeInTheDocument()

    await user.click(screen.getByTestId('chat-session-item-session-002'))
    expect(await screen.findByText('白酒板块近期能否继续配置？')).toBeInTheDocument()
    expect(await screen.findByText('建议分批配置，优先关注龙头成交量变化。')).toBeInTheDocument()
  }, 10000)

  it('supports creating and deleting sessions', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    let sessions = [
      {
        session_id: 'session-001',
        title: '技术分析复盘',
        message_count: 4,
        created_at: '2026-03-26T09:10:00+08:00',
        last_active: '2026-03-26T09:20:00+08:00',
      },
      {
        session_id: 'session-002',
        title: '白酒板块观察',
        message_count: 2,
        created_at: '2026-03-26T08:40:00+08:00',
        last_active: '2026-03-26T08:56:00+08:00',
      },
    ]

    server.use(
      http.get('/api/v1/agent/chat/sessions', () => HttpResponse.json({ sessions })),
      http.delete('/api/v1/agent/chat/sessions/:sessionId', ({ params }) => {
        const sessionId = String(params.sessionId || '')
        const before = sessions.length
        sessions = sessions.filter((item) => item.session_id !== sessionId)
        return HttpResponse.json({ deleted: before - sessions.length })
      }),
    )

    window.history.pushState({}, '', '/')
    render(<App />)
    await user.click(screen.getAllByRole('link', { name: '问股' })[0])
    expect(await screen.findByTestId('page-chat')).toBeInTheDocument()
    await user.click(screen.getByTestId('chat-session-manager-toggle'))
    expect(await screen.findByTestId('chat-session-panel')).toBeInTheDocument()

    await user.click(screen.getByTestId('chat-session-item-session-001'))
    await user.click(screen.getByRole('button', { name: '删除会话-技术分析复盘' }))
    expect(await screen.findByText('会话已删除。')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText('技术分析复盘')).not.toBeInTheDocument()
    })

    await user.click(screen.getByTestId('chat-new-session'))
    expect(await screen.findByText('已创建新会话，可直接开始提问。')).toBeInTheDocument()
    expect(screen.getByTestId('chat-current-session-title')).toHaveTextContent('新会话')
    expect(screen.getByTestId('chat-current-session-id')).toHaveTextContent('local-')

    confirmSpy.mockRestore()
  }, 10000)

  it('supports exporting markdown and sending session content', async () => {
    const user = userEvent.setup()
    let capturedPayload = ''

    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:chat-md')
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    server.use(
      http.post('/api/v1/agent/chat/send', async ({ request }) => {
        const body = (await request.json()) as { content?: string }
        capturedPayload = String(body.content || '')
        return HttpResponse.json({ success: true })
      }),
    )

    window.history.pushState({}, '', '/')
    render(<App />)
    await user.click(screen.getAllByRole('link', { name: '问股' })[0])
    await user.click(screen.getByTestId('chat-session-manager-toggle'))
    expect(await screen.findByTestId('chat-session-panel')).toBeInTheDocument()
    await user.click(screen.getByTestId('chat-session-item-session-001'))

    await user.click(screen.getByTestId('chat-export-session'))
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrlSpy).toHaveBeenCalledTimes(1)

    await user.click(screen.getByTestId('chat-send-session'))
    await waitFor(() => {
      expect(capturedPayload).toContain('请分析贵州茅台的短线趋势')
    })
    expect(await screen.findByText('会话内容已发送到通知渠道。')).toBeInTheDocument()

    createObjectUrlSpy.mockRestore()
    revokeObjectUrlSpy.mockRestore()
    clickSpy.mockRestore()
  }, 10000)

  it('supports skill selection, streaming flow and context injection', async () => {
    const user = userEvent.setup()
    let capturedSkills: string[] = []
    let capturedContext: Record<string, unknown> | undefined

    let sessionMessages: Record<string, Array<{ id: string; role: 'user' | 'assistant'; content: string; created_at: string }>> = {
      'session-001': [
        {
          id: 'm-001',
          role: 'user',
          content: '请分析贵州茅台的短线趋势',
          created_at: '2026-03-26T09:10:01+08:00',
        },
        {
          id: 'm-002',
          role: 'assistant',
          content: '<think>先确认趋势</think>\n\n**结论**：短线仍偏强。',
          created_at: '2026-03-26T09:10:05+08:00',
        },
      ],
    }

    server.use(
      http.get('/api/v1/agent/skills', () =>
        HttpResponse.json({
          default_skill_id: 'bull_trend',
          skills: [
            { id: 'bull_trend', name: '趋势策略', description: '趋势跟随' },
            { id: 'chan_theory', name: '缠论', description: '中枢结构分析' },
          ],
        }),
      ),
      http.get('/api/v1/agent/chat/sessions', () =>
        HttpResponse.json({
          sessions: [
            {
              session_id: 'session-001',
              title: '技术分析复盘',
              message_count: sessionMessages['session-001']?.length || 0,
              created_at: '2026-03-26T09:10:00+08:00',
              last_active: '2026-03-26T09:20:00+08:00',
            },
          ],
        }),
      ),
      http.get('/api/v1/agent/chat/sessions/:sessionId', ({ params }) => {
        const sessionId = String(params.sessionId || '')
        return HttpResponse.json({
          session_id: sessionId,
          messages: sessionMessages[sessionId] || [],
        })
      }),
      http.post('/api/v1/agent/chat/stream', async ({ request }) => {
        const body = (await request.json()) as {
          message?: string
          session_id?: string
          skills?: string[]
          context?: Record<string, unknown>
        }
        const text = String(body.message || '')
        const sessionId = String(body.session_id || 'session-001')
        capturedSkills = body.skills || []
        capturedContext = body.context

        sessionMessages = {
          ...sessionMessages,
          [sessionId]: [
            ...(sessionMessages[sessionId] || []),
            {
              id: 'u-stream',
              role: 'user',
              content: text,
              created_at: '2026-03-26T10:00:00+08:00',
            },
            {
              id: 'a-stream',
              role: 'assistant',
              content: '建议分批布局并设置保护位。',
              created_at: '2026-03-26T10:00:03+08:00',
            },
          ],
        }

        const ssePayload = [
          { type: 'thinking', step: 1, message: '正在制定分析路径...' },
          { type: 'tool_start', step: 1, tool: 'get_realtime_quote', display_name: '获取实时行情' },
          { type: 'tool_done', step: 1, tool: 'get_realtime_quote', display_name: '获取实时行情', success: true },
          { type: 'done', success: true, content: '建议分批布局并设置保护位。', session_id: sessionId, total_steps: 2 },
        ]
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join('')

        return new HttpResponse(ssePayload, {
          headers: {
            'Content-Type': 'text/event-stream',
          },
        })
      }),
    )

    window.history.pushState({}, '', '/')
    render(<App />)

    await user.click(await screen.findByTestId('desktop-nav-分析'))
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '追问 AI' }))
    expect(await screen.findByTestId('page-chat')).toBeInTheDocument()
    expect(await screen.findByTestId('chat-follow-up-banner')).toHaveTextContent('已注入追问上下文')

    await user.selectOptions(screen.getByTestId('chat-skill-select'), 'chan_theory')
    await waitFor(() => {
      expect(screen.getByTestId('chat-session-context-status')).toHaveTextContent('缠论')
    })

    await user.clear(screen.getByTestId('chat-input'))
    await user.type(screen.getByTestId('chat-input'), '请给我一个短线计划')
    await user.click(screen.getByTestId('chat-send-message'))

    await waitFor(() => {
      expect(capturedSkills).toEqual(['chan_theory'])
    })
    expect(capturedContext).toMatchObject({
      stock_code: '600519',
    })

    expect(await screen.findByText('建议分批布局并设置保护位。')).toBeInTheDocument()
    expect(await screen.findByText('消息已发送，AI 回复已更新。')).toBeInTheDocument()
    expect(screen.getByTestId('chat-stream-panel')).toBeInTheDocument()
    expect(screen.getByTestId('chat-stream-event-0')).toHaveTextContent('正在制定分析路径')
  }, 10000)

  it('renders markdown and supports copying message', async () => {
    const user = userEvent.setup()

    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn(),
        },
        configurable: true,
      })
    }
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()

    window.history.pushState({}, '', '/')
    render(<App />)
    await user.click(screen.getAllByRole('link', { name: '问股' })[0])
    expect(await screen.findByTestId('page-chat')).toBeInTheDocument()
    await user.click(screen.getByTestId('chat-session-manager-toggle'))
    expect(await screen.findByTestId('chat-session-panel')).toBeInTheDocument()
    await user.click(screen.getByTestId('chat-session-item-session-001'))

    expect(await screen.findByTestId('chat-copy-message-m-002')).toBeInTheDocument()
    expect(screen.getByText(/短线仍偏强/)).toBeInTheDocument()

    await user.click(screen.getByTestId('chat-copy-message-m-002'))
    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalled()
    })
    expect(await screen.findByText('已复制')).toBeInTheDocument()
  })
})
