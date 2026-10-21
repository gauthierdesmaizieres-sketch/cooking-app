// S06 -> S10 portion, S11 aliment perso, S07 code-barres (saisie manuelle; OFF simulé sauf F02-H2).
import { a11y, admin, cleanupUsers, diaryRows, expect, loginAs, newUser, test } from './helpers.js'

let user
test.beforeEach(async ({ page }) => {
  user = await newUser('food')
  await loginAs(page, user)
})

test('F03-H2 search -> portion -> diary', async ({ page }) => {
  await page.goto('/#/add/lunch')
  await page.getByRole('searchbox', { name: 'Rechercher un aliment' }).fill('riz')
  await page.getByRole('button', { name: /Riz blanc cuit/ }).click()
  await expect(page.getByRole('heading', { name: 'Riz blanc cuit' })).toBeVisible()
  await a11y(page)
  await page.getByLabel('Quantité').fill('180')
  await expect(page.getByRole('table')).toContainText('234 kcal')
  await page.getByRole('button', { name: 'Ajouter au journal' }).click()
  await expect(page.getByRole('status')).toContainText('Riz blanc cuit ajouté · 234 kcal')
  const [row] = await diaryRows(user.id)
  expect(row).toMatchObject({ grams: 180, kcal: 234, method: 'search', meal: 'lunch' })
})

test('F03-E3 invalid quantity blocks the add', async ({ page }) => {
  await page.goto('/#/add/lunch')
  await page.getByRole('searchbox', { name: 'Rechercher un aliment' }).fill('pomme')
  await page.getByRole('button', { name: /^Pomme pour 100 g/ }).click()
  await page.getByLabel('Quantité').fill('0')
  await expect(page.getByText('Quantité invalide')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ajouter au journal' })).toBeDisabled()
})

test('F03-E4 favourite and recent show up on the add screen', async ({ page }) => {
  await page.goto('/#/add/dinner')
  await page.getByRole('searchbox', { name: 'Rechercher un aliment' }).fill('banane')
  await page.getByRole('button', { name: /^Banane pour 100 g/ }).click()
  await page.getByRole('button', { name: 'Ajouter aux favoris' }).click()
  await expect(page.getByRole('button', { name: 'Retirer des favoris' })).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter au journal' }).click()
  await expect(page.getByRole('status')).toBeVisible()
  await page.goto('/#/add/dinner')
  await expect(page.getByRole('heading', { name: 'Favoris' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Récents' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Favoris' }).getByRole('button', { name: /Banane.*89 kcal/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Récents' }).getByRole('button', { name: /Banane.*dernière fois 100 g/ })).toBeVisible()
})

test('F04-H1 create a custom food with a serving, then log 2 servings', async ({ page }) => {
  await page.goto('/#/add/breakfast')
  await page.getByRole('searchbox', { name: 'Rechercher un aliment' }).fill('Granola maison')
  await page.getByRole('button', { name: 'Créer « Granola maison »' }).click()
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Granola maison')
  await a11y(page)
  await page.getByRole('button', { name: "Enregistrer l'aliment" }).click()
  await expect(page.getByRole('alert')).toContainText('Corrige les champs')
  await page.getByLabel('Énergie').fill('450')
  await page.getByLabel('Glucides').fill('60')
  await page.getByLabel('Protéines').fill('10')
  await page.getByLabel('Lipides').fill('18,5')
  await page.getByLabel('Nom de la portion').fill('1 bol')
  await page.getByLabel('Poids de la portion').fill('50')
  await page.getByRole('button', { name: "Enregistrer l'aliment" }).click()
  await expect(page.getByRole('heading', { name: 'Granola maison' })).toBeVisible()
  await expect(page.getByLabel('Unité')).toHaveValue(/.+/)
  await page.getByLabel('Quantité').fill('2')
  await expect(page.getByRole('table')).toContainText('450 kcal') // 2 x 50 g
  await page.getByRole('button', { name: 'Ajouter au journal' }).click()
  await expect(page.getByRole('status')).toBeVisible()
  const [row] = await diaryRows(user.id)
  expect(row).toMatchObject({ grams: 100, kcal: 450, meal: 'breakfast' })
})

test('F04-E1 macros over 100 g are refused', async ({ page }) => {
  await page.goto('/#/new-food/lunch')
  await page.getByLabel('Nom', { exact: true }).fill('Faux')
  for (const [l, v] of [['Énergie', '400'], ['Glucides', '60'], ['Protéines', '30'], ['Lipides', '20']]) await page.getByLabel(l).fill(v)
  await page.getByRole('button', { name: "Enregistrer l'aliment" }).click()
  await expect(page.getByText('dépassent 100 g')).toBeVisible()
})

test('F02-H1 manual barcode, known product', async ({ page }) => {
  const { data: food } = await admin().from('foods').insert({
    owner_id: null, source: 'off', source_ref: `t${Date.now()}`, barcode: `30${Date.now()}`.slice(0, 13),
    name: 'Yaourt test', kcal_100g: 61, carbs_100g: 4.7, protein_100g: 3.5, fat_100g: 3.3,
  }).select().single()
  await page.goto('/#/barcode/snack')
  await expect(page.getByText(/Caméra indisponible|Ouverture|Place le code/)).toBeVisible()
  await a11y(page)
  await page.getByLabel('Saisir le code').fill(food.barcode)
  await page.getByRole('button', { name: 'Chercher' }).click()
  await expect(page.getByRole('heading', { name: 'Yaourt test' })).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter au journal' }).click()
  await expect(page.getByRole('status')).toBeVisible()
  expect((await diaryRows(user.id))[0]).toMatchObject({ method: 'barcode', meal: 'snack' })
  await admin().from('foods').delete().eq('id', food.id)
})

test('F02-E1 unknown barcode leads to creation with the code prefilled', async ({ page }) => {
  await page.route('**/functions/v1/barcode', r => r.fulfill({ json: { food: null, prefill: { name: 'Biscuits X' } }, headers: { 'Access-Control-Allow-Origin': '*' } }))
  await page.goto('/#/barcode/snack')
  await page.getByLabel('Saisir le code').fill('0000000000000')
  await page.getByRole('button', { name: 'Chercher' }).click()
  await expect(page.getByRole('heading', { name: 'Produit inconnu' })).toBeVisible()
  await page.getByRole('button', { name: 'Créer cet aliment' }).click()
  await expect(page.getByLabel('Code-barres (facultatif)')).toHaveValue('0000000000000')
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Biscuits X')
})

test('F02-E2 a malformed code is not sent', async ({ page }) => {
  await page.goto('/#/barcode/snack')
  await page.getByLabel('Saisir le code').fill('12ab')
  await expect(page.getByText('8 à 14 chiffres.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chercher' })).toBeDisabled()
})

test.afterAll(cleanupUsers)
