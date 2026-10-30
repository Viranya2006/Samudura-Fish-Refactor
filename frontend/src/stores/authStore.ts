import { create } from "zustand"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { Profile } from "@/types"

export interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  loadSession: () => Promise<void>
  clearError: () => void
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()

  if (error) {
    console.error("Failed to fetch profile:", error)
    return null
  }
  return data as Profile
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  error: null,

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      if (!data.user) throw new Error("No user returned")

      const profile = await fetchProfile(data.user.id)
      set({
        user: data.user,
        profile,
        isLoading: false,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed"
      set({
        user: null,
        profile: null,
        isLoading: false,
        error: message,
      })
      throw err
    }
  },

  signOut: async () => {
    set({ isLoading: true })
    await supabase.auth.signOut()
    set({
      user: null,
      profile: null,
      isLoading: false,
      error: null,
    })
  },

  loadSession: async () => {
    set({ isLoading: true, error: null })
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) throw error

      if (!session?.user) {
        set({ user: null, profile: null, isLoading: false })
        return
      }

      const profile = await fetchProfile(session.user.id)
      set({
        user: session.user,
        profile,
        isLoading: false,
      })
    } catch (err) {
      console.error("Failed to load session:", err)
      set({
        user: null,
        profile: null,
        isLoading: false,
      })
    }
  },

  clearError: () => set({ error: null }),
}))
