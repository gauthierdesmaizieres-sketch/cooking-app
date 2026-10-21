// Open Food Facts product -> our foods row. OFF data is crowd-sourced: keep only values that pass the
// same limits as the foods table, otherwise return null and let the user type the label in.
export type OffProduct = {
  product_name?: string; product_name_fr?: string; brands?: string
  serving_size?: string; serving_quantity?: number | string
  nutriments?: Record<string, unknown>
}
export type FoodRow = {
  name: string; brand: string | null; barcode: string; source: 'off'; source_ref: string
  kcal_100g: number; carbs_100g: number; protein_100g: number; fat_100g: number
  fiber_100g: number | null; sugar_100g: number | null; salt_100g: number | null
}

const n = (v: unknown) => (v === '' || v == null ? NaN : Number(v))
const r1 = (x: number) => Math.round(x * 10) / 10
const opt = (v: unknown, max: number) => { const x = n(v); return x >= 0 && x <= max ? r1(x) : null }

export function nameOf(p: OffProduct) {
  return (p.product_name_fr || p.product_name || '').trim().slice(0, 120)
}

export function toFood(ean: string, p: OffProduct): FoodRow | null {
  const m = p.nutriments ?? {}
  let kcal = n(m['energy-kcal_100g'])
  if (Number.isNaN(kcal) && !Number.isNaN(n(m['energy_100g']))) kcal = n(m['energy_100g']) / 4.184 // kJ only
  const [carbs, protein, fat] = [m['carbohydrates_100g'], m['proteins_100g'], m['fat_100g']].map(n)
  const name = nameOf(p)
  if (!name || [kcal, carbs, protein, fat].some(Number.isNaN)) return null
  if (kcal < 0 || kcal > 900 || [carbs, protein, fat].some(x => x < 0 || x > 100) || carbs + protein + fat > 100.5) return null
  return {
    name, brand: (p.brands ?? '').split(',')[0].trim().slice(0, 80) || null, barcode: ean, source: 'off', source_ref: ean,
    kcal_100g: Math.round(kcal), carbs_100g: r1(carbs), protein_100g: r1(protein), fat_100g: r1(fat),
    fiber_100g: opt(m['fiber_100g'], 100), sugar_100g: opt(m['sugars_100g'], 100), salt_100g: opt(m['salt_100g'], 100),
  }
}

export function servingOf(p: OffProduct) {
  const g = n(p.serving_quantity)
  const label = (p.serving_size ?? '').trim().slice(0, 60)
  return label && g > 0 && g <= 5000 ? { label, grams: r1(g) } : null
}
