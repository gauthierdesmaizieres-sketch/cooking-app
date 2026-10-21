// S01 objectif -> S02 questionnaire (3 étapes) -> S03 plan calculé. Aussi « Mes objectifs » depuis le profil.
import { useEffect, useState } from 'react'
import { Button, TextField } from '../ui.jsx'
import { ACTIVITY, checkProfile, localDay, macroGoals, parseNumber, planGoal } from '../lib.js'
import { getProfile, saveOnboarding } from '../data.js'
import { go } from '../App.jsx'
import TopBar from './TopBar.jsx'

const GOALS = [
  ['lose', 'Perdre du poids', 'Environ 0,5 kg par semaine'],
  ['maintain', 'Garder mon poids', 'Manger équilibré, suivre mes apports'],
  ['gain', 'Prendre du poids', 'Ou du muscle, environ 0,3 kg par semaine'],
]
const SEXES = [['female', 'Femme'], ['male', 'Homme'], ['other', 'Je préfère ne pas dire']]
// fields checked before leaving each step (S01, S02a, S02b, S02c)
const STEP_FIELDS = [['type'], ['sex', 'birth_date', 'height_cm'], ['weight_kg', 'target_weight_kg', 'type'], ['activity_level']]

function Choices({ name, legend, options, value, onChange, error }) {
  return (
    <fieldset className="choices" aria-describedby={error ? `${name}-err` : undefined}>
      <legend>{legend}</legend>
      {options.map(([id, label, hint]) => (
        <label key={id} className={`choice${value === id ? ' choice-on' : ''}`}>
          <input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} />
          <span><strong>{label}</strong>{hint && <span className="muted">{hint}</span>}</span>
        </label>
      ))}
      {error && <p id={`${name}-err`} className="field-msg" role="alert">{error}</p>}
    </fieldset>
  )
}

export default function Onboarding({ firstRun = false, onDone, notify }) {
  const [step, setStep] = useState(0)
  const [v, setV] = useState({ type: '', sex: '', birth_date: '', height: '', weight: '', target: '', activity_level: '' })
  const [shown, setShown] = useState({}) // errors are shown per step once the user tried "Continuer"
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (firstRun) return
    getProfile().then(({ profile: p, goal: g }) => setV(x => ({
      ...x,
      type: g?.type ?? '', sex: p?.sex ?? '', birth_date: p?.birth_date ?? '', height: p?.height_cm ?? '',
      weight: g?.start_weight_kg ?? '', target: g?.target_weight_kg ?? '', activity_level: p?.activity_level ?? '',
    }))).catch(() => {})
  }, [firstRun])

  const set = k => val => setV(x => ({ ...x, [k]: val }))
  const p = {
    type: v.type, sex: v.sex, birth_date: v.birth_date, activity_level: v.activity_level,
    height_cm: parseNumber(v.height, 0), weight_kg: parseNumber(v.weight, 0),
    target_weight_kg: v.type === 'maintain' ? null : parseNumber(v.target, 0),
  }
  const errors = checkProfile(p)
  if (!v.type) errors.type = 'Choisis un objectif.'
  const stepErrors = s => STEP_FIELDS[s].filter(f => errors[f])
  const err = f => (shown[step] ? errors[f] : undefined)

  function next() {
    setShown(x => ({ ...x, [step]: true }))
    if (stepErrors(step).length === 0) setStep(step + 1)
  }

  const plan = step === 4 ? planGoal(p) : null
  const grams = plan && macroGoals(plan)
  const targetDate = plan?.weeks && new Date(Date.now() + plan.weeks * 7 * 864e5).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  async function finish() {
    setSaving(true)
    setError(false)
    try {
      await saveOnboarding(
        { sex: p.sex, birth_date: p.birth_date, height_cm: p.height_cm, activity_level: p.activity_level, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        { type: p.type, target_weight_kg: p.target_weight_kg, kcal_per_day: plan.kcal_per_day, carbs_pct: plan.carbs_pct, protein_pct: plan.protein_pct, fat_pct: plan.fat_pct },
        p.weight_kg, localDay(),
      )
    } catch {
      setError(true)
      setSaving(false)
      return
    }
    if (!firstRun) notify?.('Objectifs mis à jour')
    onDone ? onDone() : go('/diary')
  }

  const back = step > 0 ? () => setStep(step - 1) : firstRun ? null : () => go('/profile')
  return (
    <div className="page onboarding">
      {back ? <TopBar title={firstRun ? 'Ton objectif' : 'Mes objectifs'} onBack={back} /> : <div className="topbar" />}
      {step < 4 && <p className="muted">Étape {step + 1} sur 4</p>}
      {step < 4 && <progress className="cook-progress" max={4} value={step + 1} aria-hidden="true" />}

      {step === 0 && (
        <>
          <h1>Quel est ton objectif ?</h1>
          <Choices name="type" legend="Objectif" options={GOALS} value={v.type} onChange={set('type')} error={err('type')} />
        </>
      )}

      {step === 1 && (
        <>
          <h1>Parle-nous de toi</h1>
          <p className="muted">Ces infos servent seulement à estimer ta dépense d'énergie.</p>
          <Choices name="sex" legend="Sexe (pour la formule de calcul)" options={SEXES} value={v.sex} onChange={set('sex')} error={err('sex')} />
          <TextField id="birth_date" label="Date de naissance" type="date" max={localDay()} value={v.birth_date}
            onChange={e => set('birth_date')(e.target.value)} error={err('birth_date')} />
          <TextField id="height" label="Taille" inputMode="numeric" suffix="cm" value={v.height}
            onChange={e => set('height')(e.target.value)} error={err('height_cm')} />
        </>
      )}

      {step === 2 && (
        <>
          <h1>Ton poids</h1>
          <TextField id="weight" label="Poids actuel" inputMode="decimal" suffix="kg" value={v.weight}
            onChange={e => set('weight')(e.target.value)} error={err('weight_kg')} />
          {v.type !== 'maintain' && (
            <TextField id="target" label="Poids visé" inputMode="decimal" suffix="kg" value={v.target}
              onChange={e => set('target')(e.target.value)} error={err('target_weight_kg')} />
          )}
          {err('type') && <p className="form-error" role="alert">{err('type')}</p>}
        </>
      )}

      {step === 3 && (
        <>
          <h1>Ton activité au quotidien</h1>
          <Choices name="activity" legend="Niveau d'activité" options={ACTIVITY.map(([id, l, h]) => [id, l, h])}
            value={v.activity_level} onChange={set('activity_level')} error={err('activity_level')} />
        </>
      )}

      {step === 4 && (
        <>
          <h1>Ton plan</h1>
          <section className="card stack" aria-label="Objectif quotidien">
            <p><span className="kcal-big">{plan.kcal_per_day}</span> kcal par jour</p>
            <p className="muted">
              Glucides {grams.carbs} g · Protéines {grams.protein} g · Lipides {grams.fat} g
            </p>
            <p className="muted">Dépense estimée : {plan.tdee} kcal/jour.</p>
            {targetDate && <p>À ce rythme, {p.target_weight_kg} kg vers {targetDate}.</p>}
            {plan.floored && (
              <p className="note">Ton objectif est ramené au minimum conseillé de {plan.kcal_per_day} kcal : la perte sera plus lente, mais plus sûre.</p>
            )}
          </section>
          <p className="muted">Estimation à partir de la formule Mifflin-St Jeor : ce n'est pas un avis médical. En cas de grossesse, de maladie ou de trouble alimentaire, demande conseil à un professionnel de santé.</p>
          {error && <p className="form-error" role="alert">L'enregistrement a échoué. Vérifie ta connexion et réessaie.</p>}
          <Button size="lg" block loading={saving} onClick={finish}>{firstRun ? "C'est parti" : 'Enregistrer'}</Button>
        </>
      )}

      {step < 4 && <Button size="lg" block onClick={next}>Continuer</Button>}
    </div>
  )
}
