import { describe, expect, it } from 'vitest'
import raw from '../../public/data/exercises.json?raw'
import { EQUIPMENT_LABEL, equipmentLabel, muscleLabel } from './labels.ts'
import { MUSCLES } from './muscles.ts'

interface Row {
  primaryMuscles: string[]
  secondaryMuscles: string[]
  equipment: string | null
}
const data = JSON.parse(raw) as Row[]

describe('etiketler', () => {
  it('verideki her kas ve ekipman adının Türkçe karşılığı vardır', () => {
    const muscles = new Set(data.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles]))
    for (const m of muscles) expect(muscleLabel(m), m).not.toBe(m)
    const equipment = new Set(data.map((e) => e.equipment).filter((e): e is string => !!e))
    for (const q of equipment) expect(EQUIPMENT_LABEL[q], q).toBeDefined()
  })

  it('tanımlı tüm kas kimlikleri çevrilir', () => {
    for (const m of MUSCLES) expect(muscleLabel(m)).not.toBe(m)
  })

  it('tanınmayan değerleri olduğu gibi bırakır', () => {
    expect(muscleLabel('göğüs')).toBe('göğüs')
    expect(equipmentLabel('sled')).toBe('sled')
  })

  it('ekipman yoksa Ekipmansız der', () => {
    expect(equipmentLabel(null)).toBe('Ekipmansız')
    expect(equipmentLabel('')).toBe('Ekipmansız')
    expect(equipmentLabel('body only')).toBe('Vücut ağırlığı')
  })
})
