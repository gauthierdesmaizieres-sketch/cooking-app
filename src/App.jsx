import { useEffect, useState } from 'react'
import { BookOpen, ChartLine, NotebookPen, User } from 'lucide-react'
import { TabBar, Toast } from './ui.jsx'
import Diary from './screens/Diary.jsx'
import AddFood from './screens/AddFood.jsx'
import ScanPhoto from './screens/ScanPhoto.jsx'
import ScanReview from './screens/ScanReview.jsx'
import FoodDetail from './screens/FoodDetail.jsx'
import NewFood from './screens/NewFood.jsx'
import BarcodeScan from './screens/BarcodeScan.jsx'
import Recipes from './screens/Recipes.jsx'
import RecipeDetail from './screens/RecipeDetail.jsx'
import RecipeEdit from './screens/RecipeEdit.jsx'
import Cook from './screens/Cook.jsx'
import Onboarding from './screens/Onboarding.jsx'
import { getActiveGoal } from './data.js'
import Stub from './screens/Stub.jsx'
import Login from './screens/Login.jsx'
import Profile from './screens/Profile.jsx'
import { supabase } from './supabase.js'

// Hash routes: #/diary?day=… | #/add/:meal?day=… | #/scan/:meal | #/review/:scanId | #/barcode/:meal | #/food/:id | #/new-food/:meal
// #/goals (S01–S03 again from the profile) | #/recipes | #/recipe/new | #/recipe/:id | #/recipe/:id/edit | #/cook/:id?for=n
// flow screens carry ?meal=…&day=… so the entry lands where the user started
export function go(path) { location.hash = path }
function parse() {
  const [path, qs] = location.hash.slice(1).split('?')
  return { parts: (path || '/diary').split('/').filter(Boolean), q: new URLSearchParams(qs) }
}

const TABS = [
  { id: 'diary', label: 'Journal', icon: NotebookPen },
  { id: 'recipes', label: 'Recettes', icon: BookOpen },
  { id: 'progress', label: 'Progrès', icon: ChartLine },
  { id: 'profile', label: 'Profil', icon: User },
]

export default function App() {
  const [route, setRoute] = useState(parse)
  const [toast, setToast] = useState(null) // { text, action?, onAction? }
  const [session, setSession] = useState(undefined) // undefined = still reading storage
  const [hasGoal, setHasGoal] = useState(undefined) // first run -> onboarding before anything else

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  const uid = session?.user.id
  useEffect(() => {
    setHasGoal(undefined)
    if (uid) getActiveGoal().then(g => setHasGoal(!!g)).catch(() => setHasGoal(true)) // on error, let them use the app
  }, [uid])

  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0) }
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const [screen, param] = route.parts
  const notify = (text, action, onAction) => setToast({ text, action, onAction })
  const props = { q: route.q, notify }

  let page, tab = screen
  switch (screen) {
    case 'add': page = <AddFood meal={param} {...props} />; tab = null; break
    case 'scan': page = <ScanPhoto meal={param} {...props} />; tab = null; break
    case 'review': page = <ScanReview scanId={param} {...props} />; tab = null; break
    case 'barcode': page = <BarcodeScan meal={param} {...props} />; tab = null; break
    case 'food': page = <FoodDetail foodId={param} {...props} />; tab = null; break
    case 'new-food': page = <NewFood meal={param} {...props} />; tab = null; break
    case 'recipes': page = <Recipes />; break
    case 'recipe':
      tab = null
      page = param === 'new' ? <RecipeEdit key="new" {...props} />
        : route.parts[2] === 'edit' ? <RecipeEdit key={param} recipeId={param} {...props} />
        : <RecipeDetail key={param} recipeId={param} {...props} />
      break
    case 'cook': page = <Cook recipeId={param} {...props} />; tab = null; break
    case 'goals': page = <Onboarding {...props} />; tab = null; break
    case 'progress': page = <Stub title="Progrès" ids="S18" />; break
    case 'profile': page = <Profile email={session?.user.email} />; break
    default: page = <Diary {...props} />; tab = 'diary'
  }

  if (session === undefined) return null
  if (!session) return <div className="app"><main className="app-main"><Login /></main></div>
  if (hasGoal === undefined) return null
  if (!hasGoal) {
    return <div className="app"><main className="app-main"><Onboarding firstRun onDone={() => { setHasGoal(true); go('/diary') }} /></main></div>
  }

  return (
    <div className={`app${tab ? ' has-tabs' : ''}`}>
      <main className="app-main">{page}</main>
      {toast && (
        <div className="toast-slot">
          <Toast action={toast.action} onAction={() => { toast.onAction?.(); setToast(null) }}>{toast.text}</Toast>
        </div>
      )}
      {tab && <div className="tabbar-slot"><TabBar items={TABS} current={tab} onChange={id => go(`/${id}`)} /></div>}
    </div>
  )
}
