import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar.tsx'
import { Home } from './views/Home.tsx'
import { Library } from './views/Library.tsx'
import { Plan } from './views/Plan.tsx'
import { RoutineEdit } from './views/RoutineEdit.tsx'
import { Workout } from './views/Workout.tsx'

export default function App() {
  return (
    <HashRouter>
      <main className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/plan/r/:id" element={<RoutineEdit />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/library" element={<Library />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </HashRouter>
  )
}
