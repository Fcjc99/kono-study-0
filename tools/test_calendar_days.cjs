const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/store/calendar.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject,Date,Math})
const days=exportsObject.calendarDaysLeft
for(const hour of [0,2,12,23]){assert.equal(days('2026-09-09',new Date(2026,8,9,hour)),0);assert.equal(days('2026-09-10',new Date(2026,8,9,hour)),1)}
assert.equal(days('2026-03-09',new Date(2026,2,8,23)),1)
assert.equal(days('2026-11-02',new Date(2026,10,1,23)),1)
assert.equal(days('2027-01-01',new Date(2026,11,31,23)),1)
assert.equal(days('2026-09-08',new Date(2026,8,9,0)),0)
console.log('PASS calendar countdown: today, tomorrow, past dates, year boundary and daylight-saving dates.')
