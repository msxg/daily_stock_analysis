export interface AuthStatusResponse {
  authEnabled: boolean
  loggedIn: boolean
  passwordSet?: boolean
  passwordChangeable?: boolean
  setupState: 'enabled' | 'password_retained' | 'no_password'
}
