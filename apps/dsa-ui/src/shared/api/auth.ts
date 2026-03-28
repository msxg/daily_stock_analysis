import { apiClient } from '@/shared/api/client'
import { getParsedApiError } from '@/shared/api/error'
import { toCamelCase } from '@/shared/api/utils'
import type {
  AuthMeResponse,
  AuthStatusResponse,
  AuthUserProfile,
  CreateAuthUserPayload,
  ResetAuthUserPasswordPayload,
} from '@/shared/types/auth'

export const authApi = {
  async getStatus(): Promise<AuthStatusResponse> {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/auth/status')
    return toCamelCase<AuthStatusResponse>(response.data)
  },

  async getMe(): Promise<AuthMeResponse> {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/auth/me')
    return toCamelCase<AuthMeResponse>(response.data)
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

  async login(username: string, password: string, passwordConfirm?: string): Promise<void> {
    const body: { username: string; password: string; passwordConfirm?: string } = { username, password }
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

  async listUsers(): Promise<{ users: AuthUserProfile[] }> {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/auth/users')
    return toCamelCase<{ users: AuthUserProfile[] }>(response.data)
  },

  async createUser(payload: CreateAuthUserPayload): Promise<{ user: AuthUserProfile }> {
    const response = await apiClient.post<Record<string, unknown>>('/api/v1/auth/users', payload)
    return toCamelCase<{ user: AuthUserProfile }>(response.data)
  },

  async resetUserPassword(userId: number, payload: ResetAuthUserPasswordPayload): Promise<void> {
    await apiClient.post(`/api/v1/auth/users/${userId}/reset-password`, payload)
  },

  async deleteUser(userId: number): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/auth/users/${userId}`)
      return
    } catch (error) {
      const parsedError = getParsedApiError(error)
      if (parsedError.status !== 405) {
        throw error
      }
    }

    // Compatibility fallback for environments/proxies that do not allow DELETE.
    await apiClient.post(`/api/v1/auth/users/${userId}/delete`)
  },
}
