/** The number on KONO's app icon (Home Screen or dock): what's due today plus anything late. Set by
 * the open app whenever that count changes; on iPhone it shows once reminders are allowed. */
type BadgeNavigator=Navigator&{setAppBadge?:(count?:number)=>Promise<void>;clearAppBadge?:()=>Promise<void>}

export const APP_BADGE_SETTING='kono-app-badge'
export const appBadgeSupported=()=>typeof navigator!=='undefined'&&typeof (navigator as BadgeNavigator).setAppBadge==='function'

export function showAppBadge(count:number){
 const nav=navigator as BadgeNavigator
 if(!appBadgeSupported())return
 const done=count>0?nav.setAppBadge?.(count):nav.clearAppBadge?.()
 void done?.catch(()=>undefined)
}

/** Tells the service worker whether the morning reminder may set the number while KONO is closed. */
export function rememberBadgeChoice(on:boolean){
 if(typeof caches==='undefined')return
 void caches.open('kono-prefs').then(cache=>on?cache.delete('/badge-off').then(()=>undefined):cache.put('/badge-off',new Response('1'))).catch(()=>undefined)
}
