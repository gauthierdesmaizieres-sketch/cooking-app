// F04 Créer mon plat (S12 -> S15 -> S13 -> journal), F05 Cuisiner (S13 -> S14).
import { PNG, a11y, admin, cleanupUsers, diaryRows, expect, loginAs, newUser, test } from './helpers.js'

let user
test.beforeEach(async ({ page }) => {
  user = await newUser('recipe')
  await loginAs(page, user)
})

async function createDish(page, { title = 'Bol riz poulet', steps = 'Cuire le riz.\nGriller le poulet.\nServir.' } = {}) {
  await page.goto('/#/recipes')
  await page.getByRole('button', { name: 'Créer mon premier plat' }).click()
  await page.getByLabel('Nom du plat').fill(title)
  await page.getByRole('button', { name: 'Augmenter les portions' }).click() // 2 -> 3
  await page.getByLabel('Préparation').fill('25')
  await page.getByRole('button', { name: 'Sans gluten' }).click()
  for (const [q, name, g] of [['riz', 'Riz blanc cuit', '300'], ['poulet', 'Poulet rôti', '300']]) {
    await page.getByRole('searchbox', { name: 'Ajouter un ingrédient' }).fill(q)
    await page.getByRole('button', { name: new RegExp(name) }).click()
    await page.getByLabel(`Poids de ${name} en grammes`).fill(g)
  }
  await page.getByLabel('Étapes (une par ligne, facultatif)').fill(steps)
}

test('F04-H2 create a dish, totals per portion, log 1.5 portions', async ({ page }) => {
  await createDish(page)
  // (300 g riz = 390) + (300 g poulet = 570) = 960 kcal / 3 portions
  await expect(page.getByText('320 kcal / portion')).toBeVisible()
  await a11y(page)
  await page.getByRole('button', { name: 'Enregistrer le plat' }).click()
  await expect(page.getByRole('heading', { name: 'Bol riz poulet' })).toBeVisible()
  await expect(page.getByText('25 min · 3 portions · Sans gluten')).toBeVisible()
  await expect(page.getByLabel('Par portion')).toContainText('320')
  await a11y(page)

  await page.getByRole('button', { name: 'Ajouter au journal' }).click()
  await page.getByLabel('Portions mangées').fill('1,5')
  await page.getByLabel('Repas').selectOption('dinner')
  await expect(page.getByRole('dialog')).toContainText('480 kcal')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'ajouté' })).toContainText('Bol riz poulet ajouté · 480 kcal')
  await expect(page.getByRole('button', { name: /Bol riz poulet.*1.5 portions/ })).toBeVisible()
  expect((await diaryRows(user.id))[0]).toMatchObject({ servings: 1.5, kcal: 480, meal: 'dinner', method: 'recipe' })

  await page.goto('/#/recipes')
  await expect(page.getByRole('link', { name: /Bol riz poulet.*320 kcal \/ portion · 25 min/ })).toBeVisible()
  await a11y(page)
})

test('F04-E2 validation: no name, no ingredient', async ({ page }) => {
  await page.goto('/#/recipe/new')
  await page.getByRole('button', { name: 'Enregistrer le plat' }).click()
  await expect(page.getByText('Donne un nom à ton plat.')).toBeVisible()
  await expect(page.getByText('Ajoute au moins un ingrédient.')).toBeVisible()
  const { data } = await admin().from('recipes').select('id').eq('owner_id', user.id)
  expect(data).toHaveLength(0)
})

test('F04-E3 edit keeps ingredients when the save fails, then succeeds', async ({ page, allow }) => {
  allow(/Failed to fetch|ERR_|net::/)
  await createDish(page)
  await page.getByRole('button', { name: 'Enregistrer le plat' }).click()
  await page.getByRole('button', { name: 'Modifier le plat' }).click()
  await page.getByLabel('Poids de Poulet rôti en grammes').fill('150')
  await page.route('**/rest/v1/rpc/save_recipe', r => r.abort('internetdisconnected'))
  await page.getByRole('button', { name: 'Enregistrer le plat' }).click()
  await expect(page.getByRole('alert')).toContainText("rien n'est perdu")
  await expect(page.getByLabel('Poids de Poulet rôti en grammes')).toHaveValue('150')
  await page.unroute('**/rest/v1/rpc/save_recipe')
  await page.getByRole('button', { name: 'Enregistrer le plat' }).click()
  // 390 + 285 = 675 / 3
  await expect(page.getByLabel('Par portion')).toContainText('225')
  const { data } = await admin().from('recipe_ingredients').select('grams').order('position')
    .in('recipe_id', (await admin().from('recipes').select('id').eq('owner_id', user.id)).data.map(r => r.id))
  expect(data.map(d => Number(d.grams))).toEqual([300, 150])
})

test('F04-E4 photo upload and delete dish', async ({ page }) => {
  await createDish(page, { title: 'Plat avec photo' })
  await page.locator('input[type=file]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG })
  await page.getByRole('button', { name: 'Enregistrer le plat' }).click()
  await expect(page.getByRole('img', { name: 'Plat avec photo' })).toBeVisible()
  const { data: files } = await admin().storage.from('photos').list(user.id)
  expect(files.map(f => f.name)).toEqual([expect.stringMatching(/^recipe-.*\.jpg$/)])
  await page.getByRole('button', { name: 'Modifier le plat' }).click()
  await page.getByRole('button', { name: 'Supprimer ce plat' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByRole('heading', { name: 'Mes plats' })).toBeVisible()
  expect((await admin().storage.from('photos').list(user.id)).data).toHaveLength(0)
})

test('F04-E5 long title with accents and emoji', async ({ page }) => {
  const title = 'Gratin dauphinois de mémé, crème fraîche & noix de muscade râpée 🥔🧀'
  await createDish(page, { title })
  await page.getByRole('button', { name: 'Enregistrer le plat' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('F05-H1 cook: scale to 6 portions, walk the steps', async ({ page }) => {
  await createDish(page)
  await page.getByRole('button', { name: 'Enregistrer le plat' }).click()
  await page.getByRole('button', { name: 'Augmenter les portions à cuisiner' }).click()
  await page.getByRole('button', { name: 'Augmenter les portions à cuisiner' }).click()
  await page.getByRole('button', { name: 'Augmenter les portions à cuisiner' }).click()
  await expect(page.getByText('Pour 6 portions')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Riz blanc cuit' })).toContainText('600 g')
  await page.getByRole('button', { name: 'Cuisiner', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sors les ingrédients' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Poulet rôti' })).toContainText('600 g')
  await a11y(page)
  await page.getByRole('button', { name: 'Commencer' }).click()
  await expect(page.getByText('Étape 1 sur 3')).toBeVisible()
  await expect(page.getByText('Cuire le riz.')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('Servir.')).toBeVisible()
  await page.getByRole('button', { name: 'Terminé' }).click()
  await expect(page.getByRole('heading', { name: 'Bol riz poulet' })).toBeVisible()
})

test("F04-E6 another user cannot open or edit someone's dish", async ({ page, browser }) => {
  await createDish(page, { title: 'Secret de A' })
  await page.getByRole('button', { name: 'Enregistrer le plat' }).click()
  await expect(page.getByRole('heading', { name: 'Secret de A' })).toBeVisible()
  const id = page.url().split('/recipe/')[1]
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const p2 = await ctx.newPage()
  await loginAs(p2, await newUser('recipe'))
  await p2.goto(`/#/recipe/${id}`)
  await expect(p2.getByRole('alert')).toContainText("n'existe plus")
  await p2.goto(`/#/recipe/${id}/edit`)
  await expect(p2.getByRole('alert')).toContainText("n'existe plus")
  await ctx.close()
})

test.afterAll(cleanupUsers)
