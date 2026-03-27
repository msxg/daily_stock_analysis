import { apiClient } from '@/shared/api/client'
import { toCamelCase } from '@/shared/api/utils'
import type { AuthStatusResponse } from '@/shared/types/auth'

export const authApi = {
  async getStatus(): Promise<AuthStatusResponse> {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/auth/status')
    return toCamelCase<AuthStatusResponse>(response.data)
  },

  async updateSettings(
    authEnabled: boolean,
    password?: string,
    passwordConfirm?: string,
    currentPassword?: string,
  ): Promise<AuthStatusResponse> {
    const body: {
      authEnabled: boolean
      password?: string
      passwordConfirm?: string
      currentPassword?: string
    } = { authEnabled }
    if (password !== undefined) body.password = password
    if (passwordConfirm !== undefined) body.passwordConfirm = passwordConfirm
    if (currentPassword !== undefined) body.currentPassword = currentPassword

    const response = await apiClient.post<Record<string, unknown>>('/api/v1/auth/settings', body)
    return toCamelCase<AuthStatusResponse>(response.data)
  },

  async login(password: string, passwordConfirm?: string): Promise<void> {
    const body: { password: string; passwordConfirm?: string } = { password }
    if (passwordConfirm !== undefined) {
      body.passwordConfirm = passwordConfirm
    }
    await apiClient.post('/api/v1/auth/login', body)
  },

  async changePassword(currentPassword: string, newPassword: string, newPasswordConfirm: string): Promise<void> {
    await apiClient.post('/api/v1/auth/change-password', {
      currentPassword,
      newPassword,
      newPasswordConfirm,
    })
  },

  async logout(): Promise<void> {
    await apiClient.post('/api/v1/auth/logout')
  },
}
