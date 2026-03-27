export const getRecentStartDate = (days: number): string => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(date)
}

export const getTodayInShanghai = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())

export const formatDateTime = (value?: string): string => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
