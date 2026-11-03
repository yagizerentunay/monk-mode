import { importBackupWithReport } from '../store/backup.ts'
import { describeDropped, type SanitizeReport } from '../store/sanitize.ts'
import type { State } from '../store/schema.ts'
import { describeMerge, mergeState, totalAdded, type MergeReport } from './mergeBackup.ts'

export type TransferPlatform = 'ios' | 'android' | 'other'

/** Aktarım talimatının hangi paylaşım yolunu önereceğini seçer (iPhone: AirDrop, Android: Quick Share). */
export function transferPlatform(userAgent: string): TransferPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return 'other'
}

export interface TransferPreview {
  incoming: State
  /** Dosyadan okunurken atılan/onarılan bozuk kayıtlar. */
  sanitized: SanitizeReport
  report: MergeReport
  /** Birleştirmenin ne yapacağını anlatan kısa satır; hiçbir şey uygulanmadan hesaplanır. */
  summary: string
  /** Bozuk kayıt notu ("2 bozuk kayıt atlandı") ya da boş metin. */
  dropped: string
  /** Eklenecek kayıt var mı; yoksa birleştirme veriyi değiştirmez. */
  hasNew: boolean
}

/**
 * Gelen yedek dosyasının metnini doğrular ve yerel veriyle birleştirmenin sonucunu önceden hesaplar.
 * Hiçbir şeyi yazmaz; geçersiz dosyada anlaşılır bir hata fırlatır. Birleştirme kuralları gerçek
 * birleştirmeyle aynıdır (lib/mergeBackup.ts): silme yok, çakışmada yerel kalır.
 */
export function previewTransfer(text: string, local: State): TransferPreview {
  const { state: incoming, report: sanitized } = importBackupWithReport(text)
  const { report } = mergeState(local, incoming)
  return {
    incoming,
    sanitized,
    report,
    summary: describeMerge(report),
    dropped: describeDropped(sanitized),
    hasNew: totalAdded(report) > 0,
  }
}
