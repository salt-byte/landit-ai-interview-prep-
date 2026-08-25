import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Vite inlines VITE_* at BUILD time. A value missing here means it was absent
// when `vite build` ran — on Vercel that includes "the variable was added but
// the project wasn't redeployed afterwards", which is easy to miss because the
// dashboard shows the variable as present.
//
// Values are trimmed and unquoted: copy-pasting from the Supabase dashboard
// into a shell/CI env editor routinely drags along a trailing newline or a pair
// of quotes, which would otherwise produce an invalid URL and a fetch failure
// indistinguishable from the server being down.
function readEnv(name: string): string {
  const raw = (import.meta as any).env?.[name]
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/^['"]|['"]$/g, '')
}

const supabaseUrl = readEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = readEnv('VITE_SUPABASE_ANON_KEY')

/**
 * Why the client can't possibly work, or null when the config looks sane.
 *
 * This only catches *configuration* problems detectable without a network call.
 * A non-null value means "don't blame the network" — surfacing it to the user
 * as "server unreachable" sends them debugging the wrong thing.
 */
export const supabaseConfigError: string | null = (() => {
  const missing: string[] = []
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL')
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY')
  if (missing.length) return `Missing ${missing.join(' and ')}`

  // A placeholder left over from .env.example is worse than a missing value:
  // it builds fine and fails only at the first auth call.
  if (supabaseUrl.includes('your-project')) return 'VITE_SUPABASE_URL still holds the .env.example placeholder'
  if (supabaseAnonKey.startsWith('your-')) return 'VITE_SUPABASE_ANON_KEY still holds the .env.example placeholder'

  try {
    const { protocol, hostname } = new URL(supabaseUrl)
    if (protocol !== 'https:') return `VITE_SUPABASE_URL must start with https:// (got "${protocol}//")`
    if (!hostname) return 'VITE_SUPABASE_URL has no hostname'
  } catch {
    return `VITE_SUPABASE_URL is not a valid URL ("${supabaseUrl}")`
  }

  return null
})()

export const isSupabaseConfigured = supabaseConfigError === null

if (supabaseConfigError) {
  console.error(
    `[supabase] Auth is disabled: ${supabaseConfigError}.\n` +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Supabase Dashboard > Settings > API) ' +
    'in .env for local dev, or in your host\'s environment variables — then rebuild/redeploy, ' +
    'since Vite bakes these into the bundle at build time.',
  )
}

// Fall back to a syntactically valid URL so createClient doesn't throw at module
// load and take the whole app down; guest mode and the rest of the UI still work.
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
)
