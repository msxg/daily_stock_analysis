import { describe, expect, it } from 'vitest'
import { buildChatSessionExportFilename, formatChatSessionAsMarkdown } from '@/features/chat/utils/export'

describe('chat export utils', () => {
  it('formats chat session messages as markdown', () => {
    const markdown = formatChatSessionAsMarkdown(
      [
        {
          id: 'u-1',
          role: 'user',
          content: '请分析贵州茅台短线趋势',
          createdAt: '2026-03-26T10:00:00+08:00',
        },
        {
          id: 'a-1',
          role: 'assistant',
          content: '短线偏强，建议回踩确认后分批配置。',
          createdAt: '2026-03-26T10:00:02+08:00',
        },
      ],
      '技术分析复盘',
      new Date('2026-03-26T10:01:00+08:00'),
    )

    expect(markdown).toContain('# 问股会话')
    expect(markdown).toContain('会话标题: 技术分析复盘')
    expect(markdown).toContain('## 用户')
    expect(markdown).toContain('## AI')
    expect(markdown).toContain('短线偏强')
  })

  it('builds a safe markdown filename', () => {
    const filename = buildChatSessionExportFilename('A/B 测试:会话', new Date('2026-03-26T08:09:00+08:00'))
    expect(filename).toBe('A_B 测试_会话_20260326_0809.md')
  })
})
