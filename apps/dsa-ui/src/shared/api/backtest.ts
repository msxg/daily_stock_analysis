import { apiClient } from '@/shared/api/client'
import { toCamelCase } from '@/shared/api/utils'
import type {
  BacktestRunRequest,
  BacktestRunResponse,
  BacktestResultsResponse,
  BacktestResultItem,
  PerformanceMetrics,
} from '@/shared/types/backtest'

export const backtestApi = {
  run: async (params: BacktestRunRequest = {}): Promise<BacktestRunResponse> => {
    const requestData: Record<string, unknown> = {}
    if (params.code) requestData.code = params.code
    if (params.force) requestData.force = params.force
    if (params.evalWindowDays) requestData.eval_window_days = params.evalWindowDays
    if (params.minAgeDays != null) requestData.min_age_days = params.minAgeDays
    if (params.limit) requestData.limit = params.limit

    const response = await apiClient.post<Record<string, unknown>>('/api/v1/backtest/run', requestData)
    return toCamelCase<BacktestRunResponse>(response.data)
  },

  getResults: async (params: { code?: string; evalWindowDays?: number; page?: number; limit?: number } = {}): Promise<BacktestResultsResponse> => {
    const { code, evalWindowDays, page = 1, limit = 20 } = params

    const queryParams: Record<string, string | number> = { page, limit }
    if (code) queryParams.code = code
    if (evalWindowDays) queryParams.eval_window_days = evalWindowDays

    const response = await apiClient.get<Record<string, unknown>>('/api/v1/backtest/results', { params: queryParams })
    const data = toCamelCase<BacktestResultsResponse>(response.data)
    return {
      total: data.total,
      page: data.page,
      limit: data.limit,
      items: (data.items || []).map((item) => toCamelCase<BacktestResultItem>(item)),
    }
  },

  getOverallPerformance: async (evalWindowDays?: number): Promise<PerformanceMetrics | null> => {
    try {
      const params: Record<string, number> = {}
      if (evalWindowDays) params.eval_window_days = evalWindowDays
      const response = await apiClient.get<Record<string, unknown>>('/api/v1/backtest/performance', { params })
      return toCamelCase<PerformanceMetrics>(response.data)
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } }
        if (axiosError.response?.status === 404) return null
      }
      throw error
    }
  },

  getStockPerformance: async (code: string, evalWindowDays?: number): Promise<PerformanceMetrics | null> => {
    try {
      const params: Record<string, number> = {}
      if (evalWindowDays) params.eval_window_days = evalWindowDays
      const response = await apiClient.get<Record<string, unknown>>(`/api/v1/backtest/performance/${encodeURIComponent(code)}`, { params })
      return toCamelCase<PerformanceMetrics>(response.data)
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } }
        if (axiosError.response?.status === 404) return null
      }
      throw error
    }
  },
}
