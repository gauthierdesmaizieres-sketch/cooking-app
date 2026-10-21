// POST -> 204. Deletes the caller's photos, then the auth user (every table cascades from auth.users).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return new Response(null, { status: 401, headers: cors })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Storage objects don't cascade from auth.users: remove them first, page by page.
  for (let page = 0; page < 100; page++) {
    const { data, error } = await admin.storage.from('photos').list(user.id, { limit: 1000 })
    if (error) return new Response(null, { status: 500, headers: cors })
    if (!data.length) break
    const { error: rmErr } = await admin.storage.from('photos').remove(data.map(f => `${user.id}/${f.name}`))
    if (rmErr) return new Response(null, { status: 500, headers: cors })
  }
  const { error } = await admin.auth.admin.deleteUser(user.id)
  return new Response(null, { status: error ? 500 : 204, headers: cors })
})
