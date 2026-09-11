const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const module = {exports:{}};
  vm.runInNewContext(code, {module, exports:module.exports, require:name=>load(path.resolve(path.dirname(file), name+'.ts')), Date, Set, Object});
  return module.exports;
}
const p = load(path.join(root,'src/game/progression/progressionEngine.ts'));
for (const [fn, thresholds] of [
  ['stageForCredits',[0,3,8,15,25,40]],
  ['homeStageForCredits',[0,5,12,20,30,40]],
  ['pondStageForScienceCredits',[0,1,2,3,5,8]],
  ['gardenStageForCredits',[0,4,10,18,30,45]],
  ['lanternStageForActiveDays',[0,1,3,5,7,14]],
]) for (let stage=0;stage<=5;stage++) {
  assert.equal(p[fn](thresholds[stage]),stage,fn);
  if(stage) assert.equal(p[fn](thresholds[stage]-1),stage-1,fn);
}
let state = p.createSanctuaryProgress('qa');
const tasks = Array.from({length:45},(_,i)=>({id:`qa-${i}`,profileId:'qa',subjectId:'science',subjectKey:'science',done:true}));
tasks.forEach((task,i)=>state=p.applyTaskCompletionChange(state,{task,completed:true,completedAt:`2026-08-${String(i%14+1).padStart(2,'0')}T12:00:00Z`}));
for(const feature of ['tree','home','garden','pond','lanterns']) assert.equal(state.featureStages[feature],5,feature);
state=p.applyTaskCompletionChange(state,{task:tasks[0],completed:true});
assert.equal(state.totalCredits,45,'duplicate completion must not earn credit');
assert.equal(p.applyTaskCompletionChange(state,{task:{...tasks[0],profileId:'other'},completed:true}),state,'profile isolation');
const reopened=tasks.map(task=>({...task,done:false}));
for(const reset of [p.migrateSanctuaryProgress(state,'qa',reopened),p.syncCurrentTaskCompletion(state,reopened)]) {
  assert.equal(reset.totalCredits,45);
  assert.equal(reset.featureStages.tree,5);
}
tasks.forEach(task=>state=p.applyTaskCompletionChange(state,{task,completed:false}));
assert.equal(state.totalCredits,45);
assert.equal(state.featureStages.tree,5);
state=p.createSanctuaryProgress('qa');assert.equal(state.totalCredits,0);assert.ok(Object.values(state.featureStages).every(stage=>stage===0));
console.log('PASS: all feature thresholds, stage 5, duplicate credit, profile isolation, reopen keeps credits; explicit reset and migration.');
