import type { ChatStreamEvent } from '@/shared/types/chat'

function pickText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

export function formatStreamEventLabel(event: ChatStreamEvent): string {
  if (event.type === 'thinking') {
    return pickText(event.message, '正在思考分析路径...')
  }

  if (event.type === 'tool_start') {
    return `执行工具：${pickText(event.displayName, pickText(event.tool, '未知工具'))}`
  }

  if (event.type === 'tool_done') {
    const toolName = pickText(event.displayName, pickText(event.tool, '未知工具'))
    const status = event.success === false ? '失败' : '完成'
    return `工具${status}：${toolName}`
  }

  if (event.type === 'generating') {
    return pickText(event.message, '正在生成最终回答...')
  }

  if (event.type === 'done') {
    return event.success ? '流式回答完成' : `流式回答失败：${pickText(event.error, '未知错误')}`
  }

  if (event.type === 'error') {
    return pickText(event.message, '流式请求失败')
  }

  return `事件：${event.type}`
}
