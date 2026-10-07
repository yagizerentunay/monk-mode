import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore.ts'
import { fromCustom, loadExercises, type Exercise } from './exercises.ts'

export interface ExercisesResult {
  list: Exercise[]
  byId: Map<string, Exercise>
  loading: boolean
  error: string | null
}

/** Kütüphane + kullanıcının özel egzersizleri. */
export function useExercises(): ExercisesResult {
  const customEx = useStore((s) => s.customEx)
  const [base, setBase] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadExercises()
      .then((l) => alive && setBase(l))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const list = useMemo(() => [...customEx.map(fromCustom), ...base], [customEx, base])
  const byId = useMemo(() => new Map(list.map((e) => [e.id, e])), [list])
  return { list, byId, loading, error }
}
