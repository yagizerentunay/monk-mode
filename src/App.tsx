import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar.tsx'
import { useOnline } from './lib/useOnline.ts'
import { Home } from './views/Home.tsx'
import { Library } from './views/Library.tsx'
import { Plan } from './views/Plan.tsx'
import { RoutineEdit } from './views/RoutineEdit.tsx'
import { Settings } from './views/Settings.tsx'
import { Stats } from './views/Stats.tsx'
import { Workout } from './views/Workout.tsx'

export default function App() {
  const online = useOnline()
  return (
    <HashRouter>
      {!online && (
        <div className="offline" role="status">
          Çevrimdışı · veriler cihazında güvende, görseller yalnız daha önce gezdiklerin
        </div>
      )}
      <main className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/plan/r/:id" element={<RoutineEdit />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </HashRouter>
  )
}
