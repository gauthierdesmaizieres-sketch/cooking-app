import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing: copy .env.example to .env.local')

// implicit: the email link carries the session itself, so it works in whatever browser opens it (Gmail's
// in-app browser, Chrome, the installed app). PKCE needed the very browser that asked for the link, and the
// free Supabase plan can't put a typed code in the email instead.
export const supabase = createClient(url, key, { auth: { flowType: 'implicit' } })
