export interface ParsedMessageContent {
  content: string
  thinking: string | null
}

const THINKING_BLOCK_PATTERN = /<think>([\s\S]*?)<\/think>/gi

export function splitThinkingContent(rawContent: string): ParsedMessageContent {
  if (!rawContent.trim()) {
    return { content: '', thinking: null }
  }

  const thinkingParts: string[] = []
  const content = rawContent.replace(THINKING_BLOCK_PATTERN, (_, thinkingBlock: string) => {
    const normalized = thinkingBlock.trim()
    if (normalized) {
      thinkingParts.push(normalized)
    }
    return ''
  })

  return {
    content: content.trim(),
    thinking: thinkingParts.length ? thinkingParts.join('\n\n') : null,
  }
}
