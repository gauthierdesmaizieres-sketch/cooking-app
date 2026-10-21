import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing: copy .env.example to .env.local')

// Read before supabase-js consumes it: we arrived from an email link (?code=…). If we still end up signed
// out, the exchange failed (link opened in another browser than the one that asked for it).
export const arrivedFromLink = new URLSearchParams(location.search).has('code')

// pkce: the magic link comes back as ?code=…, which leaves our #/hash routes alone.
export const supabase = createClient(url, key, { auth: { flowType: 'pkce' } })
