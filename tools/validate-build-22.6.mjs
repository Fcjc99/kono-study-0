import fs from 'fs'
import path from 'path'

const root = process.argv[2] || process.cwd()
const timeEngine = fs.readFileSync(path.join(root, 'src/game/sanctuary/timeEngine.ts'), 'utf8')
const foundation = fs.readFileSync(path.join(root, 'src/game/sanctuary/lightingFoundation.ts'), 'utf8')

const checks = [
  ['morning warmth raised', /morning:[\s\S]*?warmth:\s*0\.31/.test(timeEngine)],
  ['afternoon remains clean reference', /afternoon:[\s\S]*?ambientLight:\s*1[\s\S]*?waterHighlight:\s*1/.test(timeEngine)],
  ['evening lantern strength tuned', /evening:[\s\S]*?lanternStrength:\s*0\.42/.test(timeEngine)],
  ['night is moonlit and cool', /night:[\s\S]*?darkness:\s*0\.60[\s\S]*?coolness:\s*0\.78/.test(timeEngine)],
  ['lighting foundation evening strengthened', /evening:[\s\S]*?highlightStrength:\s*0\.116/.test(foundation)],
  ['lighting foundation night moon strength strengthened', /night:[\s\S]*?moonStrength:\s*0\.145/.test(foundation)],
]

const report = {
  build: '22.6',
  timestamp: new Date().toISOString(),
  passed: checks.every(([, ok]) => ok),
  checks: checks.map(([name, ok]) => ({ name, ok })),
}

const outDir = path.join(root, 'docs/22.6-global-lighting-qa')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'validation-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!report.passed) process.exit(1)
