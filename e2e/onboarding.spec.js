// F06 Onboarding -> objectif (S01 -> S02 -> S03 -> S05), et « Mes objectifs » depuis le profil.
import { a11y, admin, cleanupUsers, expect, loginAs, newUser, test } from './helpers.js'

const cont = page => page.getByRole('button', { name: 'Continuer' }).click()

async function fill(page, { goal = 'Perdre du poids', sex = 'Homme', birth = '1996-01-01', height = '180', weight = '80', target = '75', activity = 'Actif' } = {}) {
  await page.getByRole('radio', { name: new RegExp(goal) }).check()
  await cont(page)
  await page.getByRole('radio', { name: sex }).check()
  await page.getByLabel('Date de naissance').fill(birth)
  await page.getByLabel('Taille').fill(height)
  await cont(page)
  await page.getByLabel('Poids actuel').fill(weight)
  if (target != null) await page.getByLabel('Poids visé').fill(target)
  await cont(page)
  await page.getByRole('radio', { name: new RegExp(`^${activity}`) }).check()
  await cont(page)
}

let user
test.beforeEach(async ({ page }) => {
  user = await newUser('onb', { onboarded: false })
  await loginAs(page, user)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Quel est ton objectif ?' })).toBeVisible()
})

test('F06-H1 first run: plan computed, saved, diary uses it', async ({ page }) => {
  await a11y(page)
  await fill(page)
  await expect(page.getByRole('heading', { name: 'Ton plan' })).toBeVisible()
  // 35 y, 80 kg, 180 cm, moderate: 1755 * 1.55 = 2720 - 500 = 2220
  const plan = page.getByRole('region', { name: 'Objectif quotidien' })
  await expect(plan).toContainText(/\d{4}/)
  const kcal = Number((await plan.locator('.kcal-big').textContent()).trim())
  expect(kcal).toBeGreaterThan(2100)
  expect(kcal).toBeLessThan(2350)
  await expect(plan).toContainText('Protéines')
  await expect(plan).toContainText('75 kg vers')
  await a11y(page)
  await page.getByRole('button', { name: "C'est parti" }).click()
  await expect(page.getByRole('heading', { name: "Aujourd'hui" })).toBeVisible()
  await expect(page.getByRole('img', { name: /restantes/ })).toHaveAttribute('aria-label', new RegExp(`^${kcal} kcal restantes sur ${kcal}`))
  const { data: goals } = await admin().from('goals').select('*').eq('user_id', user.id)
  expect(goals).toHaveLength(1)
  expect(goals[0]).toMatchObject({ type: 'lose', kcal_per_day: kcal, protein_pct: 30, ends_on: null })
  const { data: w } = await admin().from('weight_logs').select('kg').eq('user_id', user.id)
  expect(w.map(x => Number(x.kg))).toEqual([80])
})

test('F06-E1 each step blocks until it is valid', async ({ page }) => {
  await cont(page)
  await expect(page.getByText('Choisis un objectif.')).toBeVisible()
  await page.getByRole('radio', { name: /Garder mon poids/ }).check()
  await cont(page)
  await cont(page)
  await expect(page.getByText('Choisis une option.')).toBeVisible()
  await expect(page.getByText(/date de naissance valide/)).toBeVisible()
  await expect(page.getByText(/taille entre 120 et 230/)).toBeVisible()
  await expect(page.getByText('Étape 2 sur 4')).toBeVisible()
})

test('F06-E2 a minor cannot pick weight loss', async ({ page }) => {
  const y = new Date().getFullYear() - 15
  await page.getByRole('radio', { name: /Perdre du poids/ }).check()
  await cont(page)
  await page.getByRole('radio', { name: 'Femme' }).check()
  await page.getByLabel('Date de naissance').fill(`${y}-03-01`)
  await page.getByLabel('Taille').fill('160')
  await cont(page)
  await page.getByLabel('Poids actuel').fill('55')
  await page.getByLabel('Poids visé').fill('50')
  await cont(page)
  await expect(page.getByRole('alert').filter({ hasText: '18 ans' })).toBeVisible()
  await expect(page.getByText('Étape 3 sur 4')).toBeVisible()
})

test('F06-E3 target under BMI 18.5 is refused with the minimum', async ({ page }) => {
  await page.getByRole('radio', { name: /Perdre du poids/ }).check()
  await cont(page)
  await page.getByRole('radio', { name: 'Femme' }).check()
  await page.getByLabel('Date de naissance').fill('1990-05-05')
  await page.getByLabel('Taille').fill('165')
  await cont(page)
  await page.getByLabel('Poids actuel').fill('60')
  await page.getByLabel('Poids visé').fill('45')
  await cont(page)
  await expect(page.getByText(/minimum conseillé pour ta taille est 51 kg/)).toBeVisible()
})

test('F06-E4 small sedentary profile is floored and told so', async ({ page }) => {
  await fill(page, { sex: 'Femme', height: '150', weight: '50', target: '47', activity: 'Sédentaire' })
  await expect(page.locator('.kcal-big')).toHaveText('1200')
  await expect(page.getByText(/ramené au minimum conseillé/)).toBeVisible()
})

test('F06-H2 change goals later from the profile', async ({ page }) => {
  await fill(page, { goal: 'Garder mon poids', target: null })
  await page.getByRole('button', { name: "C'est parti" }).click()
  await page.getByRole('button', { name: 'Profil' }).click()
  await page.getByRole('button', { name: 'Modifier mes objectifs' }).click()
  await expect(page.getByRole('radio', { name: /Garder mon poids/ })).toBeChecked()
  await page.getByRole('radio', { name: /Prendre du poids/ }).check()
  await cont(page)
  await expect(page.getByLabel('Taille')).toHaveValue('180')
  await cont(page)
  await expect(page.getByLabel('Poids actuel')).toHaveValue('80')
  await page.getByLabel('Poids visé').fill('85')
  await cont(page)
  await expect(page.getByRole('radio', { name: /^Actif/ })).toBeChecked()
  await cont(page)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Objectifs mis à jour' })).toBeVisible()
  const { data: goals } = await admin().from('goals').select('type, ends_on').eq('user_id', user.id).order('created_at')
  expect(goals.map(g => [g.type, g.ends_on === null])).toEqual([['maintain', false], ['gain', true]])
})

test('F06-E5 keyboard only through the first step', async ({ page }) => {
  await page.keyboard.press('Tab')
  await page.keyboard.press('Space')
  await expect(page.getByRole('radio', { name: /Perdre du poids/ })).toBeChecked()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio', { name: /Garder mon poids/ })).toBeChecked()
})

test.afterAll(cleanupUsers)
