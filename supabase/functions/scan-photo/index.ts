// POST { photo_path } -> { scan_id, items: [{ key, label, grams, per100, confidence, food_id }] }
// The photo is already in the private "photos" bucket under <uid>/. A vision model (Gemini or Claude) estimates each food.
import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { checkItems, type RawItem } from './validate.ts'

const PROVIDER = Deno.env.get('AI_PROVIDER') === 'claude' ? 'claude' : 'gemini'
const MODEL = Deno.env.get('AI_MODEL') || (PROVIDER === 'gemini' ? 'gemini-3.6-flash' : 'claude-opus-5-5')
// Free-tier Gemini models are often overloaded (503): try a lighter one before giving up.
const GEMINI_FALLBACK = 'gemini-3.5-flash-lite'
const DAILY_LIMIT = Number(Deno.env.get('SCAN_DAILY_LIMIT') ?? 30)
const MAX_BYTES = 5 * 1024 * 1024
const MEDIA = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const PROMPT = `Tu analyses la photo d'un repas pour un journal alimentaire.
Liste chaque aliment visible séparément (ex. riz, poulet, sauce, légumes), avec un nom court en français.
Pour chacun, estime la quantité en grammes telle que servie, puis les kcal, glucides, protéines et lipides de cette quantité.
Tiens compte de l'huile ou de la sauce visibles. confidence va de 0 à 1 et reflète ta certitude sur l'aliment et la quantité.
Si la photo ne montre pas de nourriture, renvoie une liste vide.`

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          carbs: { type: 'number' },
          protein: { type: 'number' },
          fat: { type: 'number' },
          confidence: { type: 'number' },
        },
        required: ['label', 'grams', 'kcal', 'carbs', 'protein', 'fat', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
}

class AiError extends Error {
  constructor(public code: string, public status: number, detail?: string) { super(detail ?? code) }
}

// Gemini Interactions API (REST). Free tier: Google may use the inputs to improve its products.
async function askGemini(data: string, mime: string): Promise<RawItem[]> {
  const models = [...new Set([MODEL, GEMINI_FALLBACK])]
  for (const [i, model] of models.entries()) {
    try {
      return await askGeminiModel(model, data, mime)
    } catch (e) {
      const overloaded = e instanceof AiError && e.code === 'busy'
      if (!overloaded || i === models.length - 1) throw e
    }
  }
  throw new AiError('ai', 502)
}

async function askGeminiModel(model: string, data: string, mime: string): Promise<RawItem[]> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new AiError('ai', 502, 'GEMINI_API_KEY missing')
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: [{ type: 'text', text: PROMPT }, { type: 'image', data, mime_type: mime }],
      response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
    }),
    signal: AbortSignal.timeout(55_000), // free tier answers in 20–40 s
  }).catch(e => {
    throw e?.name === 'TimeoutError' ? new AiError('busy', 503, `${model} timeout`) : e
  })
  if (res.status === 429 || res.status === 503) throw new AiError('busy', 503, `${model} ${res.status}`)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new AiError('ai', 502, `${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`)
  if (body?.status === 'incomplete') throw new AiError('truncated', 502)
  if (body?.status !== 'completed') throw new AiError('refused', 422, JSON.stringify(body?.errors ?? body?.status))
  // deno-lint-ignore no-explicit-any
  const text = body.output_text ?? (body.steps ?? []).filter((s: any) => s.type === 'model_output')
    // deno-lint-ignore no-explicit-any
    .flatMap((s: any) => s.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
  return JSON.parse(text || '{}').items ?? []
}

async function askClaude(data: string, mime: string): Promise<RawItem[]> {
  const anthropic = new Anthropic() // ANTHROPIC_API_KEY from function secrets
  try {
    const res = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg', data } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })
    if (res.stop_reason === 'refusal') throw new AiError('refused', 422)
    if (res.stop_reason === 'max_tokens') throw new AiError('truncated', 502)
    const text = res.content.find(b => b.type === 'text')
    return JSON.parse(text && text.type === 'text' ? text.text : '{}').items ?? []
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiError('busy', 503)
    if (e instanceof Anthropic.APIError) throw new AiError('ai', 502, `${e.status} ${e.message}`)
    throw e
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'auth' }, 401)
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const body = await req.json().catch(() => null)
  const path = typeof body?.photo_path === 'string' ? body.photo_path : ''
  const m = path.match(/^([0-9a-f-]{36})\/[\w-]{1,64}\.(jpg|jpeg|png|webp)$/i)
  if (!m || m[1] !== user.id) return json({ error: 'photo_path' }, 400)

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await admin.from('photo_scans').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).gte('created_at', since)
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: 'limit' }, 429)

  const { data: file, error: dlErr } = await admin.storage.from('photos').download(path)
  if (dlErr || !file) return json({ error: 'photo_missing' }, 404)
  if (file.size > MAX_BYTES) return json({ error: 'too_big' }, 413)
  const data = encodeBase64(new Uint8Array(await file.arrayBuffer()))

  const { data: scan, error: insErr } = await admin.from('photo_scans')
    .insert({ user_id: user.id, photo_path: path, model: MODEL, status: 'pending' }).select('id').single()
  if (insErr) return json({ error: 'db' }, 500)
  const fail = async (code: string, status: number, detail?: string) => {
    await admin.from('photo_scans').update({ status: 'failed', error: detail ?? code }).eq('id', scan.id)
    return json({ error: code, scan_id: scan.id }, status)
  }

  let raw: RawItem[]
  try {
    const mime = MEDIA[m[2].toLowerCase() as keyof typeof MEDIA]
    raw = PROVIDER === 'gemini' ? await askGemini(data, mime) : await askClaude(data, mime)
  } catch (e) {
    if (e instanceof AiError) return fail(e.code, e.status, e.message)
    return fail('ai', 502, String(e)) // network error, invalid JSON from the model, ...
  }

  const items = checkItems(raw).map(i => ({ ...i, key: crypto.randomUUID(), food_id: null }))
  await admin.from('photo_scans').update({ status: 'done', detected: items }).eq('id', scan.id)
  return json({ scan_id: scan.id, items })
})
