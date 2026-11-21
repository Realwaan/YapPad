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
const mustFireInstant = [
  'teh',
  'sooo',
  'We could of',
  'should of',
  'your welcome',
  'the the',
  'Hello. w',
  'notpad',
  'definately',
  'recieve',
  'seperate',
  'occured',
  'bcdf',
  'qir',
  'Hello  world',
  'I tried, it is fine'
];
for (const sample of mustFireInstant) {
  const res = YP.Grammar.analyze(sample, { cursorPos: sample.length, instant: true });
  assert.ok(res.length >= 1, `Expected instant 0ms issue for "${sample}", got 0`);
}

const cleanWelcome = YP.Grammar.analyze("You're welcome.", { cursorPos: 15, instant: true });
assert.equal(cleanWelcome.length, 0, `Expected 0 issues on "You're welcome.", got: ${JSON.stringify(cleanWelcome)}`);

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

// 5. All 13 procedural Web Audio cues exist and safely no-op in Node (enabled and muted)
const audioCues = [
  'playSigh',
  'playDisappointmentDing',
  'playPanicPip',
  'playGuiltPop',
  'playOrchestralSting',
  'playSuspenseMusic',
  'playSadViolin',
  'playAngryBuzz',
  'playSupportiveChime',
  'playRoastPop',
  'playRageBuzzer',
  'playCornerZip',
  'playShrinkSqueak'
];
for (const cue of audioCues) {
  assert.equal(typeof YP.Audio[cue], 'function', `Missing YP.Audio.${cue}`);
  assert.doesNotThrow(() => YP.Audio[cue](), `YP.Audio.${cue} threw in Node`);
}
YP.Audio.setEnabled(false);
for (const cue of audioCues) {
  assert.equal(YP.Audio[cue](), false, `Muted YP.Audio.${cue} should return false`);
}
YP.Audio.setEnabled(true);

// 6. Save manipulation (modes, 1-10 rating validation, high-score mockery, suspense audio safety)
await import('./js/app.js');
assert.deepEqual(YP.Modals.SAVE_MODES, ['normal', 'rate', 'delay'], 'Save flow must support normal, rate, and delay');
assert.equal(typeof YP.Modals.openSaveFlow, 'function', 'YP.Modals.openSaveFlow must be exported');
assert.equal(typeof YP.App.downloadTextFile, 'function', 'YP.App.downloadTextFile must be exported');
assert.equal(typeof YP.App.saveDocument, 'function', 'YP.App.saveDocument must be exported');

for (const badScore of ['', '   ', '0', '11', '-1', '6.5', 'ten']) {
  const res = YP.Modals.evaluateSaveRating(badScore, 'draft.txt');
  assert.equal(res.valid, false, `Expected rating "${badScore}" to be rejected`);
  assert.ok(res.error.length > 5, `Expected snarky error message for invalid rating "${badScore}"`);
}

for (let score = 1; score <= 10; score++) {
  const res = YP.Modals.evaluateSaveRating(String(score), 'draft');
  assert.equal(res.valid, true, `Expected rating ${score} to be accepted`);
  assert.equal(res.value, score);
  assert.ok(res.verdict.includes(`${score}/10`), `Expected verdict to mention ${score}/10`);
  assert.ok(res.verdict.includes('draft.txt'), 'Expected verdict to normalize .txt filename');
  assert.equal(res.highScore, score >= 8, `Expected highScore flag for ${score}`);
}

assert.equal(YP.Audio.playSuspenseMusic(5), false, 'playSuspenseMusic should safely no-op in Node');
assert.equal(YP.Audio.playDisappointmentDing(), false, 'playDisappointmentDing should safely no-op in Node');
YP.Audio.stopSuspenseMusic();

// 7. Ragebait Writing Violation click-avoidance dodge export
assert.ok(
  typeof YP.Ragebait.DEFAULT_CENTER_DODGES === 'number' && YP.Ragebait.DEFAULT_CENTER_DODGES >= 1,
  'YP.Ragebait.DEFAULT_CENTER_DODGES must be a positive number'
);

// 8. Note-taking annoyance engine (4 extra audio cues + YP.Annoyances unit checks)
await import('./js/annoyances.js');
assert.ok(YP.Annoyances, 'YP.Annoyances module should be initialized');

const extraAudioCues = [
  'playPlagiarismAlarm',
  'playFakeErrorBonk',
  'playCartridgeShake',
  'playTypewriterDing'
];
for (const cue of extraAudioCues) {
  assert.equal(typeof YP.Audio[cue], 'function', `Missing YP.Audio.${cue}`);
  assert.doesNotThrow(() => YP.Audio[cue](), `YP.Audio.${cue} threw in Node`);
}

assert.ok(
  YP.Annoyances.formatPasteWatermark(2).includes('Ctrl+V #2'),
  'Paste watermark must include paste count'
);
assert.ok(
  YP.Annoyances.formatCopySignature({ errors: 3, backspaces: 5 }).includes('3 sins, 5 backspaces'),
  'Copy signature must include live sins and backspaces telemetry'
);
assert.equal(YP.Annoyances.isShoutingText('STOP YELLING RIGHT NOW'), true, 'Shouting detector must catch 2+ ALL-CAPS words');
assert.equal(YP.Annoyances.isShoutingText('Hello World from YapPad'), false, 'Shouting detector must ignore normal casing');

const dropped = YP.Annoyances.dropToner(20);
assert.equal(dropped.toner, 20, 'dropToner should set virtual toner to requested level');
assert.ok(dropped.opacity < 0.9 && dropped.opacity >= 0.54, `Low toner opacity must fade safely (${dropped.opacity})`);
const refilled = YP.Annoyances.shakeTonerCartridge();
assert.equal(refilled.toner, 100, 'shakeTonerCartridge must refill toner to 100%');
assert.equal(refilled.opacity, 1, 'shakeTonerCartridge must restore opacity to 1');

const renamed = YP.Annoyances.escalateFilename(true);
assert.ok(renamed.endsWith('.txt') && renamed !== 'untitled_regret.txt', `Expected escalated filename, got ${renamed}`);

YP.Annoyances.handleVisibilityChange(true, 1000);
const tabBack = YP.Annoyances.handleVisibilityChange(false, 5000);
assert.equal(tabBack.status, 'jealous', 'Returning after >=3s away should trigger tab-switch jealousy');

YP.Annoyances.summonYappy();
assert.equal(YP.Annoyances.state.yappyVisible, true, 'summonYappy should show Yappy');
YP.Annoyances.showTrialNag();
assert.equal(YP.Annoyances.state.trialNagVisible, true, 'showTrialNag should show trial nag');
YP.Annoyances.applyTypographyChaos('comic');
assert.equal(YP.Annoyances.state.fontCrime, 'comic', 'applyTypographyChaos should set comic fontCrime');
YP.Annoyances.restoreSanity();
assert.equal(YP.Annoyances.state.yappyVisible, false, 'restoreSanity must hide Yappy');
assert.equal(YP.Annoyances.state.trialNagVisible, false, 'restoreSanity must hide trial nag');
assert.equal(YP.Annoyances.state.fontCrime, 'none', 'restoreSanity must clear fontCrime');
assert.equal(YP.Annoyances.state.toner, 100, 'restoreSanity must restore toner to 100%');

console.log('ALL_UNIT_CHECKS_PASSED');
