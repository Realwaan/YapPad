import assert from 'node:assert/strict';

import './js/audio.js';
import './js/moods.js';
import './js/grammar.js';
import './js/ai.js';
import './js/modals.js';
import './js/ragebait.js';

const YP = globalThis.YP;
const SN = globalThis.SN;
assert.ok(YP && SN && YP === SN, 'YP and SN namespaces should be initialized');

// 1. All 6 moods, supportive.durationSec === 10, and fake academic citations
const moodKeys = Object.keys(YP.Moods.MOODS);
assert.equal(moodKeys.length, 6, 'Should define all 6 moods');
for (const expected of ['passive-aggressive', 'dramatic', 'intellectual', 'sad', 'angry', 'supportive']) {
  assert.ok(YP.Moods.MOODS[expected], `Missing mood: ${expected}`);
}
assert.equal(YP.Moods.MOODS.supportive.durationSec, 10, 'Supportive mood must last 10 seconds');

const citation = YP.Moods.makeFakeCitation('orthography');
assert.ok(citation.includes('(') && citation.includes(')') && citation.includes('orthography'), 'Fake citation format check');

// 2. Clean sentence 0 issues; "going" 0 issues; "could of" $1 fix; XSS <script> escaping
const cleanIssues = YP.Grammar.analyze('This is a clean sentence with going and nothing wrong.', {
  cursorPos: 54
});
assert.equal(cleanIssues.length, 0, `Expected 0 issues on clean sentence, got: ${JSON.stringify(cleanIssues)}`);

const goingIssues = YP.Grammar.analyze('going', { cursorPos: 5 });
assert.equal(goingIssues.length, 0, 'Expected 0 issues on "going"');

const couldOfIssues = YP.Grammar.analyze('We could of won.', { cursorPos: 16 });
assert.ok(couldOfIssues.length >= 1, 'Expected issue on "We could of"');
assert.ok(!couldOfIssues[0].message.includes('$1'), 'Message must not contain literal $1');
assert.equal(couldOfIssues[0].suggestion.toLowerCase(), 'could have');

const xssHTML = YP.Grammar.renderBackdropHTML('<script>alert(1)</script> teh', [
  { start: 26, end: 29, type: 'spelling' }
]);
assert.ok(!xssHTML.includes('<script>'), 'renderBackdropHTML must escape <script> tags');
assert.ok(xssHTML.includes('&lt;script&gt;'), 'renderBackdropHTML must contain escaped script entity');

// 3. Instant mid-typing detection (cursorPos === text.length, no trailing space)
const mustFireInstant = ['teh', 'sooo', 'We could of', 'the the', 'Hello. w', 'notpad'];
for (const sample of mustFireInstant) {
  const res = YP.Grammar.analyze(sample, { cursorPos: sample.length, instant: true });
  assert.ok(res.length >= 1, `Expected instant 0ms issue for "${sample}", got 0`);
}

const mustStaySilentMidWord = ['delet', 'notep', 'qu', 'in', 'Hello. W'];
for (const prefix of mustStaySilentMidWord) {
  const res = YP.Grammar.analyze(prefix, { cursorPos: prefix.length, instant: true });
  assert.equal(res.length, 0, `Expected 0 false positives for partial prefix "${prefix}", got: ${JSON.stringify(res)}`);
}

// 4. Offline AI roasts (Passive-Aggressive & Intellectual with fake citation)
const paRoast = YP.AI.generateOfflineRoast(
  'Today I am writing a draft for the hackathon presentation.',
  'passive-aggressive',
  { wpm: 38, backspaces: 4, errors: 2 }
);
assert.ok(typeof paRoast === 'string' && paRoast.length > 15, 'Passive-aggressive offline roast should be non-empty');

const intelRoast = YP.AI.generateOfflineRoast(
  'Today I am writing a draft for the hackathon presentation.',
  'intellectual',
  { wpm: 38, backspaces: 4, errors: 2 }
);
assert.ok(intelRoast.includes('(') && intelRoast.includes(')'), 'Intellectual offline roast must include a fake citation');

console.log('ALL_UNIT_CHECKS_PASSED');
