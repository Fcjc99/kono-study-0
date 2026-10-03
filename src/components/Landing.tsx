import { motion, MotionConfig, type Variants } from 'motion/react'
import { EmailSignIn } from './AccountPanel'
import type { usePlannerRepository } from '../store/repository'
type Store=ReturnType<typeof usePlannerRepository>
const rise:Variants={hidden:{opacity:0,y:14},show:{opacity:1,y:0,transition:{type:'spring',stiffness:260,damping:26}}}
const LANDING_POINTS=[['📅','Classes, due dates and exams in one calm place'],['🌱','Your island grows as you finish work'],['🐾','KONO cheers you on, one small step at a time']] as const
/** The first screen for someone without a plan: what KONO is, the island it grows, and the email sign-in. */
export default function Landing({store,onUseDevice,onDemo}:{store:Store;onUseDevice:()=>void;onDemo:()=>void}){
 return <MotionConfig reducedMotion="user"><main className="onboarding landing">
  <motion.section className="landing-copy" initial="hidden" animate="show" variants={{show:{transition:{staggerChildren:.07}}}}>
   <motion.span variants={rise} className="eyebrow">Welcome to KONO</motion.span>
   <motion.h1 variants={rise}>A little space for steady progress.</motion.h1>
   <motion.p variants={rise} className="landing-lede">Sign in with your email to start your plan. It’s backed up every time you open KONO and there on any device. No password: we email you a link.</motion.p>
   <motion.ul variants={rise} className="landing-points">{LANDING_POINTS.map(([icon,text])=><li key={text}><span aria-hidden="true">{icon}</span>{text}</li>)}</motion.ul>
   <motion.div variants={rise} className="landing-form"><EmailSignIn store={store} button="Email me a link to start" onUseDevice={onUseDevice} requireTerms/></motion.div>
   <motion.p variants={rise} className="onboarding-demo">Just looking around? <motion.button type="button" className="landing-demo" onClick={onDemo} whileHover={{y:-2}} whileTap={{scale:.96}}>Try a small demo instead <span aria-hidden="true">→</span></motion.button> <small>The demo is saved on this device only.</small></motion.p>
  </motion.section>
  <motion.figure className="landing-art" aria-hidden="true" initial={{opacity:0,scale:.94,rotate:-1.5}} animate={{opacity:1,scale:1,rotate:0}} transition={{type:'spring',stiffness:120,damping:18,delay:.15}}>
   <img className="landing-island" src="/landing/island.webp" alt="" width={960} height={720} decoding="async"/>
   <motion.img className="landing-kono" src="/garden/kono/happy.webp" alt="" animate={{y:[0,-8,0]}} transition={{duration:3.2,repeat:Infinity,ease:'easeInOut'}} whileHover={{scale:1.12,rotate:-6}}/>
   <motion.span className="landing-chip is-done" initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:.7,type:'spring',stiffness:200,damping:20}}><b>✓</b> Math worksheet done</motion.span>
   <motion.span className="landing-chip is-streak" initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} transition={{delay:.95,type:'spring',stiffness:200,damping:20}}><b>🔥</b> 4-day streak</motion.span>
  </motion.figure>
 </main></MotionConfig>
}
