/** When this browser agreed to the Terms & Privacy (carried from the sign-in screen to plan creation). */
const ACCEPT_KEY='kono-terms-accepted'
export const rememberedTermsAcceptance=()=>{try{return localStorage.getItem(ACCEPT_KEY)}catch{return null}}
export const rememberTermsAcceptance=()=>{const at=new Date().toISOString();try{localStorage.setItem(ACCEPT_KEY,at)}catch{/* storage unavailable */}return at}
