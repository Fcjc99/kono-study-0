import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** A full-screen overlay that behaves like a modal dialog: focus moves into it, Tab stays inside,
 * Escape closes it, and focus goes back to whatever opened it. */
export default function ModalOverlay({ label, onClose, className, children }: { label: string; onClose: () => void; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const root = ref.current
    root?.focus()
    const items = () => [...(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(el => el.getClientRects().length > 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return }
      if (e.key !== 'Tab') return
      const list = items(), active = document.activeElement
      if (!list.length) { e.preventDefault(); return }
      const outside = !root?.contains(active) || active === root
      if (e.shiftKey && (outside || active === list[0])) { e.preventDefault(); list[list.length - 1].focus() }
      else if (!e.shiftKey && (outside || active === list[list.length - 1])) { e.preventDefault(); list[0].focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); opener?.focus() }
  }, [])
  return <div ref={ref} className={className} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>{children}</div>
}
