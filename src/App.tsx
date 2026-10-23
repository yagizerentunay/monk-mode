import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RouteErrorBoundary } from './components/ErrorBoundary.tsx'
import { StorageWarnings } from './components/StorageWarnings.tsx'
import { TabBar } from './components/TabBar.tsx'
import { Toast } from './components/Toast.tsx'
import { UpdateBanner } from './components/UpdateBanner.tsx'
import { useOnline } from './lib/useOnline.ts'
import { autoFolderBackup } from './store/folderBackup.ts'
import { Home } from './views/Home.tsx'
import { Workout } from './views/Workout.tsx'

// Ana sayfa ve antrenman ilk pakette kalır (açılış ve salonda en kritik ekranlar); diğerleri ayrı
// parçalara bölünür. Parçalar index.html'de prefetch edilir, service worker onları da önbelleğe alır
// (bkz. vite.config.ts prefetchChunks).
const Plan = lazy(() => import('./views/Plan.tsx').then((m) => ({ default: m.Plan })))
const RoutineEdit = lazy(() => import('./views/RoutineEdit.tsx').then((m) => ({ default: m.RoutineEdit })))
const Stats = lazy(() => import('./views/Stats.tsx').then((m) => ({ default: m.Stats })))
const Library = lazy(() => import('./views/Library.tsx').then((m) => ({ default: m.Library })))
const Settings = lazy(() => import('./views/Settings.tsx').then((m) => ({ default: m.Settings })))
const ShareImport = lazy(() => import('./views/ShareImport.tsx').then((m) => ({ default: m.ShareImport })))

export default function App() {
  const online = useOnline()
  // Klasöre otomatik yedek (Ayarlar'da açıksa): açılışta ve sekme arka plana geçerken, veri değiştiyse.
  useEffect(() => {
    autoFolderBackup()
    const onHide = () => {
      if (document.visibilityState === 'hidden') autoFolderBackup()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])
  return (
    <HashRouter>
      {!online && (
        <div className="offline" role="status">
          Çevrimdışı · veriler cihazında güvende, görseller yalnız daha önce gezdiklerin
        </div>
      )}
      <main className="app">
        <UpdateBanner />
        <StorageWarnings />
        <Toast />
        <RouteErrorBoundary>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/plan/r/:id" element={<RoutineEdit />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/library" element={<Library />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/share/:payload" element={<ShareImport />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </main>
      <TabBar />
    </HashRouter>
  )
}
