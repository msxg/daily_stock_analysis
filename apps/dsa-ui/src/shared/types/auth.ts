export interface AuthStatusResponse {
  authEnabled: boolean
  loggedIn: boolean
  passwordSet?: boolean
  passwordChangeable?: boolean
  setupState: 'enabled' | 'password_retained' | 'no_password'
}

export interface AuthUserProfile {
  id: number
  username: string
  displayName: string
  email?: string
  status?: string
  isSystemAdmin: boolean
  createdAt?: string | null
}

export interface CreateAuthUserPayload {
  username: string
  password: string
  passwordConfirm: string
  displayName?: string
  email?: string
  isSystemAdmin?: boolean
}

export interface ResetAuthUserPasswordPayload {
  newPassword: string
  newPasswordConfirm: string
}

export interface AuthMeUser {
  id: number
  username: string
  displayName: string
  email?: string
  isSystemAdmin: boolean
}

export interface AuthTenantContext {
  id: number
  slug: string
  name: string
  role: string
}

export interface AuthMeResponse {
  authenticated: boolean
  authEnabled: boolean
  user: AuthMeUser | null
  activeTenant: AuthTenantContext | null
  availableTenants: AuthTenantContext[]
  capabilities: string[]
}
