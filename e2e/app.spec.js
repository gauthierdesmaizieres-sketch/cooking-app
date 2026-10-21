// Compte invisible (A), journal (D), recherche (F03), profil (P).
import { a11y, admin, cleanupUsers, diaryRows, expect, localDay, loginAs, newUser, sessionUserId, test, track } from './helpers.js'

async function seedEntry(user, label = 'Pomme', kcal = 78) {
  const { error } = await admin().from('diary_entries').insert({
    user_id: user.id, logged_on: localDay(), meal: 'snack', label, grams: 150, kcal, carbs: 21, protein: 0.5, fat: 0.3, method: 'search',
  })
  if (error) throw error
}

test.describe('A compte invisible', () => {
  test('A-H1 first launch creates an account without email and keeps it', async ({ page }) => {
    await page.goto('/#/diary')
    await expect(page.getByRole('heading', { name: 'Quel est ton objectif ?' })).toBeVisible() // new account -> onboarding
    const id = await sessionUserId(page)
    expect(id).toBeTruthy()
    track(id)
    const { data } = await admin().auth.admin.getUserById(id)
    expect(data.user.is_anonymous).toBe(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Quel est ton objectif ?' })).toBeVisible()
    expect(await sessionUserId(page)).toBe(id) // same account after a reload, no new one
  })

  test('A-E1 two phones get two separate accounts', async ({ page, browser }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Quel est ton objectif ?' })).toBeVisible()
    const other = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const p2 = await other.newPage()
    await p2.goto('/')
    await expect(p2.getByRole('heading', { name: 'Quel est ton objectif ?' })).toBeVisible()
    const [a, b] = [await sessionUserId(page), await sessionUserId(p2)]
    track(a); track(b)
    expect(a).not.toBe(b)
    await other.close()
  })
})

test.describe('D journal', () => {
  test('D-H1 delete then undo', async ({ page }) => {
    const user = await newUser('diary')
    await seedEntry(user)
    await loginAs(page, user)
    await page.goto('/')
    await expect(page.getByRole('img', { name: /restantes/ })).toHaveAttribute('aria-label', /^1922 /)
    await a11y(page)
    await page.getByRole('button', { name: /Pomme/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Supprimer du journal' }).click()
    await expect(page.getByRole('status')).toContainText('Pomme supprimé')
    await expect(page.getByRole('button', { name: /Pomme/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Annuler' }).click()
    await expect(page.getByRole('button', { name: /Pomme/ })).toBeVisible()
    await expect(page.getByRole('img', { name: /restantes/ })).toHaveAttribute('aria-label', /^1922 /)
    expect(await diaryRows(user.id)).toHaveLength(1)
  })

  test('D-H2 edit an entry: amount and meal', async ({ page }) => {
    const user = await newUser('diary')
    await seedEntry(user) // Pomme 150 g, 78 kcal, snack
    await loginAs(page, user)
    await page.goto('/')
    await page.getByRole('button', { name: /Pomme/ }).click()
    await page.getByRole('dialog').getByLabel('Quantité').fill('300')
    await expect(page.getByRole('dialog')).toContainText('156 kcal')
    await page.getByRole('dialog').getByLabel('Repas').selectOption('breakfast')
    await a11y(page)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Entrée modifiée' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Petit-déjeuner' }).getByRole('button', { name: /Pomme.*300 g.*156 kcal/ })).toBeVisible()
    expect((await diaryRows(user.id))[0]).toMatchObject({ grams: 300, kcal: 156, carbs: 42, meal: 'breakfast' })
  })

  test('D-E1 day navigation', async ({ page }) => {
    await loginAs(page, await newUser('diary'))
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Jour suivant' })).toBeDisabled()
    await page.getByRole('button', { name: 'Jour précédent' }).click()
    await expect(page.getByRole('heading', { name: 'Hier' })).toBeVisible()
    await page.getByRole('button', { name: 'Jour suivant' }).click()
    await expect(page.getByRole('heading', { name: "Aujourd'hui" })).toBeVisible()
  })

  test("D-E2 a second user never sees the first user's diary", async ({ page }) => {
    const a = await newUser('diary')
    await seedEntry(a, 'Repas privé de A')
    await loginAs(page, await newUser('diary'))
    await page.goto('/')
    await expect(page.getByRole('heading', { name: "Aujourd'hui" })).toBeVisible()
    await expect(page.getByText('Rien de noté.')).toHaveCount(4)
    await expect(page.getByText('Repas privé de A')).toHaveCount(0)
  })
})

test.describe('F03 recherche', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, await newUser('search'))
    await page.goto('/#/add/lunch')
  })

  test('F03-H1 finds a seeded food', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Rechercher un aliment' }).fill('poulet')
    await expect(page.getByRole('button', { name: /Poulet rôti/ })).toBeVisible()
    await a11y(page)
  })

  test('F03-E1 no result shows the empty state', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Rechercher un aliment' }).fill('zzzz')
    await expect(page.getByText('Aucun aliment trouvé')).toBeVisible()
  })

  test('F03-E2 search ignores accents', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Rechercher un aliment' }).fill('pates')
    await expect(page.getByRole('button', { name: /Pâtes cuites/ })).toBeVisible()
  })
})

test.describe('P profil', () => {
  test('P-H1 profile explains the phone-bound account, no sign-out', async ({ page }) => {
    await loginAs(page, await newUser('profile'))
    await page.goto('/#/profile')
    await expect(page.getByText('Il est lié à ce navigateur')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0)
    await a11y(page)
  })

  test('P-H2 delete account removes everything', async ({ page, allow }) => {
    allow(/403/) // supabase-js still POSTs /logout after the user is gone; harmless, session is cleared locally
    const user = await newUser('profile')
    await seedEntry(user)
    await admin().storage.from('photos').upload(`${user.id}/x.png`, Buffer.from('x'), { contentType: 'image/png' })
    await loginAs(page, user)
    await page.goto('/#/profile')
    await page.getByRole('button', { name: 'Supprimer mon compte' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await a11y(page)
    await page.getByRole('button', { name: 'Supprimer définitivement' }).click()
    await expect(page.getByRole('heading', { name: 'Quel est ton objectif ?' })).toBeVisible() // a fresh empty account
    track(await sessionUserId(page))
    const { data: u } = await admin().auth.admin.getUserById(user.id)
    expect(u.user).toBeNull()
    expect(await diaryRows(user.id)).toHaveLength(0)
    const { data: files } = await admin().storage.from('photos').list(user.id)
    expect(files).toHaveLength(0)
  })
})

test.afterAll(cleanupUsers)
