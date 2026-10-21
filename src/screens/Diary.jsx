// S05 Journal du jour
import { useCallback, useEffect, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import { BottomSheet, Button, CalorieRing, FoodRow, IconButton, MacroBar, MealCard, TextField } from '../ui.jsx'
import { addDays, formatDay, localDay, macroGoals, MEALS, mealForHour, parseNumber, scaleEntry, totals } from '../lib.js'
import { deleteDiaryEntry, getGoal, listDiary, restoreDiaryEntry, updateDiaryEntry } from '../data.js'
import { go } from '../App.jsx'

export default function Diary({ q, notify }) {
  const today = localDay()
  const day = q.get('day') || today
  const [entries, setEntries] = useState(null) // null = loading
  const [goal, setGoal] = useState(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(null) // entry shown in the sheet

  const reload = useCallback(() => {
    setError(false)
    Promise.all([listDiary(day), getGoal()])
      .then(([e, g]) => { setEntries(e); setGoal(g) })
      .catch(() => setError(true))
  }, [day])
  useEffect(() => { setEntries(null); reload() }, [reload])

  const setDay = d => go(d === today ? '/diary' : `/diary?day=${d}`)
  const quickMeal = mealForHour(new Date().getHours())

  async function remove(entry) {
    setOpen(null)
    await deleteDiaryEntry(entry.id)
    reload()
    notify(`${entry.label} supprimé`, 'Annuler', async () => { await restoreDiaryEntry(entry); reload() })
  }

  if (error) {
    return (
      <div className="page">
        <p role="alert">Impossible de charger le journal.</p>
        <Button variant="secondary" onClick={reload}>Réessayer</Button>
      </div>
    )
  }

  const t = totals(entries ?? [])
  const mg = goal ? macroGoals(goal) : { carbs: 0, protein: 0, fat: 0 }

  return (
    <div className="page diary">
      <header className="diary-head">
        <IconButton label="Jour précédent" icon={ChevronLeft} onClick={() => setDay(addDays(day, -1))} />
        <h1 className="diary-day" aria-live="polite">{formatDay(day, today)}</h1>
        <IconButton label="Jour suivant" icon={ChevronRight} disabled={day >= today} onClick={() => setDay(addDays(day, 1))} />
      </header>

      <section className="card diary-summary" aria-label="Résumé du jour" aria-busy={!entries}>
        {goal && entries ? <CalorieRing eaten={t.kcal} goal={goal.kcal_per_day} /> : <div className="skeleton ring-skel" />}
        <p className="muted">{t.kcal} mangées · objectif {goal?.kcal_per_day ?? '…'} kcal</p>
        <div className="diary-macros">
          <MacroBar kind="carbs" label="Glucides" value={t.carbs} goal={mg.carbs} />
          <MacroBar kind="protein" label="Protéines" value={t.protein} goal={mg.protein} />
          <MacroBar kind="fat" label="Lipides" value={t.fat} goal={mg.fat} />
        </div>
      </section>

      <Button size="lg" block onClick={() => go(`/scan/${quickMeal}?day=${day}`)}>
        <Camera size={20} aria-hidden="true" /> Photographier mon assiette
      </Button>

      {MEALS.map(m => {
        const list = (entries ?? []).filter(e => e.meal === m.id)
        return (
          <MealCard key={m.id} title={m.label} kcal={totals(list).kcal} onAdd={() => go(`/add/${m.id}?day=${day}`)}>
            {!entries ? <div className="skeleton row-skel" />
              : list.length === 0 ? <p className="muted">Rien de noté.</p>
              : list.map(e => (
                <FoodRow key={e.id} name={e.label} kcal={e.kcal} onClick={() => setOpen(e)}
                  detail={`${e.grams ? `${e.grams} g` : `${e.servings} portion${e.servings > 1 ? 's' : ''}`}${e.method === 'photo' ? ' · photo' : ''}`} />
              ))}
          </MealCard>
        )
      })}

      <BottomSheet open={!!open} onClose={() => setOpen(null)} title={open?.label ?? ''}>
        {open && (
          <div className="stack">
            <EntryEditor key={open.id} entry={open} onSaved={() => { setOpen(null); reload(); notify('Entrée modifiée') }} />
            <Button variant="ghost" block onClick={() => remove(open)}>Supprimer du journal</Button>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}

// Change the amount (grams or portions) and the meal of a logged entry.
function EntryEditor({ entry, onSaved }) {
  const byGrams = entry.grams != null
  const [amount, setAmount] = useState(String(byGrams ? entry.grams : entry.servings))
  const [meal, setMeal] = useState(entry.meal)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const n = parseNumber(amount, byGrams ? 1 : 0.1, byGrams ? 5000 : 20)
  const now = n ? scaleEntry(entry, n) : null

  async function save() {
    setSaving(true)
    setError(false)
    try {
      await updateDiaryEntry(entry.id, { ...(byGrams ? { grams: n } : { servings: n }), ...now, meal })
      onSaved()
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  return (
    <>
      <TextField id="entry-amount" label={byGrams ? 'Quantité' : 'Portions'} inputMode="decimal" suffix={byGrams ? 'g' : undefined}
        value={amount} onChange={e => setAmount(e.target.value)} error={n ? undefined : 'Quantité invalide'} />
      <div className="field">
        <label htmlFor="entry-meal">Repas</label>
        <select id="entry-meal" className="select" value={meal} onChange={e => setMeal(e.target.value)}>
          {MEALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      <p aria-live="polite"><strong>{now?.kcal ?? '–'} kcal</strong>
        {now && <span className="muted"> · G {now.carbs} g · P {now.protein} g · L {now.fat} g</span>}</p>
      {error && <p className="form-error" role="alert">La modification a échoué. Vérifie ta connexion et réessaie.</p>}
      <Button block loading={saving} disabled={!n} onClick={save}>Enregistrer</Button>
    </>
  )
}
