// S06 Ajouter un aliment : photo, code-barres, recherche, favoris, récents, plats perso
import { useEffect, useState } from 'react'
import { Barcode, Camera, Plus, SearchX } from 'lucide-react'
import { Button, EmptyState, FoodRow, SearchField } from '../ui.jsx'
import { mealLabel } from '../lib.js'
import { listFavorites, listRecents, searchFoods } from '../data.js'
import { go } from '../App.jsx'
import TopBar from './TopBar.jsx'

export default function AddFood({ meal, q }) {
  const day = q.get('day') ?? ''
  const ctx = `meal=${meal}&day=${day}`
  const [text, setText] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [favs, setFavs] = useState([])
  const [recents, setRecents] = useState([])

  useEffect(() => {
    listFavorites().then(setFavs).catch(() => {})
    listRecents().then(setRecents).catch(() => {})
  }, [])

  useEffect(() => {
    let live = true
    setLoading(true)
    const t = setTimeout(() => searchFoods(text).then(r => { if (live) { setResults(r); setLoading(false) } }), 150)
    return () => { live = false; clearTimeout(t) }
  }, [text])

  const open = (foodId, recipeId) => go(foodId ? `/food/${foodId}?${ctx}` : `/recipe/${recipeId}?${ctx}`)
  const create = () => go(`/new-food/${meal}?day=${day}&name=${encodeURIComponent(text.trim())}`)

  return (
    <div className="page">
      <TopBar title={mealLabel(meal)} onBack={() => go(day ? `/diary?day=${day}` : '/diary')} />
      <div className="add-actions">
        <Button onClick={() => go(`/scan/${meal}?day=${day}`)}><Camera size={18} aria-hidden="true" /> Photo du plat</Button>
        <Button variant="secondary" onClick={() => go(`/barcode/${meal}?day=${day}`)}><Barcode size={18} aria-hidden="true" /> Code-barres</Button>
      </div>
      <SearchField value={text} onChange={setText} label="Rechercher un aliment" loading={loading && !!text} />

      {text ? (
        <div aria-live="polite">
          {!loading && results.length === 0 && (
            <EmptyState icon={SearchX} title="Aucun aliment trouvé" text="Essaie un autre mot, ou crée cet aliment avec les valeurs de son étiquette."
              action={<Button variant="secondary" size="sm" onClick={create}>Créer « {text.trim()} »</Button>} />
          )}
          {results.map(f => (
            <FoodRow key={f.id} name={f.name} detail={[f.brand, 'pour 100 g'].filter(Boolean).join(' · ')} kcal={f.kcal_100g}
              onClick={() => open(f.id)} />
          ))}
        </div>
      ) : (
        <>
          {favs.length > 0 && (
            <section className="stack" aria-labelledby="favs-h">
              <h2 id="favs-h" className="section-title">Favoris</h2>
              <div>
                {favs.map(f => f.foods
                  ? <FoodRow key={`f${f.food_id}`} name={f.foods.name} detail="pour 100 g" kcal={f.foods.kcal_100g} onClick={() => open(f.food_id)} />
                  : <FoodRow key={`r${f.recipe_id}`} name={f.recipes.title} detail="1 portion"
                      kcal={Math.round(f.recipes.kcal_total / f.recipes.servings)} onClick={() => open(null, f.recipe_id)} />)}
              </div>
            </section>
          )}
          {recents.length > 0 && (
            <section className="stack" aria-labelledby="recents-h">
              <h2 id="recents-h" className="section-title">Récents</h2>
              <div>
                {recents.map(r => (
                  <FoodRow key={r.food_id ?? r.recipe_id} name={r.label} detail={r.grams ? `dernière fois ${r.grams} g` : `dernière fois ${r.servings} portion(s)`}
                    kcal={Math.round(r.kcal)} onClick={() => open(r.food_id, r.recipe_id)} />
                ))}
              </div>
            </section>
          )}
          {favs.length === 0 && recents.length === 0 && (
            <p className="muted">Cherche un aliment, scanne un code-barres ou prends ton plat en photo. Ce que tu ajoutes souvent apparaîtra ici.</p>
          )}
        </>
      )}
      <Button variant="ghost" onClick={create}><Plus size={18} aria-hidden="true" /> Créer un aliment</Button>
    </div>
  )
}
