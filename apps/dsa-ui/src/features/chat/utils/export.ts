import type { ChatSessionMessage } from '@/shared/types/chat'

function formatExportTimestamp(now: Date): string {
  return now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sanitizeFileName(input: string): string {
  return input.replace(/[\\/:*?"<>|]/g, '_').trim() || '问股会话'
}

export function buildChatSessionExportFilename(sessionLabel: string, now = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, '0')
  const safeLabel = sanitizeFileName(sessionLabel)
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${safeLabel}_${date}_${time}.md`
}

export function formatChatSessionAsMarkdown(
  messages: ChatSessionMessage[],
  sessionLabel = '问股会话',
  now = new Date(),
): string {
  const lines: string[] = ['# 问股会话', '', `会话标题: ${sessionLabel}`, `导出时间: ${formatExportTimestamp(now)}`, '']

  messages.forEach((message) => {
    const heading = message.role === 'user' ? '## 用户' : '## AI'
    lines.push(heading)
    lines.push('')
    lines.push(message.content || '（空内容）')
    lines.push('')
  })

  return lines.join('\n')
}

export function downloadChatSessionMarkdown(
  markdown: string,
  sessionLabel = '问股会话',
  now = new Date(),
): string {
  const filename = buildChatSessionExportFilename(sessionLabel, now)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(objectUrl)
  return filename
}
