import type { DefaultSession } from "next-auth"

type SystemRole = "SUPER_ADMIN" | "USER"

type TenantMembership = {
  id: string
  name: string
  slug: string
  qrUrl: string
  role: "OWNER" | "ADMIN" | "STAFF"
  status: "INVITED" | "ACTIVE" | "DISABLED"
}

declare module "next-auth" {
  interface Session {
    accessToken?: string
    tenants?: TenantMembership[]
    user: {
      id: string
      systemRole?: SystemRole
    } & DefaultSession["user"]
  }

  interface User {
    systemRole?: SystemRole
    accessToken?: string
    refreshToken?: string
    tenants?: TenantMembership[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    systemRole?: SystemRole
    accessToken?: string
    refreshToken?: string
    tenants?: TenantMembership[]
  }
}
