export interface ParsedApiError {
  title: string
  message: string
  rawMessage: string
  status?: number
}

type ErrorCarrier = {
  response?: {
    status?: number
    data?: unknown
    statusText?: string
  }
  message?: string
  parsedError?: ParsedApiError
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function extractPayloadMessage(data: unknown): string | null {
  if (typeof data === 'string') {
    return data.trim() || null
  }

  if (!isRecord(data)) {
    return null
  }

  const detail = data.detail
  if (isRecord(detail)) {
    return pickString(detail.message, detail.error, detail.reason)
  }

  return pickString(detail, data.message, data.error, data.title, data.reason)
}

export function parseApiError(error: unknown): ParsedApiError {
  const response = isRecord(error) ? (error as ErrorCarrier).response : undefined
  const status = response?.status
  const payloadMessage = extractPayloadMessage(response?.data)
  const rawMessage =
    pickString(payloadMessage, response?.statusText, (error as ErrorCarrier | undefined)?.message) || '请求失败，请稍后重试。'

  if (status === 401) {
    return {
      title: '登录已过期',
      message: '请重新登录后继续操作。',
      rawMessage,
      status,
    }
  }

  if (status === 403) {
    return {
      title: '无权限访问',
      message: '当前账号没有该操作权限。',
      rawMessage,
      status,
    }
  }

  if (status === 404) {
    return {
      title: '资源不存在',
      message: '请求的资源不存在或已被删除。',
      rawMessage,
      status,
    }
  }

  if (status && status >= 500) {
    return {
      title: '服务暂时不可用',
      message: '服务器处理失败，请稍后重试。',
      rawMessage,
      status,
    }
  }

  return {
    title: '请求失败',
    message: rawMessage,
    rawMessage,
    status,
  }
}

export function attachParsedApiError(error: unknown): ParsedApiError {
  const parsed = parseApiError(error)
  if (isRecord(error)) {
    ;(error as ErrorCarrier).parsedError = parsed
  }
  return parsed
}

export function getParsedApiError(error: unknown): ParsedApiError {
  if (isRecord(error)) {
    const parsed = (error as ErrorCarrier).parsedError
    if (parsed) {
      return parsed
    }
  }

  return parseApiError(error)
}
