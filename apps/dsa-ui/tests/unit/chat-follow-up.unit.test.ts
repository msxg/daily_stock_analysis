import { describe, expect, it } from 'vitest'
import {
  buildChatFollowUpContext,
  buildFollowUpPrompt,
  parseFollowUpRecordId,
  sanitizeFollowUpStockCode,
  sanitizeFollowUpStockName,
} from '@/features/chat/utils/followUp'

describe('chat follow-up utils', () => {
  it('parses valid record id and rejects invalid values', () => {
    expect(parseFollowUpRecordId('101')).toBe(101)
    expect(parseFollowUpRecordId('0')).toBeUndefined()
    expect(parseFollowUpRecordId('abc')).toBeUndefined()
  })

  it('sanitizes stock code and stock name', () => {
    expect(sanitizeFollowUpStockCode('600519')).toBe('600519')
    expect(sanitizeFollowUpStockCode('@@@')).toBeNull()

    expect(sanitizeFollowUpStockName(' 贵州 茅台 ')).toBe('贵州 茅台')
    expect(sanitizeFollowUpStockName('\n')).toBeNull()
  })

  it('builds prompt and context from analysis report', () => {
    const prompt = buildFollowUpPrompt('600519', '贵州茅台')
    expect(prompt).toContain('贵州茅台(600519)')

    const context = buildChatFollowUpContext(
      '600519',
      '贵州茅台',
      {
        meta: {
          queryId: 'q-1',
          stockCode: '600519',
          stockName: '贵州茅台',
          reportType: 'detailed',
          createdAt: '2026-03-26T10:00:00+08:00',
          currentPrice: 1820,
          changePct: 1.2,
        },
        summary: {
          analysisSummary: '趋势偏多',
          operationAdvice: '分批布局',
          trendPrediction: '短线偏强',
          sentimentScore: 68,
        },
      },
    )

    expect(context.stock_code).toBe('600519')
    expect(context.previous_price).toBe(1820)
    expect(context.previous_analysis_summary).toMatchObject({
      analysisSummary: '趋势偏多',
    })
  })
})
