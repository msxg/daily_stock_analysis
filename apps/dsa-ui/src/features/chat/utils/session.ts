import type { ChatSessionItem } from '@/shared/types/chat'

export const CHAT_SESSION_STORAGE_KEY = 'dsa_ui_chat_session_id'

export function createLocalSessionId(): string {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
  return `local-${randomPart}`
}

export function mergeSessionsWithDraft(
  currentSessionId: string,
  sessions: ChatSessionItem[],
  nowISO = new Date().toISOString(),
): ChatSessionItem[] {
  if (!currentSessionId) return sessions
  if (sessions.some((session) => session.sessionId === currentSessionId)) return sessions

  return [
    {
      sessionId: currentSessionId,
      title: '新会话',
      messageCount: 0,
      createdAt: nowISO,
      lastActive: nowISO,
    },
    ...sessions,
  ]
}

export function getInitialSessionIdFromStorage(storageValue: string | null): string {
  return storageValue?.trim() || createLocalSessionId()
}

export function normalizeSessionTitle(title: string | null | undefined, fallback = '未命名会话'): string {
  const trimmed = String(title || '').trim()
  return trimmed || fallback
}

export function truncateSessionTitle(
  title: string | null | undefined,
  maxLength = 24,
  fallback = '未命名会话',
): string {
  const normalized = normalizeSessionTitle(title, fallback)
  const safeLength = Number.isFinite(maxLength) ? Math.max(4, Math.floor(maxLength)) : 24
  if (normalized.length <= safeLength) return normalized
  return `${normalized.slice(0, safeLength - 3)}...`
}
