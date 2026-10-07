import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar.tsx'
import { Library } from './views/Library.tsx'
import { Plan } from './views/Plan.tsx'
import { RoutineEdit } from './views/RoutineEdit.tsx'

export default function App() {
  return (
    <HashRouter>
      <main className="app">
        <Routes>
          <Route path="/plan" element={<Plan />} />
          <Route path="/plan/r/:id" element={<RoutineEdit />} />
          <Route path="/library" element={<Library />} />
          <Route path="*" element={<Navigate to="/plan" replace />} />
        </Routes>
      </main>
      <TabBar />
    </HashRouter>
  )
}
