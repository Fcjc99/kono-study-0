import { useEffect, useRef, useState } from 'react'

export const TERMS_UPDATED = 'September 26, 2026'

/** Plain-language Terms of Use and Privacy notice, matching what KONO actually does. */
function LegalText() {
  return <div className="legal-text">
    <p className="wb-muted">Last updated {TERMS_UPDATED}. KONO is in early testing, so these may change; we'll show the new version here.</p>

    <h3>Terms of use</h3>
    <h4>Who can use KONO</h4>
    <p>You need to be <strong>13 or older</strong> to create your own KONO account. Anyone younger can use KONO only with a parent or guardian: either on the parent's or guardian's own account (Parent mode and Kids are made for this), or with the parent or guardian setting the account up and agreeing to these terms for them.</p>
    <h4>Your account</h4>
    <p>One account per person. Sign-in works by an emailed link, so keep your email secure and don't share sign-in links. Sign out on shared devices.</p>
    <h4>Your content</h4>
    <p>Your plans, notes and schedules are yours. You let KONO store and process them only to run the app for you. Don't add anything you don't have the right to share, or anything harmful or illegal.</p>
    <h4>Early testing</h4>
    <p>KONO is provided as it is, while it's being tested. Features can change or break, and we can't promise it will always be available or error-free. Keep your own copy of anything important (Settings › Import &amp; export › Export backup). KONO isn't responsible for missed deadlines, grades or other losses from using it.</p>
    <h4>Ending</h4>
    <p>You can delete your cloud study data at any time in Settings. We may suspend accounts that misuse KONO or other people.</p>

    <h3>Privacy</h3>
    <h4>What KONO stores</h4>
    <ul>
      <li>Your email address, to sign you in.</li>
      <li>What you put in your plan: subjects, assignments, notes, exams, schedules, and names/emoji you give to kids in Parent mode.</li>
      <li>Your settings and Sanctuary progress.</li>
      <li>If something goes wrong in the app while you're signed in: the error message, which page you were on, your app version and browser type. Never your notes or plans. Kept for 30 days.</li>
      <li>If you turn on lock-screen reminders: your device's push address, and the next week's reminder titles (like “Due today: Essay”) so KONO's server can send them at the right time. Each reminder is removed once sent; turning reminders off removes the device.</li>
      <li>Feedback you choose to send, with the page you sent it from, your app version and browser type. KONO support reads it and removes it when it's handled.</li>
    </ul>
    <h4>What KONO doesn't do</h4>
    <p>No ads, no selling or renting your information, and no tracking across sites. KONO counts page visits with Vercel Web Analytics, which uses no cookies and doesn't identify you.</p>
    <h4>Where it's kept</h4>
    <p>Signed-in plans are stored in KONO's database (Supabase) and in your browser. The site is hosted on Vercel and uses Google Fonts. If you turn on live weather, the location you enter is sent to Open-Meteo. When you use an AI feature (reading a photo or schedule, K-Quiz questions, asking your notes), the text or photo you choose is sent through KONO's server to OpenAI to get the answer; OpenAI doesn't use it to train its models, and KONO doesn't keep it. Signed-in accounts get a daily number of AI requests. A calendar link you import from (Canvas, Google, iCloud) is fetched through KONO's server and not stored there; if you keep it up to date, the link stays in your browser. If you add your own AI key instead, it stays in your browser and what you ask about goes straight to that AI provider under its terms.</p>
    <h4>Who can see it</h4>
    <p>You. KONO support can open a plan to help fix a problem; every time that happens it's logged and you can see it under Settings › Import &amp; export › Backups › Support activity. Friends you accept see only the school-related snapshot described in Friends. If you make a calendar link for Google or Apple Calendar, anyone with that link can see that plan's assignment, exam and event titles and dates (not notes) until you turn the link off.</p>
    <h4>Backups</h4>
    <p>Signed-in plans are backed up automatically: a copy each time you open KONO (30 kept), one nightly copy (replaced every evening), and the last 20 saved versions.</p>
    <h4>Deleting your data</h4>
    <p>Settings › Plans &amp; account › Delete cloud study data removes your plans and their backups. To remove your sign-in account completely, or if a parent or guardian wants to review or delete a child's information, reply to any email from KONO and we'll take care of it. If we learn that someone under 13 has an account without a parent's or guardian's agreement, we'll delete it.</p>
    <h4>Questions</h4>
    <p>Reply to any email from KONO.</p>
  </div>
}

/** A button that opens the Terms &amp; Privacy in a dialog. */
export function LegalLink({ label = 'Terms & Privacy' }: { label?: string }) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open) dialog.current?.showModal() }, [open])
  return <>
    <button type="button" className="legal-link" onClick={() => setOpen(true)}>{label}</button>
    {open && <dialog ref={dialog} className="wb-dialog legal-dialog" aria-label="Terms and Privacy" onCancel={e => { e.preventDefault(); setOpen(false) }} onClose={() => setOpen(false)}>
      <header><h2>Terms &amp; Privacy</h2><button type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button></header>
      <LegalText />
      <div className="account-actions"><button type="button" className="primary" onClick={() => setOpen(false)}>Close</button></div>
    </dialog>}
  </>
}


/** The sign-up agreement: age (or a parent/guardian) plus Terms &amp; Privacy. */
export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  // The link (and its dialog) sit outside the <label> so clicking inside them never toggles the box.
  return <div className="terms-check"><label><input type="checkbox" required checked={checked} onChange={e => onChange(e.target.checked)} /><span>I'm 13 or older, or a parent/guardian is setting this up with me, and I agree to KONO's Terms &amp; Privacy.</span></label> <LegalLink label="Read them" /></div>
}
