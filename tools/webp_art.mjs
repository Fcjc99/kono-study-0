// After the build: the island art (dist/client/garden/**/*.png) re-saved as lossless WebP under the same
// names, about a quarter of the download with every visible pixel the same (each one is checked here, and the
// build fails if any differs). vercel.json serves those files as image/webp, so the game, the CSS and the
// offline copy keep asking for the same .png paths. public/ keeps the original PNGs for the art tools.
// Usage: node tools/webp_art.mjs [dist/client]
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'

const root = path.resolve(process.argv[2] ?? 'dist/client', 'garden')
const files = []
const walk = dir => { for (const e of fs.readdirSync(dir, {withFileTypes: true})) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.png')) files.push(p) } }
if (!fs.existsSync(root)) { console.error('No ' + root + ': build first.'); process.exit(1) }
walk(root)
sharp.concurrency(1)
let before = 0, after = 0, done = 0
const one = async file => {
  const png = fs.readFileSync(file)
  if (png.subarray(0, 4).toString('latin1') === 'RIFF') return // already WebP (a second run)
  const webp = await sharp(png).webp({lossless: true, effort: 4}).toBuffer()
  // Every pixel, alpha included, must come back exactly as it was.
  const [a, b] = await Promise.all([sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject: true}), sharp(webp).ensureAlpha().raw().toBuffer({resolveWithObject: true})])
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) throw new Error('Size changed after WebP: ' + file)
  // Visible pixels must match exactly; a fully transparent one only has to stay fully transparent (its hidden
  // colour is never drawn, and the encoder may store any).
  for (let i = 0; i < a.data.length; i += 4) {
   if (a.data[i + 3] === 0 ? b.data[i + 3] !== 0 : a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) throw new Error('Pixels differ after WebP: ' + file)
  }
  fs.writeFileSync(file, webp)
  before += png.length; after += webp.length; done++
}
const queue = [...files], workers = Array.from({length: Math.max(1, Math.min(8, os.cpus().length))}, async () => { while (queue.length) await one(queue.shift()) })
await Promise.all(workers)
console.log(`Island art: ${done} PNGs re-saved as lossless WebP, ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB, every visible pixel checked.`)
