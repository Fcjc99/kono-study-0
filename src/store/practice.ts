import {BANK_START,LAYER,awardTower,awardTide,type Cove} from './pusher'

export type PracticeCommand='coins'|'ball'|'dish'|'grow'|'tower'|'jp'|'clear'|'mini'
export const PRACTICE_ACTIONS=[
 {kind:'mini',label:'Tower +20',description:'Build 20 real sample medals in the right bay. On the first release they join 128 separate starting-stock medals; later samples use only the exact award.'},
 {kind:'clear',label:'Board Clear',description:'One practice clear per round: sweep existing medals into the tray, then refill the field. No earned clear or jackpot is spent.'},
 {kind:'jp',label:'Try JP · 100',description:'A fixed 100-medal practice Tide: choose a lane, load the real reserve and release. Not an earned jackpot or an odds test.'},
 {kind:'ball',label:'Run ball',description:'Send one sample ball through the real magazine and rail.'},
 {kind:'dish',label:'Ball lottery',description:'Try one sample ball lottery with the original random payout rules.'},
 {kind:'grow',label:'Grow +20',description:'Add 20 sample medals to the tower reserve.'},
 {kind:'tower',label:'Release tower',description:'Build the bank into supported stacks, slide to the center and release.'},
 {kind:'coins',label:'12 medals',description:'Feed 12 sample prize medals through a side hopper.'},
] as const
export type PracticeState={enabled:boolean;used:boolean;lastAt:number;addedCoins:number;addedBalls:number;sampleLotteries:number;clearUsed?:boolean}
export const newPractice=():PracticeState=>({enabled:false,used:false,lastAt:-Infinity,addedCoins:0,addedBalls:0,sampleLotteries:0,clearUsed:false})
export type PracticeContext={ready:boolean;ended:boolean;towerBusy:boolean;pending:number;balls:number}
/** Explicit sample requests. Never modify hand/won or overwrite an active
 * wheel/bonus. Release moves the existing bank, not a fabricated wheel win. */
export function practiceCommand(state:PracticeState,cove:Cove,kind:PracticeCommand,now:number,context:PracticeContext){
 const reject=(message:string)=>({accepted:false,state,cove,coins:0,balls:0,message})
 if(!state.enabled)return reject('Turn on Practice to try a sample.')
 if(!context.ready||context.ended)return reject('The 3D machine is not ready.')
 if(cove.boardClearBusy)return reject('Board Clear is running. Queued rewards are safe; wait for the fresh field.');
 if(kind==='clear'&&state.clearUsed)return reject('The Board Clear practice sample has already been used this round.');
 if(now-state.lastAt<650)return reject('One sample at a time — try again in a moment.')
 if((kind==='tower'||kind==='mini')&&(context.towerBusy||cove.towers.some(t=>t.source==='bank')))return reject('The tower is already releasing.')
 if(kind==='grow'&&context.towerBusy)return reject('Let the current tower finish releasing first.')
 if(kind==='dish'&&(cove.dish||cove.dishQueue||cove.chance||cove.chanceQueue||cove.bonusResult))return reject('A bonus is already playing. Let it finish first.')
 if(kind==='ball'&&context.balls>=8)return reject('Let the balls clear their route first.')
 if((kind==='coins'||kind==='ball'||kind==='tower'||kind==='mini'||kind==='jp')&&context.pending>=180)return reject('The dispensers are busy. Queued pieces are safe; let them clear first.')
 const next={...state,used:true,lastAt:now}
 let c=cove,coins=0,balls=0,message=''
 if(kind==='clear'){c={...c,boardClearBusy:true,boardClearPractice:true};next.clearUsed=true;message='Practice Board Clear: existing medals collect through the tray, then the field refills. One sample per round.'}
 if(kind==='mini'){c=awardTower(c,20,50);next.addedCoins+=20;message='Practice tower: exactly 20 sample medals build in the right bay. Any starting stock stays separate from this award. Only real tray contacts collect.'}
 if(kind==='jp'){c=awardTide(c,100,true);next.addedCoins+=100;message='Practice JP: 100 fixed sample medals. Choose placement; this is not an earned win or an odds test.'}
 if(kind==='coins'){coins=12;next.addedCoins+=12;message='Sample: 12 medals queued at the side hopper.'}
 if(kind==='ball'){balls=1;next.addedBalls++;message='Sample ball: magazine → rail → shelf. Push it to the tray.'}
 if(kind==='dish'){c={...c,dishQueue:c.dishQueue+1};next.sampleLotteries++;message='Sample ball lottery — original random outcomes, no guaranteed win.'}
 if(kind==='grow'){c={...c,bank:(c.bank??BANK_START)+4*LAYER};next.addedCoins+=4*LAYER;message='Sample: 20 medals added to the tower bank.'}
 if(kind==='tower'){
  const n=c.bank??BANK_START
  c=awardTower({...c,bank:BANK_START},n,50,'bank')
  // The visible reserve refills, just as after an earned bank release. Record
  // that explicit practice supply; the released amount remains exactly n.
  next.addedCoins+=BANK_START
  message=`Practice release: ${n} banked medals → side build → slide → release. Push them to the front.`
 }
 return {accepted:true,state:next,cove:c,coins,balls,message}
}
