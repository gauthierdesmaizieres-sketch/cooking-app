import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, localDay, macroGoals, mealForHour, nutrientsFor, parseGrams, totals } from './lib.js'

test('localDay uses local calendar, addDays crosses months and years', () => {
  assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
  assert.equal(addDays('2026-02-28', 1), '2026-03-01')
})

test('nutrientsFor scales per 100 g and guards bad grams', () => {
  const rice = { kcal: 130, carbs: 28.6, protein: 2.7, fat: 0.3 }
  assert.deepEqual(nutrientsFor(rice, 180), { kcal: 234, carbs: 51.5, protein: 4.9, fat: 0.5 })
  assert.deepEqual(nutrientsFor(rice, 0), { kcal: 0, carbs: 0, protein: 0, fat: 0 })
  assert.deepEqual(nutrientsFor(rice, 'abc'), { kcal: 0, carbs: 0, protein: 0, fat: 0 })
})

test('totals sums and rounds', () => {
  assert.deepEqual(totals([{ kcal: 234, carbs: 51.5, protein: 4.9, fat: 0.5 }, { kcal: 0.4, carbs: 0.05, protein: 0, fat: 0 }]),
    { kcal: 234, carbs: 51.6, protein: 4.9, fat: 0.5 })
  assert.deepEqual(totals([]), { kcal: 0, carbs: 0, protein: 0, fat: 0 })
})

test('macroGoals converts % of kcal to grams', () => {
  assert.deepEqual(macroGoals({ kcal_per_day: 2000, carbs_pct: 50, protein_pct: 20, fat_pct: 30 }), { carbs: 250, protein: 100, fat: 67 })
})

test('parseGrams accepts comma decimals, rejects junk', () => {
  assert.equal(parseGrams('12,5'), 12.5)
  assert.equal(parseGrams(' 200 '), 200)
  for (const bad of ['', '0', '-3', 'abc', '99999']) assert.equal(parseGrams(bad), null)
})

test('mealForHour', () => {
  assert.deepEqual([7, 12, 16, 20].map(mealForHour), ['breakfast', 'lunch', 'snack', 'dinner'])
})

import { parseNumber, recipeFor } from './lib.js'

test('recipeFor scales the pot to n servings', () => {
  const pot = { servings: 4, kcal_total: 2000, carbs_total: 200, protein_total: 100, fat_total: 80 }
  assert.deepEqual(recipeFor(pot, 1), { kcal: 500, carbs: 50, protein: 25, fat: 20 })
  assert.deepEqual(recipeFor(pot, 1.5), { kcal: 750, carbs: 75, protein: 37.5, fat: 30 })
  assert.deepEqual(recipeFor({ ...pot, servings: 0 }, 1).kcal, 0)
})

test('parseNumber', () => {
  assert.equal(parseNumber('2,5'), 2.5)
  assert.equal(parseNumber('0'), 0)
  assert.equal(parseNumber('', 0), null)
  assert.equal(parseNumber('901', 0, 900), null)
  assert.equal(parseNumber('-1'), null)
})

import { ageOn, bmr, checkProfile, planGoal } from './lib.js'

test('ageOn counts birthdays correctly', () => {
  assert.equal(ageOn('1990-10-21', '2026-10-20'), 35)
  assert.equal(ageOn('1990-10-20', '2026-10-20'), 36)
  assert.equal(ageOn('2000-02-29', '2026-02-28'), 25)
})

test('bmr matches Mifflin-St Jeor', () => {
  assert.equal(bmr({ sex: 'male', weight_kg: 80, height_cm: 180, age: 30 }), 1780)
  assert.equal(bmr({ sex: 'female', weight_kg: 60, height_cm: 165, age: 30 }), 1320.25)
})

test('planGoal: deficit, macros, weeks, floor', () => {
  const man = { sex: 'male', birth_date: '1996-01-01', height_cm: 180, weight_kg: 80, activity_level: 'moderate', type: 'lose', target_weight_kg: 75 }
  // 1780 * 1.55 = 2759 -> -500 = 2259 -> 2260
  assert.deepEqual(planGoal(man, '2026-10-20'), { kcal_per_day: 2260, carbs_pct: 40, protein_pct: 30, fat_pct: 30, tdee: 2759, weeks: 10, floored: false })
  const small = { sex: 'female', birth_date: '1996-01-01', height_cm: 150, weight_kg: 50, activity_level: 'sedentary', type: 'lose', target_weight_kg: 47 }
  const p = planGoal(small, '2026-10-20')
  assert.equal(p.kcal_per_day, 1200)
  assert.equal(p.floored, true)
  const m = planGoal({ ...man, type: 'maintain', target_weight_kg: null }, '2026-10-20')
  assert.equal(m.kcal_per_day, 2760)
  assert.equal(m.weeks, null)
  assert.equal(m.carbs_pct + m.protein_pct + m.fat_pct, 100)
})

test('checkProfile guards minors and unhealthy targets', () => {
  const base = { sex: 'female', birth_date: '1996-01-01', height_cm: 165, weight_kg: 60, activity_level: 'light', type: 'lose', target_weight_kg: 55 }
  assert.deepEqual(checkProfile(base, '2026-10-20'), {})
  assert.match(checkProfile({ ...base, birth_date: '2010-06-01' }, '2026-10-20').type, /18 ans/)
  assert.match(checkProfile({ ...base, target_weight_kg: 48 }, '2026-10-20').target_weight_kg, /51 kg/)
  assert.match(checkProfile({ ...base, target_weight_kg: 62 }, '2026-10-20').target_weight_kg, /sous ton poids/)
  assert.ok(checkProfile({ ...base, height_cm: 90 }, '2026-10-20').height_cm)
  assert.deepEqual(checkProfile({ ...base, type: 'maintain', target_weight_kg: null }, '2026-10-20'), {})
})

import { scaleEntry } from './lib.js'

test('scaleEntry scales frozen nutrients by grams or servings', () => {
  assert.deepEqual(scaleEntry({ grams: 180, kcal: 234, carbs: 51.5, protein: 4.9, fat: 0.5 }, 90), { kcal: 117, carbs: 25.8, protein: 2.5, fat: 0.3 })
  assert.deepEqual(scaleEntry({ grams: null, servings: 1.5, kcal: 480, carbs: 60, protein: 30, fat: 12 }, 1), { kcal: 320, carbs: 40, protein: 20, fat: 8 })
})
