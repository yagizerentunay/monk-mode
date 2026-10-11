import { useEffect, useState } from 'react'
import { TOAST_MS, useToast, type ToastItem } from '../store/toast.ts'

/**
 * Silme sonrası görünen kısa "Geri al" bildirimi (bkz. store/undoDelete.ts). Uygulama kabuğunda durur:
 * silme başka ekrana geçirse de bildirim yeni ekranda kalır.
 */
export function Toast() {
  const toast = useToast((s) => s.toast)
  // key: her bildirim kendi duraklatma durumuyla başlar.
  return toast ? <ToastView key={toast.id} toast={toast} /> : null
}

/** Fare üzerindeyken ya da odak içindeyken süre durur (klavyeyle düğmeye gelen kişi aceleye gelmesin); Escape kapatır. */
function ToastView({ toast }: { toast: ToastItem }) {
  const dismiss = useToast((s) => s.dismiss)
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (held) return
    const t = setTimeout(dismiss, TOAST_MS)
    return () => clearTimeout(t)
  }, [held, dismiss])

  return (
    <div
      className="toast"
      role="status"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHeld(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') dismiss()
      }}
    >
      <span className="toast-text">{toast.text}</span>
      {toast.undo && (
        <button
          className="toast-undo"
          onClick={() => {
            toast.undo?.()
            dismiss()
          }}
        >
          Geri al
        </button>
      )}
    </div>
  )
}
