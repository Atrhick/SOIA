'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

/**
 * One feedback pattern for the whole app: a short message at the bottom of the screen, read out by
 * screen readers, with an optional action (usually Undo). Success fades after 5s (8s with an action);
 * errors stay until closed.
 *
 *   const toast = useToast()
 *   toast.success('Copied. Paste it into WhatsApp.')
 *   toast.success('Removed Maria from follow-ups', { action: { label: 'Undo', onClick: undo } })
 *   toast.error("That didn't send. Check your connection and try again.")
 */
type Kind = 'success' | 'error'
interface Item { id: number; kind: Kind; text: string; action?: { label: string; onClick: () => void } }
export interface ToastApi {
  success: (text: string, opts?: { action?: Item['action'] }) => void
  error: (text: string, opts?: { action?: Item['action'] }) => void
}

const Ctx = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const seq = useRef(0)
  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])
  const push = useCallback((kind: Kind, text: string, action?: Item['action']) => {
    const id = ++seq.current
    setItems((xs) => [...xs.slice(-2), { id, kind, text, action }])
    if (kind === 'success') setTimeout(() => remove(id), action ? 8000 : 5000)
  }, [remove])
  const pushRef = useRef(push)
  pushRef.current = push
  const api = useRef<ToastApi>({
    success: (t, o) => pushRef.current('success', t, o?.action),
    error: (t, o) => pushRef.current('error', t, o?.action),
  })

  return (
    <Ctx.Provider value={api.current}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div role="status" aria-live="polite" className="sr-only">{items.filter((i) => i.kind === 'success').map((i) => i.text).join('. ')}</div>
        <div role="alert" aria-live="assertive" className="sr-only">{items.filter((i) => i.kind === 'error').map((i) => i.text).join('. ')}</div>
        {items.map((i) => <ToastRow key={i.id} item={i} onClose={() => remove(i.id)} />)}
      </div>
    </Ctx.Provider>
  )
}

function ToastRow({ item, onClose }: { item: Item; onClose: () => void }) {
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t) }, [])
  const ok = item.kind === 'success'
  return (
    <div className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl px-4 py-3 text-base shadow-lg transition-all duration-200 ${shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'} ${ok ? 'bg-gray-900 text-white' : 'bg-red-700 text-white'}`}>
      {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-green-400" aria-hidden /> : <AlertCircle className="mt-0.5 h-5 w-5 flex-none" aria-hidden />}
      <p aria-hidden="true" className="min-w-0 flex-1 leading-snug">{item.text}</p>
      {item.action && (
        <button type="button" onClick={() => { item.action!.onClick(); onClose() }} className="flex-none min-h-[44px] rounded-md px-2 font-semibold underline underline-offset-2 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
          {item.action.label}
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Close message" className="-mr-1 flex-none min-h-[44px] rounded-md px-1 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"><X className="h-5 w-5" aria-hidden /></button>
    </div>
  )
}

/** Toasts anywhere under the app's Providers. Outside a provider it does nothing. */
export function useToast(): ToastApi {
  return useContext(Ctx) ?? { success: () => {}, error: () => {} }
}
