// S15 Créer / modifier mon plat : photo, portions, ingrédients pesés -> kcal par portion, étapes
import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { BottomSheet, Button, Chip, FoodRow, IconButton, SearchField, Stepper, TextField } from '../ui.jsx'
import { nutrientsFor, parseGrams, parseNumber, totals } from '../lib.js'
import { deleteRecipe, getRecipe, saveRecipe, searchFoods, uploadRecipePhoto } from '../data.js'
import { go } from '../App.jsx'
import TopBar from './TopBar.jsx'
import { RecipePhoto, TAGS } from './recipeParts.jsx'

const per100 = f => ({ kcal: f.kcal_100g, carbs: f.carbs_100g, protein: f.protein_100g, fat: f.fat_100g })

export default function RecipeEdit({ recipeId, notify }) {
  const isNew = !recipeId
  const [loaded, setLoaded] = useState(isNew ? {} : undefined)
  const [title, setTitle] = useState('')
  const [servings, setServings] = useState(2)
  const [minutes, setMinutes] = useState('')
  const [tags, setTags] = useState([])
  const [items, setItems] = useState([]) // [{ key, food, gramsText }]
  const [stepsText, setStepsText] = useState('')
  const [photoPath, setPhotoPath] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [q, setQ] = useState('')
  const [found, setFound] = useState([])
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (isNew) return
    getRecipe(recipeId).then(r => {
      if (!r || !r.owner_id) return setLoaded(null)
      setLoaded(r)
      setTitle(r.title); setServings(r.servings); setMinutes(r.prep_minutes ?? ''); setTags(r.tags)
      setPhotoPath(r.photo_path)
      setItems(r.recipe_ingredients.map(i => ({ key: i.id, food: i.foods, gramsText: String(i.grams) })))
      setStepsText((r.steps ?? []).map(s => s.text).join('\n'))
    }).catch(() => setLoaded(null))
  }, [recipeId])

  useEffect(() => {
    let live = true
    const t = setTimeout(() => searchFoods(q).then(r => live && setFound(r)).catch(() => {}), 150)
    return () => { live = false; clearTimeout(t) }
  }, [q])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const rows = items.map(i => ({ ...i, grams: parseGrams(i.gramsText) }))
  const sum = totals(rows.filter(r => r.grams).map(r => nutrientsFor(per100(r.food), r.grams)))
  const mins = String(minutes).trim() === '' ? null : parseNumber(minutes, 0, 1440)
  const errors = {}
  if (!title.trim()) errors.title = 'Donne un nom à ton plat.'
  if (rows.length === 0) errors.items = 'Ajoute au moins un ingrédient.'
  if (rows.some(r => !r.grams)) errors.items = 'Chaque ingrédient a besoin d\'un poids entre 1 et 5000 g.'
  if (mins === null && String(minutes).trim() !== '') errors.minutes = 'Entre un nombre de minutes.'
  const valid = Object.keys(errors).length === 0

  function pickPhoto(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f?.type.startsWith('image/')) return
    setPhotoFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function save() {
    setTouched(true)
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      const path = photoFile ? await uploadRecipePhoto(photoFile) : photoPath
      const id = await saveRecipe({
        id: recipeId ?? null, title: title.trim(), photo_path: path, servings, prep_minutes: mins == null ? null : Math.round(mins), tags,
        steps: stepsText.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text })),
      }, rows.map(r => ({ food_id: r.food.id, grams: r.grams })))
      notify(isNew ? 'Plat créé' : 'Plat enregistré')
      go(`/recipe/${id}`)
    } catch (e) {
      setError(e.message === 'not-image' ? "Cette photo ne peut pas être lue." : "L'enregistrement a échoué. Vérifie ta connexion et réessaie : rien n'est perdu.")
      setSaving(false)
    }
  }

  async function remove() {
    try {
      await deleteRecipe(loaded)
      notify(`${loaded.title} supprimé`)
      go('/recipes')
    } catch {
      setConfirmDelete(false)
      setError("La suppression a échoué. Vérifie ta connexion et réessaie.")
    }
  }

  if (loaded === undefined) return <div className="page"><TopBar title="Modifier le plat" /><div className="skeleton row-skel" /></div>
  if (loaded === null) return <div className="page"><TopBar title="Modifier le plat" onBack={() => go('/recipes')} /><p role="alert">Ce plat n'existe plus.</p></div>

  return (
    <div className="page">
      <TopBar title={isNew ? 'Nouveau plat' : 'Modifier le plat'} onBack={() => go(isNew ? '/recipes' : `/recipe/${recipeId}`)} />

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
      <button type="button" className="photo-pick" onClick={() => fileRef.current.click()} aria-label={preview || photoPath ? 'Changer la photo' : 'Ajouter une photo'}>
        {preview || photoPath ? <RecipePhoto path={photoPath} src={preview} alt="" /> : <span className="muted"><ImagePlus size={28} aria-hidden="true" /> Ajouter une photo</span>}
      </button>

      <TextField id="title" label="Nom du plat" value={title} onChange={e => setTitle(e.target.value)} error={touched ? errors.title : undefined} autoComplete="off" />

      <div className="portion">
        <div className="field">
          <span className="field-label">Nombre de portions</span>
          <Stepper value={servings} onChange={setServings} min={1} max={100} label="les portions" />
        </div>
        <TextField id="minutes" label="Préparation" inputMode="numeric" suffix="min" value={minutes} onChange={e => setMinutes(e.target.value)}
          error={touched ? errors.minutes : undefined} />
      </div>

      <div className="chips" role="group" aria-label="Étiquettes">
        {TAGS.map(([id, label]) => (
          <Chip key={id} on={tags.includes(id)} onClick={() => setTags(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]))}>{label}</Chip>
        ))}
      </div>

      <section className="stack" aria-labelledby="ing-h">
        <h2 id="ing-h" className="section-title">Ingrédients (poids cru)</h2>
        {rows.length > 0 && (
          <ul className="review-list card">
            {rows.map(r => (
              <li key={r.key} className="review-item">
                <div className="review-name"><span>{r.food.name}</span></div>
                <div className="review-edit">
                  <div className={`field-box review-grams${r.grams ? '' : ' is-invalid'}`}>
                    <input inputMode="decimal" aria-label={`Poids de ${r.food.name} en grammes`} value={r.gramsText} aria-invalid={!r.grams}
                      onChange={e => setItems(xs => xs.map(x => (x.key === r.key ? { ...x, gramsText: e.target.value } : x)))} />
                    <span className="field-suffix">g</span>
                  </div>
                  <span className="review-kcal">{r.grams ? nutrientsFor(per100(r.food), r.grams).kcal : '–'} kcal</span>
                  <IconButton label={`Retirer ${r.food.name}`} icon={Trash2} onClick={() => setItems(xs => xs.filter(x => x.key !== r.key))} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <SearchField value={q} onChange={setQ} label="Ajouter un ingrédient" />
        {q && (
          <div aria-live="polite">
            {found.length === 0 && <p className="muted">Aucun aliment trouvé. Crée-le d'abord depuis le journal (Ajouter → Créer un aliment).</p>}
            {found.slice(0, 8).map(f => (
              <FoodRow key={f.id} name={f.name} detail="pour 100 g" kcal={f.kcal_100g}
                onClick={() => { setItems(xs => [...xs, { key: crypto.randomUUID(), food: f, gramsText: '100' }]); setQ('') }} />
            ))}
          </div>
        )}
        {touched && errors.items && <p className="form-error" role="alert">{errors.items}</p>}
      </section>

      <div className="review-total card" aria-live="polite">
        <strong>{servings > 0 ? Math.round(sum.kcal / servings) : 0} kcal / portion</strong>
        <span className="muted">{sum.kcal} kcal au total</span>
      </div>

      <div className="field">
        <label htmlFor="steps">Étapes (une par ligne, facultatif)</label>
        <textarea id="steps" className="textarea" rows={6} value={stepsText} onChange={e => setStepsText(e.target.value)} />
      </div>

      {touched && !valid && <p className="form-error" role="alert">Corrige les champs signalés.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button size="lg" block loading={saving} onClick={save}>Enregistrer le plat</Button>
      {!isNew && <Button variant="ghost" onClick={() => setConfirmDelete(true)}>Supprimer ce plat</Button>}

      <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer ce plat ?">
        <div className="stack">
          <p>La recette et sa photo seront effacées. Ce que tu as déjà noté dans ton journal reste.</p>
          <Button variant="danger" block onClick={remove}>Supprimer</Button>
          <Button variant="secondary" block onClick={() => setConfirmDelete(false)}>Annuler</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
