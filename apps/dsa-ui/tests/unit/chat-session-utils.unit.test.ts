import { describe, expect, it } from 'vitest'
import type { ChatSessionItem } from '@/shared/types/chat'
import {
  createLocalSessionId,
  mergeSessionsWithDraft,
  normalizeSessionTitle,
  truncateSessionTitle,
} from '@/features/chat/utils/session'

describe('chat session utils', () => {
  it('creates local session ids with expected prefix', () => {
    const sessionId = createLocalSessionId()
    expect(sessionId.startsWith('local-')).toBe(true)
    expect(sessionId.length).toBeGreaterThan(10)
  })

  it('adds draft session when current id is not in server sessions', () => {
    const sessions: ChatSessionItem[] = [
      {
        sessionId: 'session-001',
        title: '技术分析复盘',
        messageCount: 2,
        createdAt: '2026-03-26T09:10:00+08:00',
        lastActive: '2026-03-26T09:20:00+08:00',
      },
    ]

    const merged = mergeSessionsWithDraft('local-abc', sessions, '2026-03-26T10:00:00+08:00')
    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({
      sessionId: 'local-abc',
      title: '新会话',
      messageCount: 0,
    })
  })

  it('normalizes session title with fallback', () => {
    expect(normalizeSessionTitle('  技术分析复盘  ')).toBe('技术分析复盘')
    expect(normalizeSessionTitle('', '新会话')).toBe('新会话')
  })

  it('truncates session title with length cap', () => {
    expect(truncateSessionTitle('短标题', 8)).toBe('短标题')
    expect(truncateSessionTitle('这是一个非常非常非常长的会话标题', 12)).toBe('这是一个非常非常非...')
    expect(truncateSessionTitle('', 12, '新会话')).toBe('新会话')
  })
})
