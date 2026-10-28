// npm run app:sync — gets KONO's iPhone and Android projects ready to build (docs/app-store.md).
// Needs KONO_APP_URL (the live site, https://…). Lists the site as the iPhone app's app-bound domain
// (so offline KONO's service worker runs in the app), then runs `npx cap sync`.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process')
const url=(process.env.KONO_APP_URL||'').trim()
if(!/^https:\/\/[^/]+\/?$/.test(url)){console.error('Set KONO_APP_URL to the live site first, e.g. KONO_APP_URL=https://kono.example.com npm run app:sync');process.exit(1)}
const host=new URL(url).hostname
const plist=path.join(__dirname,'..','ios','App','App','Info.plist')
let s=fs.readFileSync(plist,'utf8')
const block='\t<key>WKAppBoundDomains</key>\n\t<array>\n\t\t<string>'+host+'</string>\n\t</array>\n'
s=/<key>WKAppBoundDomains<\/key>/.test(s)?s.replace(/\t<key>WKAppBoundDomains<\/key>\n\t<array>[\s\S]*?<\/array>\n/,block):s.replace(/<\/dict>\s*<\/plist>\s*$/,block+'</dict>\n</plist>\n')
fs.writeFileSync(plist,s)
console.log('iPhone app-bound domain:',host)
execFileSync('npx',['cap','sync'],{stdio:'inherit',env:process.env})
