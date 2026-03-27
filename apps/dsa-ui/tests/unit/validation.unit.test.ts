import { describe, expect, it } from 'vitest'
import { isObviouslyInvalidStockQuery, looksLikeStockCode, validateStockCode } from '@/shared/utils/validation'

describe('stock validation helpers', () => {
  it('recognizes common stock code formats', () => {
    expect(looksLikeStockCode('600519')).toBe(true)
    expect(looksLikeStockCode('hk00700')).toBe(true)
    expect(looksLikeStockCode('AAPL')).toBe(true)
  })

  it('rejects invalid stock code format', () => {
    const result = validateStockCode('ABC123')
    expect(result.valid).toBe(false)
    expect(result.message).toBe('股票代码格式不正确')
  })

  it('blocks obviously invalid mixed query input', () => {
    expect(isObviouslyInvalidStockQuery('贵州茅台@123')).toBe(true)
    expect(isObviouslyInvalidStockQuery('茅台')).toBe(false)
  })
})
