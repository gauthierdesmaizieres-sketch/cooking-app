// S11 Créer un aliment perso (valeurs de l'étiquette pour 100 g, portion facultative)
import { useState } from 'react'
import { Button, TextField } from '../ui.jsx'
import { parseNumber } from '../lib.js'
import { addFood } from '../data.js'
import { go } from '../App.jsx'
import TopBar from './TopBar.jsx'

const NUM = [
  ['kcal_100g', 'Énergie', 'kcal', true, 900],
  ['carbs_100g', 'Glucides', 'g', true, 100],
  ['sugar_100g', 'dont sucres', 'g', false, 100],
  ['protein_100g', 'Protéines', 'g', true, 100],
  ['fat_100g', 'Lipides', 'g', true, 100],
  ['fiber_100g', 'Fibres', 'g', false, 100],
  ['salt_100g', 'Sel', 'g', false, 100],
]

export default function NewFood({ meal, q }) {
  const day = q.get('day') ?? ''
  const [v, setV] = useState({ name: q.get('name') ?? '', brand: q.get('brand') ?? '', barcode: q.get('barcode') ?? '', servingLabel: '', servingGrams: '' })
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const set = k => e => setV(x => ({ ...x, [k]: e.target.value }))

  const errors = {}
  if (!v.name.trim()) errors.name = 'Donne un nom à cet aliment.'
  const nums = {}
  for (const [k, , , required, max] of NUM) {
    const raw = v[k] ?? ''
    if (!raw.trim()) { if (required) errors[k] = 'Obligatoire (0 si absent de l\'étiquette).'; continue }
    const n = parseNumber(raw, 0, max)
    if (n == null) errors[k] = `Entre un nombre entre 0 et ${max}.`
    else nums[k] = n
  }
  if (!errors.carbs_100g && !errors.protein_100g && !errors.fat_100g && (nums.carbs_100g ?? 0) + (nums.protein_100g ?? 0) + (nums.fat_100g ?? 0) > 100) {
    errors.fat_100g = 'Glucides + protéines + lipides dépassent 100 g pour 100 g.'
  }
  if (v.barcode.trim() && !/^\d{8,14}$/.test(v.barcode.trim())) errors.barcode = 'Un code-barres a 8 à 14 chiffres.'
  const sg = v.servingGrams.trim() ? parseNumber(v.servingGrams, 0.1, 5000) : undefined
  if (v.servingLabel.trim() && !sg) errors.servingGrams = 'Indique le poids de cette portion.'
  if (sg === null) errors.servingGrams = 'Poids invalide.'
  const valid = Object.keys(errors).length === 0
  const err = k => (touched ? errors[k] : undefined)

  async function save(e) {
    e.preventDefault()
    setTouched(true)
    if (!valid) return
    setSaving(true)
    setError(false)
    try {
      const food = await addFood(
        { name: v.name.trim(), brand: v.brand.trim() || null, barcode: v.barcode.trim() || null, ...nums },
        v.servingLabel.trim() && sg ? { label: v.servingLabel.trim(), grams: sg } : null,
      )
      go(`/food/${food.id}?meal=${meal}&day=${day}`)
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  return (
    <form className="page" onSubmit={save} noValidate>
      <TopBar title="Nouvel aliment" />
      <p className="muted">Recopie l'étiquette nutritionnelle, colonne « pour 100 g ».</p>
      <TextField id="name" label="Nom" value={v.name} onChange={set('name')} error={err('name')} autoComplete="off" />
      <TextField id="brand" label="Marque (facultatif)" value={v.brand} onChange={set('brand')} autoComplete="off" />
      <TextField id="barcode" label="Code-barres (facultatif)" inputMode="numeric" value={v.barcode} onChange={set('barcode')} error={err('barcode')} />

      <fieldset className="stack fieldset">
        <legend>Pour 100 g</legend>
        {NUM.map(([k, label, unit, required]) => (
          <TextField key={k} id={k} label={required ? label : `${label} (facultatif)`} inputMode="decimal" suffix={unit}
            value={v[k] ?? ''} onChange={set(k)} error={err(k)} />
        ))}
      </fieldset>

      <fieldset className="stack fieldset">
        <legend>Portion habituelle (facultatif)</legend>
        <TextField id="servingLabel" label="Nom de la portion" placeholder="ex. 1 pot, 1 tranche" value={v.servingLabel} onChange={set('servingLabel')} />
        <TextField id="servingGrams" label="Poids de la portion" inputMode="decimal" suffix="g" value={v.servingGrams} onChange={set('servingGrams')} error={err('servingGrams')} />
      </fieldset>

      {touched && !valid && <p className="form-error" role="alert">Corrige les champs signalés.</p>}
      {error && <p className="form-error" role="alert">L'enregistrement a échoué. Vérifie ta connexion et réessaie.</p>}
      <Button size="lg" block type="submit" loading={saving}>Enregistrer l'aliment</Button>
    </form>
  )
}
