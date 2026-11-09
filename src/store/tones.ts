/** A person's color as three tile colors that always read, whatever color they picked (a pale yellow, a deep
 * navy): the tile's fill, the bar down its side and its text. Each keeps the picked hue but takes a fixed
 * lightness for its job (Material 3's tonal idea, in OKLCH), so text stays about 13:1 on its fill and the bar at
 * least 3:1, in light and in dark. Worked out here rather than in CSS (`oklch(from …)`) because Safari has
 * drawn those as transparent. */
type Lab={L:number;a:number;b:number}
const lin=(c:number)=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4
const gam=(c:number)=>c<=0.0031308?12.92*c:1.055*c**(1/2.4)-0.055

function hexToRgb(hex:string):[number,number,number]|null{
 let h=hex.trim().replace(/^#/,'')
 if(/^[0-9a-f]{3}$/i.test(h))h=h.split('').map(x=>x+x).join('')
 if(!/^[0-9a-f]{6}$/i.test(h))return null
 return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255) as [number,number,number]
}
function toOklab([r,g,b]:[number,number,number]):Lab{
 const R=lin(r),G=lin(g),B=lin(b)
 const l=Math.cbrt(0.4122214708*R+0.5363325363*G+0.0514459929*B),m=Math.cbrt(0.2119034982*R+0.6806995451*G+0.1073969566*B),s=Math.cbrt(0.0883024619*R+0.2817188376*G+0.6299787005*B)
 return {L:0.2104542553*l+0.793617785*m-0.0040720468*s,a:1.9779984951*l-2.428592205*m+0.4505937099*s,b:0.0259040371*l+0.7827717662*m-0.808675766*s}
}
function fromOklab({L,a,b}:Lab):[number,number,number]{
 const l=(L+0.3963377774*a+0.2158037573*b)**3,m=(L-0.1055613458*a-0.0638541728*b)**3,s=(L-0.0894841775*a-1.291485548*b)**3
 return [4.0767416621*l-3.3077115913*m+0.2309699292*s,-1.2684380046*l+2.6097574011*m-0.3413193965*s,-0.0041960863*l-0.7034186147*m+1.707614701*s]
}
const inGamut=(c:number[])=>c.every(x=>x>=-0.0005&&x<=1.0005)
/** The color at lightness L with the picked hue, chroma capped at `maxC` and lowered until it fits sRGB. */
function at(hue:number,chroma:number,L:number,maxC:number):string{
 let C=Math.min(chroma,maxC),rgb=fromOklab({L,a:C*Math.cos(hue),b:C*Math.sin(hue)})
 while(!inGamut(rgb)&&C>0.001){C-=0.005;rgb=fromOklab({L,a:C*Math.cos(hue),b:C*Math.sin(hue)})}
 return '#'+rgb.map(x=>Math.round(Math.min(1,Math.max(0,gam(Math.min(1,Math.max(0,x)))))*255).toString(16).padStart(2,'0')).join('')
}
export type Tones={bg:string;bar:string;fg:string;bgDark:string;barDark:string;fgDark:string}
const cache=new Map<string,Tones>()
export function tones(color:string|undefined):Tones|null{
 if(!color)return null
 const hit=cache.get(color);if(hit)return hit
 const rgb=hexToRgb(color);if(!rgb)return null
 const {a,b}=toOklab(rgb),hue=Math.atan2(b,a),C=Math.hypot(a,b)
 const t={bg:at(hue,C,0.95,0.03),bar:at(hue,C,0.55,0.14),fg:at(hue,C,0.25,0.05),bgDark:at(hue,C,0.30,0.05),barDark:at(hue,C,0.75,0.12),fgDark:at(hue,C,0.95,0.02)}
 cache.set(color,t);return t
}
/** The tile colors as CSS variables (`--t-bg`, `--t-bar`, `--t-fg` and their dark ones), for a style={…}. */
export function toneVars(color:string|undefined):Record<string,string>{
 const t=tones(color);if(!t)return {}
 return {'--t-bg':t.bg,'--t-bar':t.bar,'--t-fg':t.fg,'--t-bg-d':t.bgDark,'--t-bar-d':t.barDark,'--t-fg-d':t.fgDark}
}
/** WCAG contrast between two hex colors (for the tests). */
export function contrast(x:string,y:string){const Y=(h:string)=>{const [r,g,b]=hexToRgb(h)!.map(lin);return 0.2126*r+0.7152*g+0.0722*b};const [p,q]=[Y(x),Y(y)].sort((m,n)=>n-m);return (p+0.05)/(q+0.05)}
/** Two colors that would be hard to tell apart on the calendar (close in OKLab, where distance is how
 * different they look). */
export function tooClose(x:string,y:string):boolean{const a=hexToRgb(x),b=hexToRgb(y);if(!a||!b)return false;const p=toOklab(a),q=toOklab(b);return Math.hypot(p.L-q.L,p.a-q.a,p.b-q.b)<0.04}
