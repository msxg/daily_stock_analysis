import { describe, expect, it } from 'vitest'
import { toCamelCase } from '@/shared/api/utils'

describe('toCamelCase', () => {
  it('converts nested snake_case payload to camelCase', () => {
    const payload = {
      stock_code: '600519',
      created_at: '2026-03-26T09:30:00+08:00',
      summary: {
        operation_advice: '持有',
      },
      history_items: [
        {
          query_id: 'q-1',
        },
      ],
    }

    const parsed = toCamelCase<{
      stockCode: string
      createdAt: string
      summary: { operationAdvice: string }
      historyItems: Array<{ queryId: string }>
    }>(payload)

    expect(parsed.stockCode).toBe('600519')
    expect(parsed.createdAt).toBe('2026-03-26T09:30:00+08:00')
    expect(parsed.summary.operationAdvice).toBe('持有')
    expect(parsed.historyItems[0].queryId).toBe('q-1')
  })
})
