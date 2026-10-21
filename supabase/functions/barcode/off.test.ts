import { assertEquals } from 'jsr:@std/assert@1'
import { servingOf, toFood } from './off.ts'

const yogurt = {
  product_name_fr: 'Yaourt nature', brands: 'Ferme du Val, Autre', serving_size: '1 pot (125 g)', serving_quantity: '125',
  nutriments: { 'energy-kcal_100g': 61, carbohydrates_100g: 4.7, proteins_100g: 3.5, fat_100g: 3.3, sugars_100g: 4.7, salt_100g: 0.12 },
}

Deno.test('maps a complete product', () => {
  assertEquals(toFood('3000000000017', yogurt), {
    name: 'Yaourt nature', brand: 'Ferme du Val', barcode: '3000000000017', source: 'off', source_ref: '3000000000017',
    kcal_100g: 61, carbs_100g: 4.7, protein_100g: 3.5, fat_100g: 3.3, fiber_100g: null, sugar_100g: 4.7, salt_100g: 0.1,
  })
  assertEquals(servingOf(yogurt), { label: '1 pot (125 g)', grams: 125 })
})

Deno.test('kJ only is converted', () => {
  const f = toFood('1', { product_name: 'x', nutriments: { energy_100g: 418.4, carbohydrates_100g: 0, proteins_100g: 0, fat_100g: 0 } })
  assertEquals(f?.kcal_100g, 100)
})

Deno.test('rejects missing or impossible values', () => {
  assertEquals(toFood('1', { product_name: 'x', nutriments: { 'energy-kcal_100g': 50 } }), null)
  assertEquals(toFood('1', { nutriments: { 'energy-kcal_100g': 50, carbohydrates_100g: 1, proteins_100g: 1, fat_100g: 1 } }), null)
  assertEquals(toFood('1', { product_name: 'x', nutriments: { 'energy-kcal_100g': 2000, carbohydrates_100g: 1, proteins_100g: 1, fat_100g: 1 } }), null)
  assertEquals(toFood('1', { product_name: 'x', nutriments: { 'energy-kcal_100g': 500, carbohydrates_100g: 80, proteins_100g: 30, fat_100g: 10 } }), null)
  assertEquals(servingOf({ serving_size: '1 pot', serving_quantity: 0 }), null)
})
