import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore.ts'
import { buildCatalog, loadExercises, loadLegacyExercises, type Exercise } from './exercises.ts'

export interface ExercisesResult {
  /** Seçilebilir egzersizler: kullanıcının özel egzersizleri + kütüphane. Arama, değiştirme ve öneriler bunu kullanır. */
  list: Exercise[]
  /** Kütüphaneden çıkarılmış eski kimlikler; yalnız içe aktarma eşleştirmesi gibi yerlerde gerekir. */
  legacy: Exercise[]
  /** Geçmişteki her kimliği çözer (list + legacy; aynı kimlikte list kazanır). */
  byId: Map<string, Exercise>
  loading: boolean
  error: string | null
}

interface Options {
  /** Geçmiş olmasa da eski kimlikleri yükle (örn. Strong/Hevy içe aktarma eşleştirmesi için). */
  legacy?: boolean
}

/**
 * Kütüphane + kullanıcının özel egzersizleri. Eski kimlikler yalnız geçmişi (rutin, antrenman) olan
 * kullanıcı için ya da `legacy: true` istenince yüklenir; yüklenene kadar `loading` true kalır.
 */
export function useExercises({ legacy: forceLegacy = false }: Options = {}): ExercisesResult {
  const customEx = useStore((s) => s.customEx)
  const muscleFix = useStore((s) => s.muscleFix)
  const hasHistory = useStore((s) => s.workouts.length > 0 || s.routines.length > 0 || s.active !== null)
  const wantLegacy = forceLegacy || hasHistory
  const [base, setBase] = useState<Exercise[]>([])
  const [old, setOld] = useState<Exercise[]>([])
  const [baseLoading, setBaseLoading] = useState(true)
  const [legacyLoading, setLegacyLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadExercises()
      .then((l) => alive && setBase(l))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setBaseLoading(false))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!wantLegacy) return
    let alive = true
    // Eski kimlikler yüklenemezse geçmiş ham kimlikle görünür ama uygulama çalışmaya devam eder.
    loadLegacyExercises()
      .then((l) => alive && setOld(l))
      .catch(() => {})
      .finally(() => alive && setLegacyLoading(false))
    return () => {
      alive = false
    }
  }, [wantLegacy])

  const { list, legacy, byId } = useMemo(() => buildCatalog(customEx, base, old, muscleFix), [customEx, base, old, muscleFix])
  return { list, legacy, byId, loading: baseLoading || (wantLegacy && legacyLoading), error }
}
