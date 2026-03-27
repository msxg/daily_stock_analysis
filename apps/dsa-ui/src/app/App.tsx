import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from '@/app/providers/AppProviders'
import { createAppRouter } from '@/app/router'

export function App() {
  const [router] = useState(() => createAppRouter())

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
