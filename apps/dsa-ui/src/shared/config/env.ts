const configuredApiBaseUrl = import.meta.env.VITE_API_URL?.trim()

// Keep same-origin API by default for static deployment and local preview.
export const API_BASE_URL = configuredApiBaseUrl || ''
