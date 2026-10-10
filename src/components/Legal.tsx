import { Suspense, lazy, useEffect, useRef, useState } from 'react'

export const TERMS_UPDATED = 'September 26, 2026'

// The text itself loads when the dialog first opens (it's long, and most visits never open it).
const LegalText = lazy(() => import('./LegalText'))

/** A button that opens the Terms &amp; Privacy in a dialog. */
export function LegalLink({ label = 'Terms & Privacy' }: { label?: string }) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open) dialog.current?.showModal() }, [open])
  return <>
    <button type="button" className="legal-link" onClick={() => setOpen(true)}>{label}</button>
    {open && <dialog ref={dialog} className="wb-dialog legal-dialog" aria-label="Terms and Privacy" onCancel={e => { e.preventDefault(); setOpen(false) }} onClose={() => setOpen(false)}>
      <header><h2>Terms &amp; Privacy</h2><button type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button></header>
      <Suspense fallback={<p className="wb-muted">Loading…</p>}><LegalText /></Suspense>
      <div className="account-actions"><button type="button" className="primary" onClick={() => setOpen(false)}>Close</button></div>
    </dialog>}
  </>
}


/** The sign-up agreement: age (or a parent/guardian) plus Terms &amp; Privacy. */
export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  // The link (and its dialog) sit outside the <label> so clicking inside them never toggles the box.
  return <div className="terms-check"><label><input type="checkbox" required checked={checked} onChange={e => onChange(e.target.checked)} /><span>I'm 13 or older, or a parent/guardian is setting this up with me, and I agree to KONO's Terms &amp; Privacy.</span></label> <LegalLink label="Read them" /></div>
}
