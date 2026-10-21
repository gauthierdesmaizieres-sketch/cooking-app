// /?design — every primitive in its states. The design-system check; not shipped as a screen.
import { useState } from 'react'
import { Barcode, BookOpen, Camera, ChartLine, ChevronLeft, ChevronRight, NotebookPen, SearchX, User } from 'lucide-react'
import { BottomSheet, Button, CalorieRing, Chip, EmptyState, FoodRow, IconButton, MacroBar, MealCard, SearchField, Stepper, TabBar, TextField, Toast } from './ui.jsx'

const tabs = [
  { id: 'diary', label: 'Journal', icon: NotebookPen },
  { id: 'recipes', label: 'Recettes', icon: BookOpen },
  { id: 'progress', label: 'Progrès', icon: ChartLine },
  { id: 'profile', label: 'Profil', icon: User },
]

export default function DesignPage() {
  const [q, setQ] = useState('pou')
  const [servings, setServings] = useState(2)
  const [chips, setChips] = useState({ vegan: true, lowcarb: false, quick: false })
  const [sheet, setSheet] = useState(false)
  const [tab, setTab] = useState('diary')

  return (
    <div className="design">
      <h1>Design system</h1>

      <section>
        <h2>Button</h2>
        <div className="row">
          <Button>Primaire</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Supprimer</Button>
        </div>
        <div className="row">
          <Button size="sm">Petit</Button>
          <Button size="lg">Grand</Button>
          <Button loading>Envoi</Button>
          <Button disabled>Désactivé</Button>
        </div>
        <Button size="lg" block>Ajouter au journal</Button>
      </section>

      <section>
        <h2>IconButton</h2>
        <div className="row">
          <IconButton label="Jour précédent" icon={ChevronLeft} />
          <IconButton label="Jour suivant" icon={ChevronRight} />
          <IconButton label="Scanner un code-barres" icon={Barcode} />
          <IconButton label="Photo du plat" icon={Camera} variant="filled" />
        </div>
      </section>

      <section>
        <h2>CalorieRing</h2>
        <div className="row">
          <CalorieRing eaten={760} goal={2000} />
          <CalorieRing eaten={2120} goal={2000} />
        </div>
        <div className="row">
          <CalorieRing eaten={0} goal={2000} size="sm" />
          <CalorieRing eaten={500} goal={2000} size="sm" />
          <CalorieRing eaten={2000} goal={2000} size="sm" />
          <CalorieRing eaten={2400} goal={2000} size="sm" />
        </div>
      </section>

      <section className="card stack">
        <h2>MacroBar</h2>
        <MacroBar kind="carbs" label="Glucides" value={142} goal={250} />
        <MacroBar kind="protein" label="Protéines" value={62} goal={120} />
        <MacroBar kind="fat" label="Lipides" value={74} goal={65} />
      </section>

      <section>
        <h2>MealCard + FoodRow</h2>
        <div className="stack">
          <MealCard title="Déjeuner" kcal={640}>
            <FoodRow name="Bol de riz au poulet" detail="1 portion · 420 g" kcal={590} />
            <FoodRow name="Pomme" detail="1 pièce · 150 g" kcal={78} badge="IA · à vérifier" />
          </MealCard>
          <MealCard title="Dîner" kcal={0}>
            <p className="muted">Rien pour l'instant.</p>
          </MealCard>
        </div>
      </section>

      <section className="stack">
        <h2>Champs</h2>
        <SearchField value={q} onChange={setQ} label="Rechercher un aliment" />
        <SearchField value="" onChange={() => {}} label="Rechercher une recette" loading />
        <TextField id="w" label="Poids" inputMode="decimal" defaultValue="78,5" suffix="kg" />
        <TextField id="g" label="Quantité" inputMode="decimal" defaultValue="0" suffix="g" error="La quantité doit être supérieure à 0." />
      </section>

      <section>
        <h2>Stepper + Chip</h2>
        <div className="row">
          <Stepper value={servings} onChange={setServings} label="les portions" />
        </div>
        <div className="row">
          <Chip on={chips.vegan} onClick={() => setChips(c => ({ ...c, vegan: !c.vegan }))}>Végétarien</Chip>
          <Chip on={chips.lowcarb} onClick={() => setChips(c => ({ ...c, lowcarb: !c.lowcarb }))}>Peu de glucides</Chip>
          <Chip on={chips.quick} onClick={() => setChips(c => ({ ...c, quick: !c.quick }))}>Moins de 20 min</Chip>
        </div>
      </section>

      <section className="stack">
        <h2>Toast, EmptyState, BottomSheet</h2>
        <Toast action="Annuler">Pomme ajoutée au déjeuner</Toast>
        <div className="card">
          <EmptyState icon={SearchX} title="Aucun aliment trouvé" text="Essaie un autre mot ou crée cet aliment toi-même."
            action={<Button variant="secondary" size="sm">Créer un aliment</Button>} />
        </div>
        <Button variant="secondary" onClick={() => setSheet(true)}>Ouvrir la feuille</Button>
        <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Ajouter du poids">
          <div className="stack">
            <TextField id="w2" label="Poids du jour" inputMode="decimal" suffix="kg" />
            <Button block onClick={() => setSheet(false)}>Enregistrer</Button>
          </div>
        </BottomSheet>
      </section>

      <section>
        <h2>TabBar</h2>
        <TabBar items={tabs} current={tab} onChange={setTab} />
      </section>
    </div>
  )
}
