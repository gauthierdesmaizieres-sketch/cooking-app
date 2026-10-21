// Pure helpers (no DOM, no storage) so they can be tested with node --test.

export const MEALS = [
  { id: 'breakfast', label: 'Petit-déjeuner' },
  { id: 'lunch', label: 'Déjeuner' },
  { id: 'dinner', label: 'Dîner' },
  { id: 'snack', label: 'En-cas' },
]
export const mealLabel = id => MEALS.find(m => m.id === id)?.label ?? id

// The user's local calendar day, never derived from UTC (a 23:30 snack stays on today).
export function localDay(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number)
  return localDay(new Date(y, m - 1, d + n))
}

export function formatDay(day, today = localDay()) {
  if (day === today) return "Aujourd'hui"
  if (day === addDays(today, -1)) return 'Hier'
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Default meal from the clock, so "+" from the diary header lands where people expect.
export function mealForHour(h) {
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 18) return 'snack'
  return 'dinner'
}

const r1 = n => Math.round(n * 10) / 10

// per100 = { kcal, carbs, protein, fat } per 100 g
export function nutrientsFor(per100, grams) {
  const g = Number(grams)
  if (!(g > 0)) return { kcal: 0, carbs: 0, protein: 0, fat: 0 }
  const f = g / 100
  return { kcal: Math.round(per100.kcal * f), carbs: r1(per100.carbs * f), protein: r1(per100.protein * f), fat: r1(per100.fat * f) }
}

export function totals(entries) {
  const t = { kcal: 0, carbs: 0, protein: 0, fat: 0 }
  for (const e of entries) for (const k in t) t[k] += Number(e[k]) || 0
  for (const k in t) t[k] = k === 'kcal' ? Math.round(t[k]) : r1(t[k])
  return t
}

// 4 kcal/g carbs & protein, 9 kcal/g fat
export function macroGoals({ kcal_per_day, carbs_pct, protein_pct, fat_pct }) {
  return {
    carbs: Math.round(kcal_per_day * carbs_pct / 100 / 4),
    protein: Math.round(kcal_per_day * protein_pct / 100 / 4),
    fat: Math.round(kcal_per_day * fat_pct / 100 / 9),
  }
}

// Grams typed by a person: accepts "12,5", rejects empty / negative / absurd.
export function parseGrams(text) {
  const n = Number(String(text).replace(',', '.').trim())
  return Number.isFinite(n) && n > 0 && n <= 5000 ? n : null
}

// Nutrients for n servings of a recipe whose *_total columns cover the whole pot.
export function recipeFor(recipe, n) {
  const f = recipe.servings > 0 ? Number(n) / recipe.servings : 0
  return {
    kcal: Math.round(recipe.kcal_total * f), carbs: r1(recipe.carbs_total * f),
    protein: r1(recipe.protein_total * f), fat: r1(recipe.fat_total * f),
  }
}

// Decimal typed by a person ("2,5"), within [min, max]; null otherwise.
export function parseNumber(text, min = 0, max = Infinity) {
  const s = String(text).replace(',', '.').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

// ---- onboarding (S01–S03)

export const ACTIVITY = [
  ['sedentary', 'Sédentaire', 'Bureau, peu de marche', 1.2],
  ['light', 'Peu actif', 'Marche, sport 1–2 fois/semaine', 1.375],
  ['moderate', 'Actif', 'Sport 3–4 fois/semaine', 1.55],
  ['active', 'Très actif', 'Sport presque tous les jours', 1.725],
  ['very_active', 'Extrêmement actif', 'Métier physique + sport', 1.9],
]

export function ageOn(birthDate, today = localDay()) {
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

// Mifflin-St Jeor resting energy; 'other' uses the midpoint of the two sex constants.
export function bmr({ sex, weight_kg, height_cm, age }) {
  const s = sex === 'male' ? 5 : sex === 'female' ? -161 : -78
  return 10 * weight_kg + 6.25 * height_cm - 5 * age + s
}

export const bmi = (kg, cm) => kg / (cm / 100) ** 2

const KCAL_FLOOR = { male: 1500, female: 1200, other: 1350 } // common clinical minimums without supervision
const MACROS = { lose: [40, 30, 30], maintain: [50, 20, 30], gain: [45, 25, 30] }

// p: { sex, birth_date, height_cm, weight_kg, activity_level, type: lose|maintain|gain, target_weight_kg? }
// -> { kcal_per_day, carbs_pct, protein_pct, fat_pct, tdee, weeks, floored }
export function planGoal(p, today = localDay()) {
  const age = ageOn(p.birth_date, today)
  const tdee = bmr({ ...p, age }) * ACTIVITY.find(a => a[0] === p.activity_level)[3]
  const delta = p.type === 'lose' ? -500 : p.type === 'gain' ? 300 : 0 // ~0.5 kg/week down, ~0.3 kg/week up
  const floor = KCAL_FLOOR[p.sex] ?? 1350
  const raw = Math.round((tdee + delta) / 10) * 10
  const kcal = Math.min(6000, Math.max(floor, raw))
  const [carbs_pct, protein_pct, fat_pct] = MACROS[p.type]
  const diff = p.target_weight_kg ? Math.abs(p.weight_kg - p.target_weight_kg) : 0
  const perWeek = p.type === 'lose' ? 0.5 : p.type === 'gain' ? 0.3 : 0
  return {
    kcal_per_day: kcal, carbs_pct, protein_pct, fat_pct, tdee: Math.round(tdee),
    weeks: perWeek && diff ? Math.ceil(diff / perWeek) : null, floored: kcal > raw,
  }
}

// Returns an error message for the field, or null. Adults only for a calorie deficit; no target under BMI 18.5.
export function checkProfile(p, today = localDay()) {
  const e = {}
  const age = p.birth_date ? ageOn(p.birth_date, today) : null
  if (!p.sex) e.sex = 'Choisis une option.'
  if (age == null || age < 13 || age > 110) e.birth_date = 'Entre une date de naissance valide (13 ans minimum).'
  if (!(p.height_cm >= 120 && p.height_cm <= 230)) e.height_cm = 'Entre une taille entre 120 et 230 cm.'
  if (!(p.weight_kg >= 30 && p.weight_kg <= 300)) e.weight_kg = 'Entre un poids entre 30 et 300 kg.'
  if (!p.activity_level) e.activity_level = 'Choisis ton niveau d\'activité.'
  if (p.type === 'lose' && age != null && age < 18) e.type = 'Avant 18 ans, l\'app ne propose pas de perte de poids. Parles-en à un médecin.'
  if (p.type !== 'maintain' && !e.height_cm && !e.weight_kg) {
    const t = p.target_weight_kg
    if (!(t >= 30 && t <= 300)) e.target_weight_kg = 'Entre un poids cible entre 30 et 300 kg.'
    else if (p.type === 'lose' && t >= p.weight_kg) e.target_weight_kg = 'Pour perdre du poids, la cible doit être sous ton poids actuel.'
    else if (p.type === 'gain' && t <= p.weight_kg) e.target_weight_kg = 'Pour prendre du poids, la cible doit être au-dessus de ton poids actuel.'
    else if (p.type === 'lose' && bmi(t, p.height_cm) < 18.5) e.target_weight_kg = `Cette cible est sous un IMC de 18,5. Le minimum conseillé pour ta taille est ${Math.ceil(18.5 * (p.height_cm / 100) ** 2)} kg.`
  }
  return e
}

// Editing an entry's amount: nutrients were frozen at log time, so scale them by the ratio
// (works for foods, dishes and photo estimates alike, without re-reading the source).
export function scaleEntry(e, amount) {
  const old = Number(e.grams ?? e.servings)
  const f = old > 0 ? amount / old : 0
  return { kcal: Math.round(e.kcal * f), carbs: r1(e.carbs * f), protein: r1(e.protein * f), fat: r1(e.fat * f) }
}
