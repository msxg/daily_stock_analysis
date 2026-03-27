import { useLayoutEffect, useState, type PropsWithChildren } from 'react'
import { ThemeContext } from '@/app/providers/themeContext'
import {
  DEFAULT_THEME_ID,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  resolveThemeId,
  type ThemeId,
} from '@/shared/theme/themeCatalog'

function readStoredTheme(): ThemeId {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_ID
  }

  return resolveThemeId(window.localStorage.getItem(THEME_STORAGE_KEY))
}

function applyTheme(themeId: ThemeId) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = themeId
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<ThemeId>(() => readStoredTheme())

  useLayoutEffect(() => {
    applyTheme(theme)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  }, [theme])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themes: THEME_OPTIONS,
        setTheme: (themeId) => setThemeState(resolveThemeId(themeId)),
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
