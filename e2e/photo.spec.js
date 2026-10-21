// F01 Logger un plat par photo (S05 -> S08 -> S09 -> S05). AI simulated; real Gemini call is F01-H2 (manual).
import { PLATE, PNG, a11y, admin, cleanupUsers, diaryRows, expect, loginAs, mockScan, newUser, scanAndReview, test } from './helpers.js'

test.describe('F01 photo', () => {
  let user
  test.beforeEach(async ({ page }) => {
    user = await newUser('photo')
    await loginAs(page, user)
  })

  test('F01-H1 photo -> review -> diary', async ({ page }) => {
    await mockScan(page, user)
    await page.goto('/')
    await page.getByRole('button', { name: /Photographier mon assiette/ }).click()
    await expect(page.getByRole('heading', { name: /Photo ·/ })).toBeVisible()
    await a11y(page)
    await page.locator('input[type=file][capture]').setInputFiles({ name: 'plat.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByRole('img', { name: 'Photo du plat à analyser' })).toBeVisible()
    await page.getByRole('button', { name: 'Analyser le plat' }).click()
    await expect(page.getByRole('heading', { name: 'Vérifie le résultat' })).toBeVisible()
    await expect(page.getByText('peu sûr')).toHaveCount(1)
    await a11y(page)
    await page.getByRole('button', { name: 'Ajouter au journal' }).click()
    await expect(page.getByRole('status')).toContainText('3 aliments ajoutés')
    await expect(page.getByRole('button', { name: /Poulet rôti/ })).toBeVisible()
    await expect(page.getByRole('img', { name: /restantes sur 2000/ })).toHaveAttribute('aria-label', /^1545 kcal restantes/)
    await a11y(page)
    expect(await diaryRows(user.id)).toHaveLength(3)
  })

  test('X-1 keyboard only: photo flow', async ({ page }) => {
    await mockScan(page, user)
    await page.goto('/')
    await expect(page.getByRole('img', { name: /restantes/ })).toBeVisible() // diary loaded before tabbing
    const tabTo = async name => {
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab')
        if (await page.evaluate(n => document.activeElement?.textContent?.includes(n) || document.activeElement?.getAttribute('aria-label')?.includes(n), name)) return
      }
      throw new Error(`cannot reach "${name}" with Tab`)
    }
    await tabTo('Photographier mon assiette')
    await page.keyboard.press('Enter')
    await page.locator('input[type=file][capture]').setInputFiles({ name: 'plat.png', mimeType: 'image/png', buffer: PNG }) // the OS picker itself is out of scope
    await tabTo('Analyser le plat')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Vérifie le résultat' })).toBeVisible()
    await tabTo('Quantité de Riz blanc')
    await page.keyboard.press('Control+A')
    await page.keyboard.type('100')
    await tabTo('Ajouter au journal')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toContainText('3 aliments ajoutés')
    expect((await diaryRows(user.id)).find(r => r.label === 'Riz blanc').grams).toBe(100)
  })

  test('F01-E9 replace a wrong guess and add a forgotten food', async ({ page }) => {
    await mockScan(page, user)
    await scanAndReview(page)
    await page.getByRole('button', { name: 'Remplacer Brocoli' }).click()
    await page.getByRole('dialog').getByRole('searchbox').fill('avocat')
    await page.getByRole('dialog').getByRole('button', { name: /^Avocat pour 100 g/ }).click()
    await expect(page.getByLabel('Quantité de Avocat en grammes')).toHaveValue('90') // grams kept
    await expect(page.getByText('peu sûr')).toHaveCount(0) // user-picked food is not flagged
    await page.getByRole('button', { name: 'Ajouter un aliment oublié' }).click()
    await page.getByRole('dialog').getByRole('searchbox').fill('huile')
    await page.getByRole('dialog').getByRole('button', { name: /^Huile d'olive pour 100 g/ }).click()
    await page.getByLabel("Quantité de Huile d'olive en grammes").fill('10')
    await page.getByRole('button', { name: 'Ajouter au journal' }).click()
    await expect(page.getByRole('status')).toContainText('4 aliments ajoutés')
    const rows = await diaryRows(user.id)
    const avocado = rows.find(r => r.label === 'Avocat')
    expect(avocado).toMatchObject({ grams: 90, kcal: 144 })
    expect(avocado.food_id).toBeTruthy()
    expect(rows.find(r => r.label === "Huile d'olive")).toMatchObject({ grams: 10, kcal: 88 })
  })

  test('F01-E1 empty grams blocks the save', async ({ page }) => {
    await mockScan(page, user)
    await scanAndReview(page)
    await page.getByLabel('Quantité de Riz blanc en grammes').fill('')
    await expect(page.getByRole('alert')).toContainText('Entre une quantité')
    await expect(page.getByRole('button', { name: 'Ajouter au journal' })).toBeDisabled()
  })

  test('F01-E2 removing every item disables the save', async ({ page }) => {
    await mockScan(page, user)
    await scanAndReview(page)
    for (const name of ['Riz blanc', 'Poulet rôti', 'Brocoli']) await page.getByRole('button', { name: `Retirer ${name}` }).click()
    await expect(page.getByText('Plus aucun aliment')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ajouter au journal' })).toBeDisabled()
  })

  test('F01-E3 double click logs once', async ({ page }) => {
    await mockScan(page, user)
    await scanAndReview(page)
    await page.getByRole('button', { name: 'Ajouter au journal' }).dblclick()
    await expect(page.getByRole('status')).toContainText('3 aliments ajoutés')
    expect(await diaryRows(user.id)).toHaveLength(3)
  })

  test('F01-E4 back after adding cannot add again', async ({ page }) => {
    await mockScan(page, user)
    await scanAndReview(page)
    await page.getByRole('button', { name: 'Ajouter au journal' }).click()
    await expect(page.getByRole('status')).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('alert')).toContainText('déjà été ajouté')
    expect(await diaryRows(user.id)).toHaveLength(3)
  })

  test('F01-E5 refresh on review keeps the items', async ({ page }) => {
    await mockScan(page, user)
    await scanAndReview(page)
    await page.reload()
    await expect(page.getByLabel('Quantité de Poulet rôti en grammes')).toHaveValue('120')
  })

  test('F01-E6 long label with accents and emoji', async ({ page }) => {
    const label = 'Émincé de poulet rôti à la crème fraîche, champignons et échalotes confites 🍗'.slice(0, 80)
    const items = PLATE()
    items[0].label = label
    await mockScan(page, user, items)
    await scanAndReview(page)
    const name = page.getByText(label)
    await expect(name).toBeVisible()
    const box = await name.boundingBox()
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('F01-E7 change meal before adding', async ({ page }) => {
    await mockScan(page, user)
    await scanAndReview(page)
    await page.getByLabel('Repas').selectOption('dinner')
    await page.getByRole('button', { name: 'Ajouter au journal' }).click()
    await expect(page.getByRole('status')).toBeVisible()
    expect((await diaryRows(user.id)).map(r => r.meal)).toEqual(['dinner', 'dinner', 'dinner'])
  })

  test("F01-E8 another user cannot open someone's scan", async ({ page, browser }) => {
    await mockScan(page, user)
    await scanAndReview(page)
    const scanUrl = page.url()
    const other = await newUser('other')
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const p2 = await ctx.newPage()
    await loginAs(p2, other)
    await p2.goto(scanUrl)
    await expect(p2.getByRole('alert')).toContainText("n'existe plus")
    await expect(p2.getByText('Poulet rôti')).toHaveCount(0)
    await ctx.close()
  })

  test('F01-N1 a non-image file is refused', async ({ page }) => {
    await page.goto('/#/scan/lunch')
    await page.locator('input[type=file][capture]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
    await expect(page.getByRole('alert')).toContainText('pas une image')
  })

  test('F01-N2 AI failure shows a retryable error', async ({ page, allow }) => {
    allow(/502|scan-photo/)
    await page.route('**/functions/v1/scan-photo', r => r.fulfill({ status: 502, json: { error: 'ai' }, headers: { 'Access-Control-Allow-Origin': '*' } }))
    await page.goto('/#/scan/lunch')
    await page.locator('input[type=file][capture]').setInputFiles({ name: 'plat.png', mimeType: 'image/png', buffer: PNG })
    await page.getByRole('button', { name: 'Analyser le plat' }).click()
    await expect(page.getByRole('alert')).toContainText("L'analyse a échoué")
    await expect(page.getByRole('button', { name: 'Analyser le plat' })).toBeEnabled()
  })

  test('F01-N5 access code asked once, sent with the analysis, remembered', async ({ page, allow }) => {
    allow(/403|scan-photo/)
    const items = PLATE()
    const sent = []
    await page.route('**/functions/v1/scan-photo', async route => {
      const code = route.request().headers()['x-app-code'] ?? ''
      sent.push(code)
      if (code !== 'mon-code') return route.fulfill({ status: 403, json: { error: 'code' }, headers: { 'Access-Control-Allow-Origin': '*' } })
      const { data } = await admin().from('photo_scans')
        .insert({ user_id: user.id, photo_path: `${user.id}/mock.jpg`, model: 'mock', status: 'done', detected: items }).select('id').single()
      await route.fulfill({ json: { scan_id: data.id, items }, headers: { 'Access-Control-Allow-Origin': '*' } })
    })
    await page.goto('/#/scan/lunch')
    await page.locator('input[type=file][capture]').setInputFiles({ name: 'plat.png', mimeType: 'image/png', buffer: PNG })
    await page.getByRole('button', { name: 'Analyser le plat' }).click()
    await expect(page.getByLabel("Code d'accès")).toBeVisible()
    await a11y(page)
    await page.getByLabel("Code d'accès").fill('faux')
    await page.getByRole('button', { name: 'Valider et analyser' }).click()
    await expect(page.getByText("Code d'accès incorrect")).toBeVisible()
    await page.getByLabel("Code d'accès").fill('mon-code')
    await page.getByRole('button', { name: 'Valider et analyser' }).click()
    await expect(page.getByRole('heading', { name: 'Vérifie le résultat' })).toBeVisible()
    expect(sent).toEqual(['', 'faux', 'mon-code'])
    // next scan: no question asked, the code is remembered on this phone
    await page.goto('/#/scan/lunch')
    await page.locator('input[type=file][capture]').setInputFiles({ name: 'plat.png', mimeType: 'image/png', buffer: PNG })
    await page.getByRole('button', { name: 'Analyser le plat' }).click()
    await expect(page.getByRole('heading', { name: 'Vérifie le résultat' })).toBeVisible()
    expect(sent.at(-1)).toBe('mon-code')
  })

  test('F01-N3 daily limit message', async ({ page, allow }) => {
    allow(/429|scan-photo/)
    await page.route('**/functions/v1/scan-photo', r => r.fulfill({ status: 429, json: { error: 'limit' }, headers: { 'Access-Control-Allow-Origin': '*' } }))
    await page.goto('/#/scan/lunch')
    await page.locator('input[type=file][capture]').setInputFiles({ name: 'plat.png', mimeType: 'image/png', buffer: PNG })
    await page.getByRole('button', { name: 'Analyser le plat' }).click()
    await expect(page.getByRole('alert')).toContainText('limite')
  })

  test('F01-N4 offline at save keeps the corrections', async ({ page, allow }) => {
    allow(/Failed to fetch|ERR_|net::/)
    await mockScan(page, user)
    await scanAndReview(page)
    await page.getByLabel('Quantité de Poulet rôti en grammes').fill('200')
    await page.route('**/rest/v1/diary_entries**', r => r.abort('internetdisconnected'))
    await page.getByRole('button', { name: 'Ajouter au journal' }).click()
    await expect(page.getByRole('alert')).toContainText("L'ajout au journal a échoué")
    await expect(page.getByLabel('Quantité de Poulet rôti en grammes')).toHaveValue('200')
    expect(await diaryRows(user.id)).toHaveLength(0)
  })
})

test.afterAll(cleanupUsers)
