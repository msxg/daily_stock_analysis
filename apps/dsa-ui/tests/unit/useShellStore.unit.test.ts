import { beforeEach, describe, expect, it } from 'vitest'
import { useShellStore } from '@/shared/store/useShellStore'

describe('useShellStore', () => {
  beforeEach(() => {
    useShellStore.setState({ mobileMenuOpen: false })
  })

  it('opens and closes the mobile menu', () => {
    useShellStore.getState().openMobileMenu()
    expect(useShellStore.getState().mobileMenuOpen).toBe(true)

    useShellStore.getState().closeMobileMenu()
    expect(useShellStore.getState().mobileMenuOpen).toBe(false)
  })

  it('toggles mobile menu state', () => {
    useShellStore.getState().toggleMobileMenu()
    expect(useShellStore.getState().mobileMenuOpen).toBe(true)

    useShellStore.getState().toggleMobileMenu()
    expect(useShellStore.getState().mobileMenuOpen).toBe(false)
  })
})
