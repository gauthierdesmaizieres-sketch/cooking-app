import { assertEquals } from 'jsr:@std/assert@1'
import { checkItems } from './validate.ts'

Deno.test('keeps a sane item and converts to per 100 g', () => {
  const [i] = checkItems([{ label: ' Riz ', grams: 180, kcal: 234, carbs: 51.5, protein: 4.9, fat: 0.5, confidence: 0.9 }])
  assertEquals(i, { label: 'Riz', grams: 180, per100: { kcal: 130, carbs: 28.6, protein: 2.7, fat: 0.3 }, confidence: 0.9 })
})

Deno.test('kcal that contradicts the macros is recomputed', () => {
  const [i] = checkItems([{ label: 'Poulet', grams: 100, kcal: 900, carbs: 0, protein: 27, fat: 9, confidence: 2 }])
  assertEquals(i.per100.kcal, 189)
  assertEquals(i.confidence, 1)
})

Deno.test('drops junk: no label, bad grams, strings, impossible density', () => {
  assertEquals(checkItems([
    { label: '', grams: 100, kcal: 1, carbs: 0, protein: 0, fat: 0, confidence: 1 },
    { label: 'x', grams: 0, kcal: 1, carbs: 0, protein: 0, fat: 0, confidence: 1 },
    { label: 'x', grams: 9000, kcal: 1, carbs: 0, protein: 0, fat: 0, confidence: 1 },
    { label: 'x', grams: 10, kcal: '5', carbs: 0, protein: 0, fat: 0, confidence: 1 },
    { label: 'x', grams: 10, kcal: 200, carbs: 0, protein: 0, fat: 22, confidence: 1 },
  ]), [])
  assertEquals(checkItems(null as never), [])
})
