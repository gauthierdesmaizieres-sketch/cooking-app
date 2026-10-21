// S13 Détail recette : kcal par portion, ingrédients recalculés selon les portions, étapes, ajout au journal
import { useEffect, useState } from 'react'
import { ChefHat, Pencil, Star } from 'lucide-react'
import { BottomSheet, Button, IconButton, Stepper, TextField } from '../ui.jsx'
import { localDay, MEALS, mealForHour, parseNumber, recipeFor } from '../lib.js'
import { addDiaryEntries, getRecipe, isFavorite, setFavorite } from '../data.js'
import { go } from '../App.jsx'
import TopBar from './TopBar.jsx'
import { RecipePhoto, tagLabel } from './recipeParts.jsx'

export default function RecipeDetail({ recipeId, q, notify }) {
  const day = q.get('day') || localDay()
  const [r, setR] = useState(undefined)
  const [cookFor, setCookFor] = useState(null) // portions shown in the ingredient list
  const [fav, setFav] = useState(false)
  const [sheet, setSheet] = useState(!!q.get('meal'))
  const [meal, setMeal] = useState(q.get('meal') || mealForHour(new Date().getHours()))
  const [eaten, setEaten] = useState('1')
  const [clientId, setClientId] = useState(() => crypto.randomUUID())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    getRecipe(recipeId).then(x => { setR(x); setCookFor(x?.servings ?? 1) }).catch(() => setR(null))
    isFavorite({ recipe_id: recipeId }).then(setFav).catch(() => {})
  }, [recipeId])

  if (r === undefined) return <div className="page"><TopBar title="Plat" /><div className="skeleton card-skel" /></div>
  if (r === null) return <div className="page"><TopBar title="Plat" onBack={() => go('/recipes')} /><p role="alert">Ce plat n'existe plus.</p></div>

  const one = recipeFor(r, 1)
  const n = parseNumber(eaten, 0.1, 20)
  const mine = !!r.owner_id
  const scale = cookFor / r.servings

  async function toggleFav() {
    const next = !fav
    setFav(next)
    try { await setFavorite({ recipe_id: r.id }, next) } catch { setFav(!next) }
  }

  async function add() {
    setSaving(true)
    setError(false)
    try {
      await addDiaryEntries([{ logged_on: day, meal, recipe_id: r.id, label: r.title, servings: n, ...recipeFor(r, n), method: 'recipe', client_id: clientId }])
    } catch {
      setError(true)
      setSaving(false)
      return
    }
    notify(`${r.title} ajouté · ${recipeFor(r, n).kcal} kcal`)
    go(day === localDay() ? '/diary' : `/diary?day=${day}`)
  }

  return (
    <div className="page">
      <TopBar title="Plat" onBack={() => history.back()} />
      <RecipePhoto path={r.photo_path} alt={r.title} className="recipe-hero" />
      <header className="food-head">
        <div>
          <h1>{r.title}</h1>
          <p className="muted">
            {[r.prep_minutes != null && `${r.prep_minutes} min`, `${r.servings} portion${r.servings > 1 ? 's' : ''}`, ...r.tags.map(tagLabel)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <IconButton label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} icon={Star} aria-pressed={fav} variant={fav ? 'filled' : 'plain'} onClick={toggleFav} />
      </header>

      <section className="card stack" aria-label="Par portion">
        <p><span className="kcal-big">{one.kcal}</span> kcal par portion</p>
        <p className="muted">Glucides {one.carbs} g · Protéines {one.protein} g · Lipides {one.fat} g</p>
      </section>

      <div className="stack">
        <Button block onClick={() => { setClientId(crypto.randomUUID()); setSheet(true) }}>Ajouter au journal</Button>
        <Button variant="secondary" block onClick={() => go(`/cook/${r.id}?for=${cookFor}`)}><ChefHat size={18} aria-hidden="true" /> Cuisiner</Button>
      </div>

      <section className="stack" aria-labelledby="ing-h">
        <div className="food-head">
          <h2 id="ing-h" className="section-title">Ingrédients</h2>
          <Stepper value={cookFor} onChange={setCookFor} min={1} max={100} label="les portions à cuisiner" />
        </div>
        <p className="muted">Pour {cookFor} portion{cookFor > 1 ? 's' : ''}</p>
        <ul className="ingredients">
          {r.recipe_ingredients.map(i => (
            <li key={i.id}><span>{i.foods.name}</span><span>{Math.round(i.grams * scale)} g</span></li>
          ))}
        </ul>
      </section>

      {r.steps?.length > 0 && (
        <section className="stack" aria-labelledby="steps-h">
          <h2 id="steps-h" className="section-title">Étapes</h2>
          <ol className="steps">{r.steps.map((s, i) => <li key={i}>{s.text}</li>)}</ol>
        </section>
      )}

      {mine && <Button variant="ghost" onClick={() => go(`/recipe/${r.id}/edit`)}><Pencil size={16} aria-hidden="true" /> Modifier le plat</Button>}

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Ajouter au journal">
        <div className="stack">
          <TextField id="eaten" label="Portions mangées" inputMode="decimal" value={eaten} onChange={e => setEaten(e.target.value)}
            error={n == null ? 'Entre un nombre entre 0,1 et 20.' : undefined} />
          <div className="field">
            <label htmlFor="meal">Repas</label>
            <select id="meal" className="select" value={meal} onChange={e => setMeal(e.target.value)}>
              {MEALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <p aria-live="polite"><strong>{n ? recipeFor(r, n).kcal : '–'} kcal</strong></p>
          {error && <p className="form-error" role="alert">L'ajout a échoué. Vérifie ta connexion et réessaie.</p>}
          <Button block loading={saving} disabled={!n} onClick={add}>Ajouter</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
