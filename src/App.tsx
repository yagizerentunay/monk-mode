import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar.tsx'
import { Library } from './views/Library.tsx'

export default function App() {
  return (
    <HashRouter>
      <main className="app">
        <Routes>
          <Route path="/library" element={<Library />} />
          <Route path="*" element={<Navigate to="/library" replace />} />
        </Routes>
      </main>
      <TabBar />
    </HashRouter>
  )
}
