/** The KONO emblem (the same shape as the app icon), drawn in the surrounding text colour so each
 * theme's brand badge colours it. The shape comes from public/brand-logo.svg as a mask, which keeps its
 * long outline out of the startup script. */
export default function BrandLogo(){
 return <span className="brand-logo" aria-hidden="true"/>
}
