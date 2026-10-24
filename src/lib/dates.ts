import { labels, type MessageKey } from '../i18n/index.ts'

const seven = (prefix: string) =>
  labels(Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, `${prefix}.${i}` as MessageKey]))) as Readonly<
    Record<number, string>
  >

/** Date.getDay() ile aynı sıra: 0 = Pazar. Değerler geçerli arayüz dilindedir. */
export const DAY_NAMES = seven('day')
export const DAY_SHORT = seven('dayShort')
