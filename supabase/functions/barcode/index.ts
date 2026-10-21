// POST { ean } -> { food } | { food: null, prefill: { name?, brand? } }
// Our base first (the caller's own foods, then public ones), else Open Food Facts, cached as a public food.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { nameOf, servingOf, toFood, type OffProduct } from './off.ts'

// OFF asks every app to identify itself: https://openfoodfacts.github.io/openfoodfacts-server/api/
const UA = Deno.env.get('OFF_USER_AGENT') ?? 'CookingApp/0.1 (dev build)'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const FOOD = '*, servings(id, label, grams)'

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'auth' }, 401)

  const body = await req.json().catch(() => null)
  const ean = typeof body?.ean === 'string' ? body.ean.trim() : ''
  if (!/^\d{8,14}$/.test(ean)) return json({ error: 'ean' }, 400)

  // RLS: the caller sees public foods + their own; their own version wins.
  const { data: known } = await userClient.from('foods').select(FOOD).eq('barcode', ean)
    .order('owner_id', { ascending: true, nullsFirst: false }).limit(1)
  if (known?.length) return json({ food: known[0] })

  let product: OffProduct | null = null
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,product_name_fr,brands,nutriments,serving_size,serving_quantity`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8_000) },
    )
    if (res.ok) {
      const d = await res.json()
      if (d?.status === 1) product = d.product
    } else if (res.status !== 404) return json({ error: 'network' }, 502)
  } catch {
    return json({ error: 'network' }, 502)
  }
  if (!product) return json({ food: null, prefill: {} })

  const row = toFood(ean, product)
  if (!row) return json({ food: null, prefill: { name: nameOf(product) || undefined, brand: product.brands?.split(',')[0].trim() || undefined } })

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // two people scanning the same new product at once: the unique index keeps one row
  const { error: insErr } = await admin.from('foods').insert(row)
  if (insErr && insErr.code !== '23505') return json({ error: 'db' }, 500) // 23505 = already cached
  const { data: food } = await admin.from('foods').select(FOOD).eq('source', 'off').eq('source_ref', ean).single()
  if (!food) return json({ error: 'db' }, 500)
  const serving = servingOf(product)
  if (serving && !food.servings.length) {
    const { data: s } = await admin.from('servings').insert({ ...serving, food_id: food.id }).select('id, label, grams').single()
    if (s) food.servings.push(s)
  }
  return json({ food })
})
