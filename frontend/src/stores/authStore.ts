import { create } from "zustand"
import { posApi, setToken, getToken, type ApiUser } from "@/lib/api"
import type { Profile } from "@/types"

export interface AuthState {
  user: ApiUser | null
  profile: Profile | null
  isLoading: boolean
  error: string | null
  mustResetPassword: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  loadSession: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  error: null,
  mustResetPassword: false,

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const data = await posApi.login(email, password)
      setToken(data.token)
      set({
        user: data.user,
        profile: data.profile,
        mustResetPassword: data.must_reset_password,
        isLoading: false,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed"
      setToken(null)
      set({
        user: null,
        profile: null,
        mustResetPassword: false,
        isLoading: false,
        error: message,
      })
      throw err
    }
  },

  signOut: async () => {
    set({ isLoading: true })
    try {
      if (getToken()) await posApi.logout()
    } catch {
      /* ignore */
    }
    setToken(null)
    set({
      user: null,
      profile: null,
      mustResetPassword: false,
      isLoading: false,
      error: null,
    })
  },

  loadSession: async () => {
    set({ isLoading: true, error: null })
    try {
      if (!getToken()) {
        set({ user: null, profile: null, isLoading: false })
        return
      }
      const data = await posApi.me()
      set({
        user: data.user,
        profile: data.profile,
        mustResetPassword: data.must_reset_password,
        isLoading: false,
      })
    } catch (err) {
      console.error("Failed to load session:", err)
      setToken(null)
      set({
        user: null,
        profile: null,
        mustResetPassword: false,
        isLoading: false,
      })
    }
  },

  clearError: () => set({ error: null }),
}))
