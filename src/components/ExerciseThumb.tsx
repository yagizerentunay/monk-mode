import { thumbSource, type Exercise } from '../lib/exercises.ts'

/** Egzersizin küçük resmi: kendi görseli, yoksa hedef kasın referans çizimi, o da yoksa boş kutu. */
export function ExerciseThumb({ ex }: { ex: Pick<Exercise, 'illustration' | 'primaryMuscles'> }) {
  const src = thumbSource(ex)
  if (!src) return <div className="thumb" />
  return <img className={src.fallback ? 'thumb thumb-muscle' : 'thumb'} src={src.url} alt="" loading="lazy" />
}
