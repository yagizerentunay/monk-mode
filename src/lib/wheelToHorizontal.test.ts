import { describe, expect, it } from 'vitest'
import { wheelToHorizontal } from './wheelToHorizontal.ts'

const row = { scrollLeft: 0, scrollWidth: 900, clientWidth: 400 }

describe('wheelToHorizontal', () => {
  it('dikey tekerleği yatay kaydırma miktarına çevirir', () => {
    expect(wheelToHorizontal(row, 0, 100)).toBe(100)
    expect(wheelToHorizontal({ ...row, scrollLeft: 200 }, 0, -80)).toBe(-80)
  })

  it('satır taşmıyorsa sayfaya bırakır', () => {
    expect(wheelToHorizontal({ scrollLeft: 0, scrollWidth: 400, clientWidth: 400 }, 0, 100)).toBeNull()
    expect(wheelToHorizontal({ scrollLeft: 0, scrollWidth: 401, clientWidth: 400 }, 0, 100)).toBeNull()
  })

  it('uçlarda tekerleği tutmaz', () => {
    expect(wheelToHorizontal(row, 0, -100)).toBeNull()
    expect(wheelToHorizontal({ ...row, scrollLeft: 500 }, 0, 100)).toBeNull()
    expect(wheelToHorizontal({ ...row, scrollLeft: 499.4 }, 0, 100)).toBeNull()
    // Sonda geri yön hâlâ kayar.
    expect(wheelToHorizontal({ ...row, scrollLeft: 500 }, 0, -100)).toBe(-100)
  })

  it('anlamlı yatay bileşen ya da dikey hareket yoksa dokunmaz', () => {
    expect(wheelToHorizontal(row, 40, 10)).toBeNull()
    expect(wheelToHorizontal(row, 120, 0)).toBeNull()
    expect(wheelToHorizontal(row, 0, 0)).toBeNull()
    expect(wheelToHorizontal(row, 0.5, 100)).toBe(100)
  })

  it('satır ve sayfa modlarını piksele çevirir', () => {
    expect(wheelToHorizontal(row, 0, 3, 1)).toBe(48)
    expect(wheelToHorizontal(row, 0, 1, 2)).toBe(400)
  })
})
