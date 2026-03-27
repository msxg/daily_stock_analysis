import { createContext } from 'react'
import type { ThemeDefinition, ThemeId } from '@/shared/theme/themeCatalog'

export type ThemeContextValue = {
  theme: ThemeId
  setTheme: (themeId: ThemeId) => void
  themes: ThemeDefinition[]
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
