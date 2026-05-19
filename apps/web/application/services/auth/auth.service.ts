// Auth application service placeholder.
// services/auth.service.ts
import axiosInstance from "@/shared/utils/axiosInstance"

export interface LoginRequest {
  email: string
  password: string
}

export interface Tenant {
  id: string
  name: string
  slug: string
  qrUrl: string
  role: string
  status: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    name: string
    email: string
    systemRole: string
  }
  tenants: Tenant[]
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

const AuthService = {
  login: async (payload: LoginRequest): Promise<LoginResponse> => {
    const { data } = await axiosInstance.post<LoginResponse>("/auth/login", payload)
    return data
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post("/auth/logout")
  },

  refresh: async (refreshToken: string): Promise<RefreshResponse> => {
    const { data } = await axiosInstance.post<RefreshResponse>("/auth/refresh", {
      refreshToken,
    })
    return data
  },

  me: async (): Promise<LoginResponse["user"]> => {
    const { data } = await axiosInstance.get<LoginResponse["user"]>("/auth/me")
    return data
  },
}

export default AuthService