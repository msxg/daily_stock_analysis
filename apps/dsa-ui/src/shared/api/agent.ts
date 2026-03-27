import { apiClient } from '@/shared/api/client'
import { API_BASE_URL } from '@/shared/config/env'
import { toCamelCase } from '@/shared/api/utils'
import type {
  ChatSkill,
  ChatRequestPayload,
  ChatResponse,
  ChatSessionItem,
  ChatSessionMessage,
  ChatSendResponse,
  ChatSkillsResponse,
  ChatSessionListResponse,
  ChatSessionMessagesResponse,
  ChatStreamDoneEvent,
  ChatStreamEvent,
} from '@/shared/types/chat'

type ChatStreamOptions = {
  signal?: AbortSignal
  onEvent?: (event: ChatStreamEvent) => void
}

function coerceDoneEvent(event: ChatStreamEvent): ChatStreamDoneEvent | null {
  if (event.type !== 'done') {
    return null
  }

  const typedEvent = event as {
    success?: unknown
    content?: unknown
    error?: unknown
    totalSteps?: unknown
    sessionId?: unknown
  }

  return {
    type: 'done',
    success: typeof typedEvent.success === 'boolean' ? typedEvent.success : false,
    content: typeof typedEvent.content === 'string' ? typedEvent.content : '',
    error: typeof typedEvent.error === 'string' ? typedEvent.error : undefined,
    totalSteps: typeof typedEvent.totalSteps === 'number' ? typedEvent.totalSteps : undefined,
    sessionId: typeof typedEvent.sessionId === 'string' ? typedEvent.sessionId : undefined,
  }
}

function pickStreamErrorMessage(event: ChatStreamEvent): string | null {
  if (event.type !== 'error') {
    return null
  }

  const typedEvent = event as { message?: unknown }
  if (typeof typedEvent.message === 'string' && typedEvent.message.trim()) {
    return typedEvent.message
  }
  return '流式请求失败'
}

function resolveApiUrl(path: string): string {
  if (!API_BASE_URL) {
    return path
  }
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`
}

export function parseSseChunk(rawChunk: string): ChatStreamEvent | null {
  const lines = rawChunk.split('\n').map((line) => line.trimEnd())
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())

  if (!dataLines.length) {
    return null
  }

  const payloadText = dataLines.join('\n')
  if (!payloadText) {
    return null
  }

  const payload = JSON.parse(payloadText)
  return toCamelCase<ChatStreamEvent>(payload)
}

async function consumeSseStream(
  response: Response,
  options: ChatStreamOptions,
): Promise<ChatStreamDoneEvent> {
  if (!response.body) {
    throw new Error('流式返回为空')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let doneEvent: ChatStreamDoneEvent | null = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }

    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    buffer += decoder.decode(value, { stream: true })
    buffer = buffer.replaceAll('\r\n', '\n')

    let separatorIndex = buffer.indexOf('\n\n')
    while (separatorIndex >= 0) {
      const chunk = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)

      const event = parseSseChunk(chunk)
      if (event) {
        options.onEvent?.(event)
        const streamDoneEvent = coerceDoneEvent(event)
        if (streamDoneEvent) {
          doneEvent = streamDoneEvent
        }
        const streamErrorMessage = pickStreamErrorMessage(event)
        if (streamErrorMessage) {
          const message = streamErrorMessage
          throw new Error(message)
        }
      }

      separatorIndex = buffer.indexOf('\n\n')
    }
  }

  if (buffer.trim()) {
    const tailEvent = parseSseChunk(buffer)
    if (tailEvent) {
      options.onEvent?.(tailEvent)
      const streamDoneEvent = coerceDoneEvent(tailEvent)
      if (streamDoneEvent) {
        doneEvent = streamDoneEvent
      }
      const streamErrorMessage = pickStreamErrorMessage(tailEvent)
      if (streamErrorMessage) {
        const message = streamErrorMessage
        throw new Error(message)
      }
    }
  }

  if (!doneEvent) {
    throw new Error('流式返回不完整')
  }

  return doneEvent
}

export const agentApi = {
  getSkills: async (): Promise<ChatSkillsResponse> => {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/agent/skills')
    const data = toCamelCase<{ skills?: ChatSkill[]; defaultSkillId?: string }>(response.data)
    return {
      skills: (data.skills || []).map((item) => toCamelCase<ChatSkill>(item)),
      defaultSkillId: data.defaultSkillId || '',
    }
  },

  chat: async (payload: ChatRequestPayload): Promise<ChatResponse> => {
    const response = await apiClient.post<Record<string, unknown>>('/api/v1/agent/chat', {
      message: payload.message,
      session_id: payload.sessionId,
      skills: payload.skills,
      context: payload.context,
    })
    return toCamelCase<ChatResponse>(response.data)
  },

  chatStream: async (payload: ChatRequestPayload, options: ChatStreamOptions = {}): Promise<ChatResponse> => {
    const response = await fetch(resolveApiUrl('/api/v1/agent/chat/stream'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: payload.message,
        session_id: payload.sessionId,
        skills: payload.skills,
        context: payload.context,
      }),
      signal: options.signal,
    })

    if (!response.ok) {
      const bodyText = await response.text()
      const error = new Error(bodyText || `流式请求失败 (${response.status})`)
      ;(error as Error & { response?: { status: number; data: { message: string } } }).response = {
        status: response.status,
        data: {
          message: bodyText || `流式请求失败 (${response.status})`,
        },
      }
      throw error
    }

    const doneEvent = await consumeSseStream(response, options)
    return {
      success: doneEvent.success,
      content: doneEvent.content || '',
      sessionId: doneEvent.sessionId || payload.sessionId || '',
      error: doneEvent.error,
    }
  },

  getChatSessions: async (limit = 50): Promise<ChatSessionItem[]> => {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/agent/chat/sessions', {
      params: { limit },
    })

    const data = toCamelCase<ChatSessionListResponse>(response.data)
    return (data.sessions || []).map((session) => toCamelCase<ChatSessionItem>(session))
  },

  getChatSessionMessages: async (sessionId: string, limit = 100): Promise<ChatSessionMessage[]> => {
    const safeSessionId = encodeURIComponent(sessionId)
    const response = await apiClient.get<Record<string, unknown>>(`/api/v1/agent/chat/sessions/${safeSessionId}`, {
      params: { limit },
    })

    const data = toCamelCase<ChatSessionMessagesResponse>(response.data)
    return (data.messages || []).map((message) => toCamelCase<ChatSessionMessage>(message))
  },

  deleteChatSession: async (sessionId: string): Promise<{ deleted: number }> => {
    const safeSessionId = encodeURIComponent(sessionId)
    const response = await apiClient.delete<Record<string, unknown>>(`/api/v1/agent/chat/sessions/${safeSessionId}`)
    return toCamelCase<{ deleted: number }>(response.data)
  },

  sendChat: async (content: string, title?: string): Promise<{ success: true }> => {
    const response = await apiClient.post<Record<string, unknown>>('/api/v1/agent/chat/send', {
      content,
      ...(title ? { title } : {}),
    })

    const data = toCamelCase<ChatSendResponse>(response.data)
    if (data.success === false) {
      const apiError = new Error(data.message || data.error || '发送失败')
      ;(apiError as Error & { response?: { status: number; data: Record<string, unknown> } }).response = {
        status: 400,
        data: {
          message: data.message || data.error || '发送失败',
          error: data.error || 'send_failed',
        },
      }
      throw apiError
    }

    return { success: true }
  },
}
