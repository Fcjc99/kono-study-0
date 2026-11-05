// Actual production callback; GPU/DOM rendering stubbed, close observed explicitly.
const assert=require('assert/strict'),{start}=require('./production_runtime.cjs');
function find(n,predicate){if(!n||typeof n!=='object')return null;if(predicate(n))return n;for(const c of [n.props?.children].flat(Infinity)){const r=find(c,predicate);if(r)return r}return null}
(async()=>{
 for(const kind of ['mini','clear','jp','ball','dish','grow','tower','coins']){
  const h=await start(),v=h.review;let closed=0;
  const dialog=find(h.render(),n=>n.type==='dialog'&&n.props.className?.includes('cove-practice-dialog'));assert.ok(dialog);dialog.props.ref.current={close(){closed++}};
  v.practiceState.current.enabled=true;v.pauseDetails(true);const frame=v.cove.current.frame,hand=v.cove.current.hand;
  v.command.current(kind);
  assert.equal(closed,1,kind+' closes exactly once after acceptance');assert.equal(v.detailsPauseRef.current,false,kind+' resumes immediately');assert.equal(v.practiceState.current.enabled,false);assert.equal(v.practiceState.current.used,true);assert.equal(v.cove.current.hand,hand);assert.equal(v.cove.current.jpWins,0);assert.equal(v.cove.current.boardClears,0);
  h.advance(3);if(kind!=='clear')assert.ok(v.cove.current.frame>frame,kind+' resumes real rules/physics');else assert.equal(v.cove.current.boardClearBusy,true);
  console.log('PASS accepted '+kind+' closes Practice and resumes without clearing sample provenance');h.cleanup();
 }
 const h=await start(),v=h.review;let closed=0;const dialog=find(h.render(),n=>n.type==='dialog'&&n.props.className?.includes('cove-practice-dialog'));dialog.props.ref.current={close(){closed++}};v.practiceState.current.enabled=true;v.pauseDetails(true);
 for(const kind of ['mini','clear','jp','ball','dish','grow','tower','coins']){v.blockedRef.current=true;const before=v.cove.current;v.command.current(kind);assert.equal(closed,0);assert.equal(v.detailsPauseRef.current,true);assert.equal(v.practiceState.current.enabled,true);assert.equal(v.practiceState.current.used,false);assert.equal(v.cove.current,before)}
 v.blockedRef.current=false;v.cove.current={...v.cove.current,dishQueue:1};v.command.current('dish');assert.equal(closed,0);assert.equal(v.detailsPauseRef.current,true);assert.equal(v.practiceState.current.enabled,true);
 assert.ok(h.slots.includes('A bonus is already playing. Let it finish first.'));
 console.log('PASS rejected samples retain open paused dialog, unchanged rights and reason feedback');h.cleanup();
})().catch(e=>{console.error(e);process.exitCode=1});
