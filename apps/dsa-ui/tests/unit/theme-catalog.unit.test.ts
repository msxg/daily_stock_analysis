import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID, THEME_OPTIONS, getThemeDefinition, resolveThemeId } from '@/shared/theme/themeCatalog'

describe('theme catalog', () => {
  it('falls back to the default theme when stored value is invalid', () => {
    expect(resolveThemeId('mint')).toBe('mint')
    expect(resolveThemeId('rose')).toBe('rose')
    expect(resolveThemeId('unknown-theme')).toBe(DEFAULT_THEME_ID)
    expect(resolveThemeId(null)).toBe(DEFAULT_THEME_ID)
  })

  it('exposes the registered theme definitions', () => {
    expect(THEME_OPTIONS).toHaveLength(2)
    expect(getThemeDefinition('mint').label).toBe('浅绿')
    expect(getThemeDefinition('rose').label).toBe('玫瑰红')
  })
})
