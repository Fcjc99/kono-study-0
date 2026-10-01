import {useState} from 'react'

/** Settings › Import & export: add homework without opening KONO first. An iPhone Shortcut (which Siri
 * can run) opens KONO's quick add with what was said; on Android, KONO is in the share sheet. */
export default function AddFromSiri(){
 const link=location.origin+'/?add='
 const [copied,setCopied]=useState(false)
 const copy=()=>void navigator.clipboard?.writeText(link).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500)},()=>undefined)
 return <section className="wb-panel add-from-siri" aria-label="Add homework with Siri">
  <h2>Add homework with Siri</h2>
  <p>Say “Hey Siri, add homework”, then something like “bio worksheet due Friday”. KONO opens with it ready to add.</p>
  <details><summary>Set it up on iPhone (2 minutes)</summary><ol>
   <li>Open the <strong>Shortcuts</strong> app and tap <strong>＋</strong>.</li>
   <li>Add <strong>Ask for Input</strong>, with the question “What homework?”.</li>
   <li>Add <strong>URL Encode</strong> (it uses the answer).</li>
   <li>Add <strong>Open URLs</strong>, and for the URL type the link below, then tap the variable button and pick <strong>URL Encoded Text</strong> right after it.</li>
   <li>Name the shortcut <strong>Add homework</strong>. Now “Hey Siri, add homework” works, and so does the shortcut on your Home Screen.</li>
  </ol>
  <p className="add-from-siri-link"><code>{link}</code><button type="button" onClick={copy}>{copied?'Copied ✓':'Copy link'}</button></p>
  <p className="wb-muted">The shortcut opens KONO in Safari, so sign in there with the same email to see it in your plan everywhere.</p></details>
  <p className="wb-muted">On Android, after adding KONO to your Home Screen, use <strong>Share › KONO</strong> from Google Classroom, Chrome or any app to add what you’re looking at, link included.</p>
 </section>
}
