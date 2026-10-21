// S12 Mes plats : liste, recherche, filtres
import { useEffect, useState } from 'react'
import { CookingPot, Plus, SearchX } from 'lucide-react'
import { Button, Chip, EmptyState, SearchField } from '../ui.jsx'
import { recipeFor } from '../lib.js'
import { listRecipes } from '../data.js'
import { go } from '../App.jsx'
import { RecipePhoto, TAGS } from './recipeParts.jsx'

const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Recipes() {
  const [list, setList] = useState(null)
  const [error, setError] = useState(false)
  const [text, setText] = useState('')
  const [on, setOn] = useState({}) // tag id -> true, plus 'quick'

  const load = () => { setError(false); listRecipes().then(setList).catch(() => setError(true)) }
  useEffect(load, [])

  const shown = (list ?? []).filter(r =>
    fold(r.title).includes(fold(text.trim())) &&
    Object.keys(on).filter(k => on[k]).every(k => (k === 'quick' ? r.prep_minutes != null && r.prep_minutes <= 20 : r.tags.includes(k))))
  const toggle = k => setOn(x => ({ ...x, [k]: !x[k] }))

  return (
    <div className="page">
      <header className="food-head">
        <h1>Mes plats</h1>
        <Button size="sm" onClick={() => go('/recipe/new')}><Plus size={16} aria-hidden="true" /> Nouveau plat</Button>
      </header>

      {error && (
        <div className="stack">
          <p role="alert">Impossible de charger tes plats.</p>
          <Button variant="secondary" onClick={load}>Réessayer</Button>
        </div>
      )}

      {list?.length === 0 && (
        <EmptyState icon={CookingPot} title="Aucun plat pour l'instant"
          text="Crée tes plats maison une fois : leurs calories par portion sont calculées, et tu les ajoutes au journal en un geste."
          action={<Button onClick={() => go('/recipe/new')}>Créer mon premier plat</Button>} />
      )}

      {list?.length > 0 && (
        <>
          <SearchField value={text} onChange={setText} label="Rechercher un plat" />
          <div className="chips" role="group" aria-label="Filtres">
            {TAGS.map(([id, label]) => <Chip key={id} on={!!on[id]} onClick={() => toggle(id)}>{label}</Chip>)}
            <Chip on={!!on.quick} onClick={() => toggle('quick')}>20 min max</Chip>
          </div>
          {shown.length === 0 && <EmptyState icon={SearchX} title="Aucun plat ne correspond" text="Retire un filtre ou change ta recherche." />}
          <ul className="recipe-grid">
            {shown.map(r => (
              <li key={r.id}>
                <a className="recipe-card card" href={`#/recipe/${r.id}`}>
                  <RecipePhoto path={r.photo_path} alt="" />
                  <span className="recipe-card-title">{r.title}</span>
                  <span className="muted">
                    {recipeFor(r, 1).kcal} kcal / portion{r.prep_minutes != null ? ` · ${r.prep_minutes} min` : ''}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {!list && !error && <div className="recipe-grid"><div className="skeleton card-skel" /><div className="skeleton card-skel" /></div>}
    </div>
  )
}
