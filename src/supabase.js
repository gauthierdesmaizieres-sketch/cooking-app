import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing: copy .env.example to .env.local')

// pkce: the magic link comes back as ?code=…, which leaves our #/hash routes alone.
export const supabase = createClient(url, key, { auth: { flowType: 'pkce' } })
