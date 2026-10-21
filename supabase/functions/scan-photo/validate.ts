// Model output is untrusted: clamp to sane ranges and make kcal agree with the macros.
export type RawItem = { label: unknown; grams: unknown; kcal: unknown; carbs: unknown; protein: unknown; fat: unknown; confidence: unknown }
export type Item = { label: string; grams: number; per100: { kcal: number; carbs: number; protein: number; fat: number }; confidence: number }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN)
const r1 = (n: number) => Math.round(n * 10) / 10

export function checkItems(raw: RawItem[]): Item[] {
  const out: Item[] = []
  for (const r of Array.isArray(raw) ? raw.slice(0, 20) : []) {
    const label = typeof r?.label === 'string' ? r.label.trim().slice(0, 80) : ''
    const grams = Math.round(num(r?.grams))
    let [kcal, carbs, protein, fat] = [r?.kcal, r?.carbs, r?.protein, r?.fat].map(v => Math.max(0, num(v)))
    if (!label || !(grams >= 1 && grams <= 2000) || [kcal, carbs, protein, fat].some(Number.isNaN)) continue
    const fromMacros = 4 * carbs + 4 * protein + 9 * fat
    if (Math.abs(kcal - fromMacros) > 0.25 * Math.max(kcal, fromMacros) + 20) kcal = fromMacros
    const per = (v: number) => r1((v / grams) * 100)
    const per100 = { kcal: Math.round((kcal / grams) * 100), carbs: per(carbs), protein: per(protein), fat: per(fat) }
    if (per100.kcal > 900) continue // denser than pure fat: impossible
    const c = num(r?.confidence)
    out.push({ label, grams, per100, confidence: Number.isNaN(c) ? 0.5 : Math.min(1, Math.max(0, c)) })
  }
  return out
}
