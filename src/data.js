// Data layer on Supabase. Same signatures as the fake layer it replaced, so screens didn't change.
// Access control lives in Postgres RLS (supabase/migrations); this file never filters by user for security.
import { supabase } from './supabase.js'

const DEFAULT_GOAL = { kcal_per_day: 2000, carbs_pct: 50, protein_pct: 20, fat_pct: 30 }

function must({ data, error }) {
  if (error) throw error
  return data
}

async function userId() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('auth')
  return data.session.user.id
}

export async function getActiveGoal() {
  const rows = must(await supabase.from('goals').select('*').is('ends_on', null).limit(1))
  return rows[0] ?? null
}

export async function getGoal() {
  return (await getActiveGoal()) ?? DEFAULT_GOAL // only before onboarding finishes
}

// -> { profile, goal } (either may be null) to prefill "Mes objectifs"
export async function getProfile() {
  const [rows, goal] = await Promise.all([supabase.from('profiles').select('*').limit(1).then(must), getActiveGoal()])
  return { profile: rows[0] ?? null, goal }
}

// One transaction: profile + new active goal + today's weight (supabase/migrations/…_save_onboarding.sql)
export async function saveOnboarding(profile, goal, weight, today) {
  return must(await supabase.rpc('save_onboarding', { p: profile, g: goal, weight, today }))
}

export async function listDiary(day) {
  return must(await supabase.from('diary_entries').select('*').eq('logged_on', day).order('created_at'))
}

// Idempotent on client_id (unique index), so a retried request never logs twice.
export async function addDiaryEntries(rows) {
  const user_id = await userId()
  return must(await supabase.from('diary_entries')
    .upsert(rows.map(r => ({ ...r, user_id })), { onConflict: 'user_id,client_id', ignoreDuplicates: true })
    .select())
}

export async function updateDiaryEntry(id, patch) {
  return must(await supabase.from('diary_entries').update(patch).eq('id', id).select().single())
}

export async function deleteDiaryEntry(id) {
  return must(await supabase.from('diary_entries').delete().eq('id', id).select().single())
}

export async function restoreDiaryEntry(entry) {
  must(await supabase.from('diary_entries').upsert(entry, { onConflict: 'id', ignoreDuplicates: true }))
}

export async function searchFoods(q) {
  if (!q.trim()) return []
  return must(await supabase.rpc('search_foods', { q: q.trim(), lim: 30 }))
}

// Phone photos are 3–12 MB; 1024 px JPEG is plenty for recognition and keeps upload + tokens small.
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file)
    const s = Math.min(1, 1024 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * s)
    c.height = Math.round(bmp.height * s)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise((ok, ko) => c.toBlob(b => (b ? ok(b) : ko(new Error('encode'))), 'image/jpeg', 0.85))
  } catch {
    throw new Error('not-image') // e.g. HEIC the browser can't decode
  }
}

// Returns { scan_id, items }. Throws Error(code): not-image | limit | refused | ai | network
export async function scanPhoto(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('not-image')
  const blob = await shrink(file)
  const path = `${await userId()}/${crypto.randomUUID()}.jpg`
  const up = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' })
  if (up.error) throw new Error('network')
  const { data, error } = await supabase.functions.invoke('scan-photo', { body: { photo_path: path } })
  if (error) {
    const body = await error.context?.json?.().catch(() => null)
    throw new Error(body?.error ?? 'network')
  }
  return data
}

export async function getScan(id) {
  const rows = must(await supabase.from('photo_scans').select('id, status, detected').eq('id', id).limit(1))
  return rows[0] ?? null
}

export async function setScanStatus(id, status) {
  must(await supabase.from('photo_scans').update({ status }).eq('id', id))
}

export async function signIn(email) {
  must(await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })) // app may live under a sub-path (GitHub Pages)
}

// type 'email' covers both the first sign-up code and later sign-in codes
export async function verifyCode(email, token) {
  must(await supabase.auth.verifyOtp({ email, token, type: 'email' }))
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
  if (error) throw error
  await supabase.auth.signOut({ scope: 'local' })
}

// ---- foods (S06, S07, S10, S11)

export async function getFood(id) {
  const rows = must(await supabase.from('foods').select('*, servings(id, label, grams)').eq('id', id).limit(1))
  return rows[0] ?? null
}

// food: { name, brand?, barcode?, kcal_100g, carbs_100g, protein_100g, fat_100g, fiber_100g?, sugar_100g?, salt_100g? }
export async function addFood(food, serving) {
  const owner_id = await userId()
  const f = must(await supabase.from('foods').insert({ ...food, owner_id, source: 'custom' }).select().single())
  if (serving) must(await supabase.from('servings').insert({ ...serving, food_id: f.id }))
  return f
}

// -> { food } or { food: null, prefill: { name?, brand? } }. Throws Error(code): network
export async function lookupBarcode(ean) {
  const { data, error } = await supabase.functions.invoke('barcode', { body: { ean } })
  if (error) {
    const body = await error.context?.json?.().catch(() => null)
    throw new Error(body?.error ?? 'network')
  }
  return data
}

export async function listRecents() {
  return must(await supabase.from('recent_foods').select('*').order('created_at', { ascending: false }).limit(20))
}

export async function listFavorites() {
  return must(await supabase.from('favorites')
    .select('food_id, recipe_id, foods(id, name, brand, kcal_100g), recipes(id, title, servings, kcal_total)')
    .order('created_at', { ascending: false }))
}

// target: { food_id } or { recipe_id }
export async function isFavorite(target) {
  const [col, id] = Object.entries(target)[0]
  return must(await supabase.from('favorites').select(col).eq(col, id).limit(1)).length > 0
}

export async function setFavorite(target, on) {
  const [col, id] = Object.entries(target)[0]
  if (on) must(await supabase.from('favorites').insert({ user_id: await userId(), [col]: id }))
  else must(await supabase.from('favorites').delete().eq(col, id))
}

// ---- recipes / my dishes (S12–S15)

const RECIPE_LIST = 'id, title, photo_path, servings, prep_minutes, tags, kcal_total, carbs_total, protein_total, fat_total'

export async function listRecipes() {
  // shortcut: only the user's own dishes; a shared catalogue (owner_id null) needs content written first.
  return must(await supabase.from('recipes').select(RECIPE_LIST).not('owner_id', 'is', null).order('updated_at', { ascending: false }))
}

export async function getRecipe(id) {
  const rows = must(await supabase.from('recipes')
    .select(`${RECIPE_LIST}, owner_id, steps, recipe_ingredients(id, grams, position, foods(id, name, kcal_100g, carbs_100g, protein_100g, fat_100g))`)
    .eq('id', id).limit(1))
  const r = rows[0]
  if (r) r.recipe_ingredients.sort((a, b) => a.position - b.position)
  return r ?? null
}

// recipe: { id?, title, photo_path?, servings, prep_minutes?, tags[], steps[{ text }] }, ingredients: [{ food_id, grams }]
export async function saveRecipe(recipe, ingredients) {
  return must(await supabase.rpc('save_recipe', { r: recipe, ingredients }))
}

export async function deleteRecipe(recipe) {
  must(await supabase.from('recipes').delete().eq('id', recipe.id))
  if (recipe.photo_path) await supabase.storage.from('photos').remove([recipe.photo_path])
}

// Flat <uid>/recipe-*.jpg (no sub-folder) so delete-account's single-level listing removes it too.
export async function uploadRecipePhoto(file) {
  const blob = await shrink(file)
  const path = `${await userId()}/recipe-${crypto.randomUUID()}.jpg`
  const up = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' })
  if (up.error) throw new Error('network')
  return path
}

export async function photoUrl(path) {
  const { data } = await supabase.storage.from('photos').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}
