import NextAuth from "next-auth"
import type { NextAuthConfig, NextAuthResult } from "next-auth"
import Credentials from "next-auth/providers/credentials"

const isSystemRole = (role: unknown): role is "SUPER_ADMIN" | "USER" =>
  role === "SUPER_ADMIN" || role === "USER"

const authConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const res = await fetch(`${process.env.API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        })

        if (!res.ok) return null

        const data = await res.json()

        return {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          systemRole: data.user.systemRole,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          tenants: data.tenants,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.systemRole = user.systemRole
        token.accessToken = user.accessToken
        token.refreshToken = user.refreshToken
        token.tenants = user.tenants
      }
      return token
    },

    async session({ session, token }) {
      session.user.id = typeof token.id === "string" ? token.id : ""
      session.user.systemRole = isSystemRole(token.systemRole)
        ? token.systemRole
        : undefined
      session.accessToken =
        typeof token.accessToken === "string" ? token.accessToken : undefined
      session.tenants = Array.isArray(token.tenants) ? token.tenants : undefined
      return session
    },
  },

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig

const nextAuth: NextAuthResult = NextAuth(authConfig)

export const handlers: NextAuthResult["handlers"] = nextAuth.handlers
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut
export const auth: NextAuthResult["auth"] = nextAuth.auth
