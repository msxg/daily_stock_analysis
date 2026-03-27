export type ChatMessageRole = 'user' | 'assistant' | 'system' | string

export interface ChatSkill {
  id: string
  name: string
  description: string
}

export interface ChatSessionItem {
  sessionId: string
  title: string
  messageCount: number
  createdAt: string | null
  lastActive: string | null
}

export interface ChatSessionMessage {
  id: string
  role: ChatMessageRole
  content: string
  createdAt: string | null
}

export interface ChatSessionListResponse {
  sessions: ChatSessionItem[]
}

export interface ChatSessionMessagesResponse {
  sessionId: string
  messages: ChatSessionMessage[]
}

export interface ChatSendResponse {
  success: boolean
  error?: string
  message?: string
}

export interface ChatSkillsResponse {
  skills: ChatSkill[]
  defaultSkillId: string
}

export interface ChatRequestPayload {
  message: string
  sessionId?: string
  skills?: string[]
  context?: Record<string, unknown>
}

export interface ChatResponse {
  success: boolean
  content: string
  sessionId: string
  error?: string
}

export interface ChatStreamThinkingEvent {
  type: 'thinking'
  step?: number
  message?: string
}

export interface ChatStreamToolStartEvent {
  type: 'tool_start'
  step?: number
  tool?: string
  displayName?: string
}

export interface ChatStreamToolDoneEvent {
  type: 'tool_done'
  step?: number
  tool?: string
  displayName?: string
  success?: boolean
  duration?: number
}

export interface ChatStreamGeneratingEvent {
  type: 'generating'
  step?: number
  message?: string
}

export interface ChatStreamDoneEvent {
  type: 'done'
  success: boolean
  content: string
  error?: string
  totalSteps?: number
  sessionId?: string
}

export interface ChatStreamErrorEvent {
  type: 'error'
  message?: string
}

export interface ChatStreamUnknownEvent {
  type: string
  [key: string]: unknown
}

export type ChatStreamEvent =
  | ChatStreamThinkingEvent
  | ChatStreamToolStartEvent
  | ChatStreamToolDoneEvent
  | ChatStreamGeneratingEvent
  | ChatStreamDoneEvent
  | ChatStreamErrorEvent
  | ChatStreamUnknownEvent
