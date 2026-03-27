import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { queryClient } from '@/app/providers/queryClient'
import { server } from '../../tests/mocks/server'

class ResizeObserverMock {
  observe() {
    // no-op in test runtime
  }

  unobserve() {
    // no-op in test runtime
  }

  disconnect() {
    // no-op in test runtime
  }
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  queryClient.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  delete document.documentElement.dataset.theme
})

afterAll(() => {
  server.close()
})

if (!window.ResizeObserver) {
  // Lightweight charts depends on ResizeObserver.
  window.ResizeObserver = ResizeObserverMock as typeof window.ResizeObserver
}

if (!window.matchMedia) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }))
}

if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:test-object-url',
    writable: true,
  })
}

if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => undefined,
    writable: true,
  })
}
