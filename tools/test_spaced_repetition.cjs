const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const module = {exports:{}};
  vm.runInNewContext(code, {module, exports:module.exports, require:name=>load(path.resolve(path.dirname(file), name+'.ts')), Date, Math});
  return module.exports;
}
const srs = load(path.join(root,'src/store/spacedRepetition.ts'));
const fc = load(path.join(root,'src/store/flashcards.ts'));

const today = '2026-09-18';

// A fresh card is due immediately, same as the old needsReview:true default.
const fresh = srs.srsInitial(today);
assert.equal(fresh.interval, 0, 'fresh card has interval 0');
assert.equal(fresh.ease, 2.3, 'fresh card starts at the initial ease');
assert.equal(fresh.dueDate, today, 'fresh card is due today');
assert.equal(srs.isDue(fresh, today), true, 'fresh card is due today');
assert.equal(srs.isDue(fresh, '2026-09-17'), false, 'fresh card is not due on an earlier date (isDue only checks <=)');

// Correct answers grow the interval: 1 day, then 3, then interval*ease, with ease nudging up.
let state = fresh
state = srs.srsGrade(state, true, today)
assert.equal(state.interval, 1, 'first correct answer: interval becomes 1')
assert.equal(state.dueDate, '2026-09-19', 'due date advances by the new interval')
state = srs.srsGrade(state, true, '2026-09-19')
assert.equal(state.interval, 3, 'second correct answer: interval becomes 3')
const easeAfterTwoHits = state.ease
assert.ok(easeAfterTwoHits > 2.3, 'ease increases after correct answers')
state = srs.srsGrade(state, true, '2026-09-22')
assert.equal(state.interval, Math.round(3 * easeAfterTwoHits), 'third correct answer: interval grows by interval*ease')

// A miss resets the card to box zero, due again the same day, and dips ease -- it never goes
// unreachable even after many consecutive misses (floor), same for the ease ceiling on many hits.
let missed = srs.srsGrade(state, false, '2026-09-25')
assert.equal(missed.interval, 0, 'a miss resets interval to 0')
assert.equal(missed.dueDate, '2026-09-25', 'a missed card is due again the same day')
assert.ok(missed.ease < state.ease, 'ease drops after a miss')
let floor = fresh
for (let i = 0; i < 20; i++) floor = srs.srsGrade(floor, false, today)
assert.ok(floor.ease >= 1.3, 'ease never drops below the floor even after many misses')
// Ease saturates at the ceiling after just 5 hits (0.1 per hit from 2.3), so 10 is plenty --
// intervals compound multiplicatively (interval*ease each hit), and addDays only accepts dates
// within a sane calendar range, so this must not run so many iterations it overflows that.
let ceiling = fresh
let d = today
for (let i = 0; i < 10; i++) { ceiling = srs.srsGrade(ceiling, true, d); d = ceiling.dueDate }
assert.ok(ceiling.ease <= 2.8, 'ease never exceeds the ceiling even after many hits')

// reviewQueue only offers cards actually due, most-overdue first; missedOnly narrows to box-zero cards.
const deck = {
  id: 'deck-1', profileId: 'p1', title: 'Test deck',
  cards: [
    {id:'c-overdue', question:'q', answer:'a', interval:0, ease:2.3, dueDate:'2026-09-15'},
    {id:'c-today', question:'q', answer:'a', interval:1, ease:2.3, dueDate:'2026-09-18'},
    {id:'c-future', question:'q', answer:'a', interval:5, ease:2.5, dueDate:'2026-09-30'},
    {id:'c-future-missed', question:'q', answer:'a', interval:0, ease:1.3, dueDate:'2026-09-30'},
  ],
}
assert.equal(fc.reviewQueue(deck, today).join(','), 'c-overdue,c-today', 'only due cards, most-overdue first')
assert.equal(fc.reviewQueue(deck, today, true).join(','), 'c-overdue', 'missedOnly further narrows to due box-zero cards')
assert.equal(fc.fullDeckQueue(deck).length, 4, 'fullDeckQueue (Study anyway) ignores due dates entirely')
assert.equal(fc.nextDueIn(deck, today), 12, 'nextDueIn reports days until the soonest upcoming (not-yet-due) card')
const allDueDeck = {...deck, cards: deck.cards.filter(c => c.dueDate <= today)}
assert.equal(fc.nextDueIn(allDueDeck, today), null, 'nextDueIn is null when every card is already due')

console.log('PASS: spaced repetition -- fresh card state, interval growth on hits, reset+ease floor/ceiling on misses, reviewQueue/fullDeckQueue/nextDueIn.')
