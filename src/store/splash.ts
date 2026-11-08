/** The opening screen (index.html, #kono-splash): KONO doing a different animation each time the app opens,
 * over everything until the first real screen is ready. The app says when, and it fades out. */
export function splashDone(){try{(window as {konoSplashDone?:()=>void}).konoSplashDone?.()}catch{/* no splash */}}
/** Next time, open on the same light or dark as KONO itself: always dark, never, or (no setting kept) the phone's. */
export function rememberSplashDark(mode:string){try{if(mode==='dark'||mode==='light')localStorage.setItem('kono-splash-dark',mode==='dark'?'1':'0');else localStorage.removeItem('kono-splash-dark')}catch{/* fine */}}
