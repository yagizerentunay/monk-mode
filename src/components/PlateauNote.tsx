import { useMemo } from 'react'
import { detectPlateau } from '../lib/plateau.ts'
import { useStore } from '../store/useStore.ts'

/** Egzersizde ilerleme durduysa kısa bir uyarı ve öneri; aksi hâlde hiçbir şey çizmez. */
export function PlateauNote({ exId }: { exId: string }) {
  const workouts = useStore((s) => s.workouts)
  const plateau = useMemo(() => detectPlateau(workouts, exId), [workouts, exId])
  if (!plateau) return null
  return (
    <div className="warntext" role="note">
      Plato: {plateau.sessions} seanstır yeni rekor yok. Ağırlığı ~%10 düşürüp toparlan ya da tekrar aralığını değiştir.
    </div>
  )
}
