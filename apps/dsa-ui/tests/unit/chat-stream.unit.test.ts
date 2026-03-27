import { describe, expect, it } from 'vitest'
import { parseSseChunk } from '@/shared/api/agent'
import { formatStreamEventLabel } from '@/features/chat/utils/stream'

describe('chat stream utils', () => {
  it('parses sse chunks into camelCase events', () => {
    const chunk = 'data: {"type":"tool_done","display_name":"获取实时行情","success":true}\n\n'
    const event = parseSseChunk(chunk)
    expect(event).toMatchObject({
      type: 'tool_done',
      displayName: '获取实时行情',
      success: true,
    })
  })

  it('returns null when chunk has no data payload', () => {
    expect(parseSseChunk('event: ping')).toBeNull()
  })

  it('formats labels for different stream event types', () => {
    expect(formatStreamEventLabel({ type: 'thinking', message: '正在分析...' })).toContain('正在分析')
    expect(formatStreamEventLabel({ type: 'tool_start', displayName: '获取实时行情' })).toContain('获取实时行情')
    expect(formatStreamEventLabel({ type: 'tool_done', displayName: '获取实时行情', success: false })).toContain('失败')
    expect(formatStreamEventLabel({ type: 'done', success: true, content: 'ok' })).toContain('完成')
    expect(formatStreamEventLabel({ type: 'error', message: 'timeout' })).toContain('timeout')
  })
})
