import { test as base, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createClient } from '@supabase/supabase-js'

const url = () => process.env.SUPABASE_URL
export const admin = () => createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Every test fails on console errors, page errors and 5xx, unless it allows a pattern it expects.
export const test = base.extend({
  allow: [async ({ page }, use) => {
    const allowed = []
    const problems = []
    page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`))
    page.on('response', r => { if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`) })
    await use(re => allowed.push(re))
    expect(problems.filter(p => !allowed.some(a => a.test(p)))).toEqual([])
  }, { auto: true }],
})
export { expect }

// Users created by *this* worker; afterAll deletes only these (a global sweep would delete another
// worker's users mid-test).
const created = []
export async function cleanupUsers() {
  for (const id of created.splice(0)) {
    const { data: files } = await admin().storage.from('photos').list(id)
    if (files?.length) await admin().storage.from('photos').remove(files.map(f => `${id}/${f.name}`))
    await admin().auth.admin.deleteUser(id)
  }
}

export async function newUser(tag = 'user', { onboarded = true } = {}) {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = `Pw-${crypto.randomUUID()}`
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  const anon = createClient(url(), process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password })
  if (e2) throw e2
  created.push(data.user.id)
  if (onboarded) {
    const { error: e3 } = await admin().from('goals').insert({ user_id: data.user.id, type: 'maintain', start_weight_kg: 70, kcal_per_day: 2000, carbs_pct: 50, protein_pct: 20, fat_pct: 30 })
    if (e3) throw e3
  }
  return { id: data.user.id, email, session: s.session }
}

// Same localStorage key supabase-js uses for http://127.0.0.1:54321
export async function loginAs(page, user) {
  const key = `sb-${new URL(url()).hostname.split('.')[0]}-auth-token`
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(user.session)])
}

export async function a11y(page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([])
}

export function localDay(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

const item = (label, grams, kcal100, c, p, f, confidence = 0.9) =>
  ({ key: crypto.randomUUID(), label, grams, per100: { kcal: kcal100, carbs: c, protein: p, fat: f }, confidence, food_id: null })
export const PLATE = () => [item('Riz blanc', 150, 130, 28.6, 2.7, 0.3), item('Poulet rôti', 120, 190, 0, 27, 9), item('Brocoli', 90, 35, 7, 2.4, 0.4, 0.5)]

// Stands in for the AI: a real photo_scans row (so S09 reads it from the DB) + the function's response.
export async function mockScan(page, user, items = PLATE()) {
  await page.route('**/functions/v1/scan-photo', async route => {
    const { data, error } = await admin().from('photo_scans')
      .insert({ user_id: user.id, photo_path: `${user.id}/mock.jpg`, model: 'mock', status: 'done', detected: items })
      .select('id').single()
    if (error) throw error
    await route.fulfill({ json: { scan_id: data.id, items }, headers: { 'Access-Control-Allow-Origin': '*' } })
  })
  return items
}

export async function scanAndReview(page) {
  await page.goto('/#/scan/lunch')
  await page.locator('input[type=file][capture]').setInputFiles({ name: 'plat.png', mimeType: 'image/png', buffer: PNG })
  await page.getByRole('button', { name: 'Analyser le plat' }).click()
  await expect(page.getByRole('heading', { name: 'Vérifie le résultat' })).toBeVisible()
}

export async function diaryRows(userId) {
  const { data } = await admin().from('diary_entries').select('*').eq('user_id', userId).order('created_at')
  return data
}
