import axios from 'axios'
import { API_BASE_URL } from '@/shared/config/env'
import { attachParsedApiError } from '@/shared/api/error'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname + window.location.search
      if (!path.startsWith('/login')) {
        const redirect = encodeURIComponent(path)
        window.location.assign(`/login?redirect=${redirect}`)
      }
    }

    attachParsedApiError(error)
    return Promise.reject(error)
  },
)
