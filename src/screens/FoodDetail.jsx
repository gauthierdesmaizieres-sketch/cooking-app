// S10 Détail aliment : choisir portion + quantité, voir les nutriments, ajouter au journal
import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { Button, IconButton, NutritionLabel, TextField } from '../ui.jsx'
import { localDay, MEALS, mealLabel, nutrientsFor, parseNumber } from '../lib.js'
import { addDiaryEntries, getFood, isFavorite, setFavorite } from '../data.js'
import { go } from '../App.jsx'
import TopBar from './TopBar.jsx'

export default function FoodDetail({ foodId, q, notify }) {
  const day = q.get('day') || localDay()
  const [meal, setMeal] = useState(q.get('meal') || 'lunch')
  const [food, setFood] = useState(undefined) // undefined = loading, null = missing
  const [unit, setUnit] = useState('g') // 'g' or a serving id
  const [qty, setQty] = useState('100')
  const [fav, setFav] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [clientId] = useState(() => crypto.randomUUID()) // one log per visit, even on double tap

  useEffect(() => {
    getFood(foodId).then(f => {
      setFood(f)
      if (f?.servings?.length) { setUnit(f.servings[0].id); setQty('1') }
    }).catch(() => setFood(null))
    isFavorite({ food_id: foodId }).then(setFav).catch(() => {})
  }, [foodId])

  const serving = food?.servings?.find(s => s.id === unit)
  const n = parseNumber(qty, 0.01, unit === 'g' ? 5000 : 50)
  const grams = n == null ? null : Math.round((serving ? n * serving.grams : n) * 10) / 10
  const per100 = food && { kcal: food.kcal_100g, carbs: food.carbs_100g, protein: food.protein_100g, fat: food.fat_100g }
  const now = useMemo(() => (per100 && grams ? nutrientsFor(per100, grams) : null), [food, grams])
  const back = () => go(`/add/${meal}?day=${day}`)

  if (food === undefined) return <div className="page"><TopBar title="Aliment" onBack={back} /><div className="skeleton row-skel" /></div>
  if (food === null) {
    return (
      <div className="page">
        <TopBar title="Aliment" onBack={back} />
        <p role="alert">Cet aliment n'existe plus.</p>
      </div>
    )
  }

  async function toggleFav() {
    const next = !fav
    setFav(next)
    try { await setFavorite({ food_id: food.id }, next) } catch { setFav(!next) }
  }

  async function save() {
    setSaving(true)
    setError(false)
    try {
      await addDiaryEntries([{
        logged_on: day, meal, food_id: food.id, label: food.brand ? `${food.name} · ${food.brand}` : food.name,
        grams, ...now, method: q.get('via') === 'barcode' ? 'barcode' : 'search', client_id: clientId,
      }])
    } catch {
      setError(true)
      setSaving(false)
      return
    }
    notify(`${food.name} ajouté · ${now.kcal} kcal`)
    go(day === localDay() ? '/diary' : `/diary?day=${day}`)
  }

  const f = (v, g) => (v == null || !g ? null : Math.round((v * g) / 10) / 10)
  return (
    <div className="page">
      <TopBar title={mealLabel(meal)} onBack={back} />
      <header className="food-head">
        <div>
          <h1>{food.name}</h1>
          {food.brand && <p className="muted">{food.brand}</p>}
        </div>
        <IconButton label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} icon={Star} aria-pressed={fav}
          variant={fav ? 'filled' : 'plain'} onClick={toggleFav} />
      </header>

      <div className="portion">
        <TextField id="qty" label="Quantité" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)}
          error={n == null ? 'Quantité invalide' : undefined} />
        <div className="field">
          <label htmlFor="unit">Unité</label>
          <select id="unit" className="select" value={unit} onChange={e => {
            const u = e.target.value
            setUnit(u)
            setQty(u === 'g' ? String(grams ?? 100) : '1')
          }}>
            <option value="g">grammes</option>
            {food.servings.map(s => <option key={s.id} value={s.id}>{s.label} ({s.grams} g)</option>)}
          </select>
        </div>
      </div>

      <section className="card stack" aria-live="polite">
        <p><span className="kcal-big">{now?.kcal ?? '–'}</span> kcal{grams ? ` · ${grams} g` : ''}</p>
        <NutritionLabel caption="Pour cette quantité" rows={[
          ['Énergie', now?.kcal, 'kcal'],
          ['Glucides', now?.carbs, 'g'],
          ['dont sucres', f(food.sugar_100g, grams), 'g'],
          ['Protéines', now?.protein, 'g'],
          ['Lipides', now?.fat, 'g'],
          ['Fibres', f(food.fiber_100g, grams), 'g'],
          ['Sel', f(food.salt_100g, grams), 'g'],
        ]} />
        <p className="muted">Pour 100 g : {food.kcal_100g} kcal</p>
      </section>

      <div className="field">
        <label htmlFor="meal">Repas</label>
        <select id="meal" className="select" value={meal} onChange={e => setMeal(e.target.value)}>
          {MEALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      {error && <p className="form-error" role="alert">L'ajout a échoué. Vérifie ta connexion et réessaie.</p>}
      <Button size="lg" block loading={saving} disabled={!now} onClick={save}>Ajouter au journal</Button>
    </div>
  )
}
