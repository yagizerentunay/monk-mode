import type { ExCfg, Routine } from '../store/schema.ts'
import { isBodyOnly, isUnilateralName, type Exercise } from './exercises.ts'

/**
 * Rutine yeni eklenen egzersizin varsayılan planı: çift ilerleme, ısınma/drop/süperset yok; tek taraflılık
 * ve vücut ağırlığı egzersiz adı/ekipmanından önerilir. Rutin düzenleyici ve "Rutine ekle" önerisi aynı
 * varsayılanı kullanır; değişirse ikisi birlikte değişir.
 */
export function defaultExCfg(ex: Pick<Exercise, 'id' | 'name' | 'equipment'>): ExCfg {
  return {
    exId: ex.id,
    sets: 3,
    reps: 8,
    weight: 0,
    prog: 'double',
    inc: 2.5,
    repsMax: 12,
    side: isUnilateralName(ex.name),
    ...(isBodyOnly(ex) ? { bw: true } : {}),
  }
}

/** Egzersiz bu rutinde zaten var mı? */
export function routineHas(routine: Pick<Routine, 'ex'>, exId: string): boolean {
  return routine.ex.some((c) => c.exId === exId)
}

/**
 * Egzersizi rutinin sonuna ekler ve yeni rutini döndürür (girdi değişmez). Egzersiz zaten rutindeyse
 * null döner: tekrar eklemek ikinci bir satır açardı.
 */
export function addToRoutine(
  routine: Routine,
  ex: Pick<Exercise, 'id' | 'name' | 'equipment'>,
): Routine | null {
  if (routineHas(routine, ex.id)) return null
  return { ...routine, ex: [...routine.ex, defaultExCfg(ex)] }
}

/** Kimliğiyle bulunan rutine ekler; rutin yoksa ya da egzersiz zaten ekliyse null (kaydedilecek bir şey yok). */
export function addToRoutineById(
  routines: Routine[],
  routineId: string,
  ex: Pick<Exercise, 'id' | 'name' | 'equipment'>,
): Routine | null {
  const routine = routines.find((r) => r.id === routineId)
  return routine ? addToRoutine(routine, ex) : null
}
