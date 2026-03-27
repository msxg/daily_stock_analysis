import { describe, expect, it } from 'vitest'
import { splitThinkingContent } from '@/features/chat/utils/message'

describe('chat message utils', () => {
  it('extracts think blocks from assistant content', () => {
    const parsed = splitThinkingContent('<think>先看趋势</think>\n\n**结论**：偏多')
    expect(parsed.thinking).toBe('先看趋势')
    expect(parsed.content).toContain('结论')
  })

  it('returns original content when no think block exists', () => {
    const parsed = splitThinkingContent('直接回复')
    expect(parsed.thinking).toBeNull()
    expect(parsed.content).toBe('直接回复')
  })
})
