import { t } from '../i18n/index.ts'
import type { Exercise } from '../lib/exercises.ts'
import { buildTemplateRoutines, type BuiltTemplate, type StarterTemplate } from '../lib/starterTemplates.ts'
import { useToast } from './toast.ts'
import { useStore } from './useStore.ts'

/**
 * Şablonun rutinlerini mevcut rutinlerin sonuna ekler ve "Geri al" bildirimi gösterir. Mevcut rutinlere,
 * hafta planına ve antrenmanlara dokunmaz (eklemek yıkıcı değildir, bu yüzden ayrıca kopya alınmaz); geri al
 * yalnız eklenen rutinleri siler. Hiç egzersiz üretilemediyse (katalog yüklenmedi) hiçbir şey eklemez.
 */
export function addTemplateRoutines(template: StarterTemplate, byId: ReadonlyMap<string, Exercise>): BuiltTemplate | null {
  const built = buildTemplateRoutines(template, byId, useStore.getState().routines)
  const usable = built.routines.filter((r) => r.ex.length > 0)
  if (usable.length === 0) return null
  for (const routine of usable) useStore.getState().saveRoutine(routine)
  useToast.getState().show(
    t('tpl.added', { template: template.name, routines: usable.map((r) => r.name).join(', ') }),
    () => {
      for (const routine of usable) useStore.getState().deleteRoutine(routine.id)
    },
  )
  return { routines: usable, missing: built.missing }
}
