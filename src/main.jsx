import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import DesignPage from './DesignPage.jsx'
import '../replica/design/tokens.css'
import './ui.css'

const Root = location.search.includes('design') ? DesignPage : App
createRoot(document.getElementById('root')).render(<Root />)
