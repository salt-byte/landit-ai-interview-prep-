import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || ''
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''

/**
 * Whether the build actually received Supabase credentials.
 *
 * Vite inlines VITE_* at build time, so a deploy whose env vars are missing
 * (or set for the wrong environment) ships a bundle that can never authenticate.
 * Without this flag the placeholder client below fails as a plain network error,
 * which is indistinguishable from "Supabase is down" — so the login screen
 * reports a config problem as an outage. Export it and say which one it is.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Host the auth requests actually go to — shown in errors so a wrong URL is obvious. */
export const supabaseHost = (() => {
  try {
    return new URL(supabaseUrl).host
  } catch {
    return supabaseUrl || '(not set)'
  }
})()

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. ' +
      'Set them in the deployment environment and redeploy — Vite bakes them in at build time.',
  )
}

// Use a placeholder URL to prevent createClient from crashing when env vars are missing
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
)
