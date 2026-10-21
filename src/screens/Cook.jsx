// S14 Mode cuisine : une étape à la fois, gros texte, écran qui reste allumé
import { useEffect, useState } from 'react'
import { Button } from '../ui.jsx'
import { getRecipe } from '../data.js'
import { go } from '../App.jsx'
import TopBar from './TopBar.jsx'

// Keep the screen on while cooking (hands are busy). The lock drops when the tab hides; take it back on return.
function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock = null
    const take = () => document.visibilityState === 'visible' && navigator.wakeLock.request('screen').then(l => { lock = l }).catch(() => {})
    take()
    document.addEventListener('visibilitychange', take)
    return () => { document.removeEventListener('visibilitychange', take); lock?.release().catch(() => {}) }
  }, [])
}

export default function Cook({ recipeId, q }) {
  const [r, setR] = useState(undefined)
  const [i, setI] = useState(0) // 0 = gather ingredients, 1..n = steps
  useWakeLock()
  useEffect(() => { getRecipe(recipeId).then(setR).catch(() => setR(null)) }, [recipeId])

  const n = r?.steps?.length ?? 0
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowRight') setI(x => Math.min(x + 1, n))
      if (e.key === 'ArrowLeft') setI(x => Math.max(x - 1, 0))
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [n])

  if (r === undefined) return <div className="page"><TopBar title="Cuisiner" /><div className="skeleton card-skel" /></div>
  if (r === null) return <div className="page"><TopBar title="Cuisiner" onBack={() => go('/recipes')} /><p role="alert">Ce plat n'existe plus.</p></div>

  const portions = Number(q.get('for')) || r.servings
  const scale = portions / r.servings
  const exit = () => go(`/recipe/${r.id}`)

  return (
    <div className="page cook">
      <TopBar title={r.title} onBack={exit} />
      <p className="muted" aria-live="polite">{i === 0 ? `Préparation · ${portions} portion${portions > 1 ? 's' : ''}` : `Étape ${i} sur ${n}`}</p>
      <progress className="cook-progress" max={n} value={i} aria-label={`Étape ${i} sur ${n}`} />
      <div className="cook-body" aria-live="polite">
        {i === 0 ? (
          <>
            <h1>Sors les ingrédients</h1>
            <ul className="ingredients cook-list">
              {r.recipe_ingredients.map(x => <li key={x.id}><span>{x.foods.name}</span><span>{Math.round(x.grams * scale)} g</span></li>)}
            </ul>
            {n === 0 && <p className="muted">Ce plat n'a pas d'étapes écrites. Ajoute-les en modifiant le plat.</p>}
          </>
        ) : (
          <p className="cook-step">{r.steps[i - 1].text}</p>
        )}
      </div>
      <div className="add-actions cook-nav">
        <Button variant="secondary" size="lg" disabled={i === 0} onClick={() => setI(i - 1)}>Précédent</Button>
        {i < n
          ? <Button size="lg" onClick={() => setI(i + 1)}>{i === 0 ? 'Commencer' : 'Suivant'}</Button>
          : <Button size="lg" onClick={exit}>Terminé</Button>}
      </div>
    </div>
  )
}
