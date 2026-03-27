export type ThemeId = 'mint' | 'rose'

export type ThemeDefinition = {
  id: ThemeId
  label: string
  description: string
  swatches: [string, string, string]
}

export const THEME_STORAGE_KEY = 'dsa-ui-theme'
export const DEFAULT_THEME_ID: ThemeId = 'rose'

export const THEME_OPTIONS: ThemeDefinition[] = [
  {
    id: 'rose',
    label: '玫瑰红',
    description: '强调动作反馈与重点信息，对关键操作更聚焦。',
    swatches: ['#fb7185', '#e11d48', '#ef4444'],
  },
  {
    id: 'mint',
    label: '浅绿',
    description: '清爽耐看，适合长时间浏览与高频查看信息。',
    swatches: ['#2dd4bf', '#0d9488', '#22c55e'],
  },
]

export function resolveThemeId(value: string | null | undefined): ThemeId {
  return THEME_OPTIONS.some((option) => option.id === value) ? (value as ThemeId) : DEFAULT_THEME_ID
}

export function getThemeDefinition(themeId: ThemeId): ThemeDefinition {
  return THEME_OPTIONS.find((option) => option.id === themeId) || THEME_OPTIONS[0]
}
