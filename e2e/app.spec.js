// Connexion (A), journal (D), recherche (F03), profil (P).
import { a11y, admin, cleanupUsers, diaryRows, expect, localDay, loginAs, newUser, test } from './helpers.js'

async function seedEntry(user, label = 'Pomme', kcal = 78) {
  const { error } = await admin().from('diary_entries').insert({
    user_id: user.id, logged_on: localDay(), meal: 'snack', label, grams: 150, kcal, carbs: 21, protein: 0.5, fat: 0.3, method: 'search',
  })
  if (error) throw error
}

test.describe('A connexion', () => {
  test('A-N1 no session shows the login screen', async ({ page }) => {
    await page.goto('/#/diary')
    await expect(page.getByRole('heading', { name: 'Ton journal repas' })).toBeVisible()
    await a11y(page)
  })

  test('A-E1 invalid email keeps the button disabled', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('E-mail').fill('abc')
    await expect(page.getByRole('button', { name: 'Recevoir un code' })).toBeDisabled()
  })

  async function lastMail(email) {
    let msg
    await expect.poll(async () => {
      const list = await (await fetch(`${process.env.MAILPIT_URL}/api/v1/search?query=to:${encodeURIComponent(email)}`)).json()
      if (!list.messages?.length) return null
      msg = await (await fetch(`${process.env.MAILPIT_URL}/api/v1/message/${list.messages[0].ID}`)).json()
      return msg
    }, { timeout: 10_000 }).toBeTruthy()
    return { code: msg.Text.match(/\b(\d{6,10})\b/)[1], link: msg.HTML.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&') }
  }

  test('A-H1 sign in with the emailed code (any browser)', async ({ page, allow }) => {
    allow(/403/) // the wrong code typed on purpose below
    const email = `link-${Date.now()}@example.com`
    await page.goto('/')
    await page.getByLabel('E-mail').fill(email)
    await page.getByRole('button', { name: 'Recevoir un code' }).click()
    await expect(page.getByRole('heading', { name: 'Regarde tes e-mails' })).toBeVisible()
    await a11y(page)
    const { code } = await lastMail(email)
    await page.getByLabel('Code reçu par e-mail').fill('000000')
    await page.getByRole('button', { name: 'Me connecter' }).click()
    await expect(page.getByText('Code incorrect ou expiré')).toBeVisible()
    await page.reload() // e.g. the app was killed while reading the email: we stay on the code step
    await page.getByLabel('Code reçu par e-mail').fill(code)
    await page.getByRole('button', { name: 'Me connecter' }).click()
    await expect(page.getByRole('heading', { name: 'Quel est ton objectif ?' })).toBeVisible() // new account -> onboarding
  })

  test('A-E2 email link opened in another browser explains to use the code', async ({ page, browser, allow }) => {
    allow(/40\d/) // the PKCE exchange fails on purpose in the second browser
    const email = `link-${Date.now()}@example.com`
    await page.goto('/')
    await page.getByLabel('E-mail').fill(email)
    await page.getByRole('button', { name: 'Recevoir un code' }).click()
    const { link } = await lastMail(email)
    const other = await browser.newContext({ viewport: { width: 390, height: 844 } }) // like Gmail's in-app browser
    const p2 = await other.newPage()
    await p2.goto(link)
    await expect(p2.getByRole('heading', { name: 'Ton journal repas' })).toBeVisible()
    await expect(p2.getByText(/tape le code à 6 chiffres/)).toBeVisible()
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
  test('P-H1 sign out', async ({ page }) => {
    await loginAs(page, await newUser('profile'))
    await page.goto('/#/profile')
    await a11y(page)
    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(page.getByRole('heading', { name: 'Ton journal repas' })).toBeVisible()
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
    await expect(page.getByRole('heading', { name: 'Ton journal repas' })).toBeVisible()
    const { data: u } = await admin().auth.admin.getUserById(user.id)
    expect(u.user).toBeNull()
    expect(await diaryRows(user.id)).toHaveLength(0)
    const { data: files } = await admin().storage.from('photos').list(user.id)
    expect(files).toHaveLength(0)
  })
})

test.afterAll(cleanupUsers)
