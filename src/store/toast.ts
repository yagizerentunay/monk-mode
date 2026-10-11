import { create } from 'zustand'

/** Geri al düğmeli kısa bildirimin ne kadar süre görüneceği (ms). */
export const TOAST_MS = 6000

export interface ToastItem {
  /** Her yeni bildirimde artar; bileşen sayacı bu kimliğe bağlar. */
  id: number
  text: string
  /** Verilirse "Geri al" düğmesi gösterilir. */
  undo?: () => void
}

interface ToastStore {
  toast: ToastItem | null
  show(text: string, undo?: () => void): void
  dismiss(): void
}

let seq = 0

/** Tek seferde tek bildirim: yenisi eskinin yerini alır. Kalıcı değildir (yalnız bellekte). */
export const useToast = create<ToastStore>((set) => ({
  toast: null,
  show: (text, undo) => set({ toast: { id: ++seq, text, undo } }),
  dismiss: () => set({ toast: null }),
}))
