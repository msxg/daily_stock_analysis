import { create } from 'zustand'

type ShellState = {
  mobileMenuOpen: boolean
  openMobileMenu: () => void
  closeMobileMenu: () => void
  toggleMobileMenu: () => void
}

export const useShellStore = create<ShellState>((set) => ({
  mobileMenuOpen: false,
  openMobileMenu: () => set({ mobileMenuOpen: true }),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
  toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
}))
