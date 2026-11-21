# 📝 YapPad — Project Handoff

> *A zero-dependency web text editor that judges everything you type in real time and escalates into full ragebait chaos.*

---

## 1. Project Snapshot

- **Repository**: `Realwaan/YapPad`
- **Architecture**: Zero-dependency vanilla HTML5 / CSS3 / classic modular JS (`window.YP` namespace with `window.SN` alias via `<script defer>`) + zero-dependency Node static server (`server.mjs`). Classic scripts are used instead of ES modules so the app works both via `file://` (opening `index.html` directly) and via `http://127.0.0.1:3456`.
- **Start Server**:
  ```bash
  node server.mjs
  ```
  Then visit `http://127.0.0.1:3456` (or open `index.html` directly in any modern browser).

---

## 2. Hackathon Category Coverage (A–D)

| Category | How YapPad Qualifies | Key Files |
|---|---|---|
| **A — Most Frustrating (25 pts)** | Instant mid-typing ragebait modals, 4-corner-hopping errors that dodge `✕`, shrinking error cards (`100% → 26%`), font-shrink punishment (`15.5px → 11px`), dodging `Autocorrect` button, Backspace guilt & 5th-backspace rage popup, Save sabotage (`/10` rating / 5s delay), 3-step close trap. | `js/ragebait.js`, `js/modals.js`, `js/app.js` |
| **B — Creative Use of AI (25 pts)** | Evaluates writing every ~30 words using active mood + live telemetry (`WPM`, `Backspaces`, `Errors`) via **Google Gemini API**, **OpenAI API**, or the built-in contextual offline critic. | `js/ai.js`, `js/app.js` |
| **C — Funniest (25 pts)** | 6 shifting moods (`Passive-Aggressive`, `Dramatic`, `Intellectual` with fake citations, `Sad` with rain, `Angry` word scrambler + apology, rare 10s `Supportive`), 15s ghost-writing takeover, synthesized sad violin / orchestral sting, `i_remember.txt` grudge memory. | `js/moods.js`, `js/audio.js`, `js/ragebait.js` |
| **D — Most Pointless, Yet Brilliant (25 pts)** | Fully functional text editor (open `.txt`, save `.txt`, line numbers, cursor telemetry, WPM sparkline, synchronized wavy-underline backdrop) engineered specifically to resist peaceful note-taking. | `index.html`, `styles.css`, `js/grammar.js` |

---

## 3. Architecture & File Map

Scripts load in strict dependency order inside `index.html` via `defer` (all modules attach to `window.YP` and alias `window.SN`):

| Order / File | Responsibility |
|---|---|
| `index.html` | App shell: window chrome, `File/Edit/Mood/AI Brain/Demo/Help` menus, telemetry ribbon (`#btn-restore-font` hidden until ≥3 sins), synchronized `#editor-backdrop` + `#editor-textarea`, `#commentary-panel`, SVG face status bar, `#abandoned-screen`, `#ragebait-layer`, `#toast-stack`, `#modal-overlay`. |
| `styles.css` | Theme tokens (`body[data-mood]`, `body[data-escalation="0..4"]`), pixel-synced `--editor-font-size` across backdrop & textarea, `[hidden] { display: none !important; }`, Sad rain & Supportive sparkles, ragebait hazard/corner/shrink animations. |
| `js/audio.js` | `YP.Audio`: Procedural Web Audio synthesizer (zero audio assets): `playSigh`, `playDisappointmentDing`, `playPanicPip`, `playGuiltPop`, `playOrchestralSting`, `playSuspenseMusic`, `playSadViolin`, `playAngryBuzz`, `playSupportiveChime`, `playRoastPop`, `playRageBuzzer`, `playCornerZip`, `playShrinkSqueak`. |
| `js/moods.js` | `YP.Moods`: Dialogue pools, ghost-writing scripts, `makeFakeCitation(word)`, SVG face expression states (`getFaceState`), escalation stages (`0..4`), random mood roller (~8% `supportive`). |
| `js/grammar.js` | `YP.Grammar`: Client-side spelling/grammar shamer (`analyze`, `renderBackdropHTML`, `escapeHTML`) with `LEXICON_PREFIXES` (`isPrefixOfLexicon`) so mid-word mistakes fire at 0ms while valid partial prefixes stay silent. Never autocorrects. |
| `js/ai.js` | `YP.AI`: Prompt builder, Gemini (`gemini-2.5-flash`) & OpenAI (`gpt-4o-mini`) REST callers (`12s` AbortController timeout), `generateOfflineRoast`, `testConnection`. |
| `js/modals.js` | `YP.Modals`: `openSaveFlow` (`normal` / `rate` / `delay`), `openMeltdownModal`, `openExitFlow` (3 steps + `i_remember.txt` download), `openBackspaceIntervention`, `openAISettingsModal`, `openScoreboardModal`, `openAboutModal`. |
| `js/ragebait.js` | `YP.Ragebait`: Center-screen ragebait modal (`showCenterRagebait`), 4-corner-hopping error cards (`spawnCornerStalker`), shrinking error cards (`spawnShrinkingError`), `onMistake`, `unleashAll`, `clearAll`. |
| `js/app.js` | `YP.App`: Main controller wiring menus, shortcuts (`Ctrl+S`, `Ctrl+J`, `Ctrl+O`, `Alt+N`), instant `input` grammar/ragebait trigger, font-shrink punishment, rolling WPM sparkline, 5s/15s idle engine, mood timer, Angry scrambler, eye-tracking pupils, `beforeunload` guard. |
| `server.mjs` | Zero-dependency Node HTTP static server (`127.0.0.1`, `PORT` env var or `3456`) with path-traversal guard. |
| `README.md` | Quick-start guide and stage demo instructions. |

---

## 4. Core Mechanics & Tuning Knobs

- **Instant Mid-Typing Detection (`js/grammar.js`, `js/app.js`)**
  - `textarea`'s `input` listener calls `runGrammarCheck(true)` immediately (`0ms` delay).
  - `LEXICON_PREFIXES` prevents valid prefixes (`delet`, `notep`, `qu`, `in`) from false-firing mid-word, while typos (`teh`, `notpad`, `definately`), 3+ repeated letters (`sooo`), zero-vowel 4+ letter mashes, `q` followed by non-`u`, uncapitalized sentence starts (`Hello. w`), and grammar crimes (`We could of`, `the the`) fire immediately.
  - Resolved fingerprints/starts are pruned from `state.seenIssueKeys` and `state.seenIssueStarts` so corrected mistakes re-arm if typed again, while extending the same span (`sooo` → `soooo`) does not re-spam.
- **Ragebait Overlay Behavior (`js/ragebait.js`)**
  - **Center Popup**: `onMistake(issue)` always pops dead-center with a buzzer, mistake counter, runaway `✨ Fix It For Me` (`-46px`), once-dodging `✕` (`-28px`), and humiliating dismiss buttons. Every `5th` Backspace in `js/app.js` also triggers it.
  - **Corner Stalkers**: Up to `2` cards cycle through `top-left → top-right → bottom-right → bottom-left` every `1650ms` and dodge `✕` hover up to `3` times before allowing close.
  - **Shrinking Errors**: Up to `3` cards scale through `[1.0, 0.84, 0.70, 0.56, 0.44, 0.34, 0.26]` (`550ms` initial pulse, then every `1350ms` and on hover).
- **Font-Shrink Punishment (`js/app.js`)**: `applyFontShrinkPunishment(errorCount)` adjusts `--editor-font-size` at `3` (`14px`), `4` (`13px`), `5` (`12px`), `6+` (`11px`) sins, revealing `#btn-restore-font` (`🔍 Beg For Normal Font`).
- **Typing Speed & Idle (`js/app.js`)**: `450ms` loop over `6500ms` rolling window; `<22 WPM` for `3.6s` triggers Slow Sigh (`12s` cooldown); `>=78 WPM` for `1.5s` triggers Panic shake (`10s` cooldown); `5s` (`3.5s` Sad) idle triggers lonely check; `15s` idle starts `38ms`/char ghost-writing.
- **Persistence (`localStorage` keys)**:
  - `yp_ai_config` / `sn_ai_config` — `{ provider: "offline" | "gemini" | "openai", apiKey, geminiModel, openaiModel }`
  - `yp_audio_config` / `sn_audio_config` — `{ enabled, volume }`
  - `yp_remembers_close` / `sn_remembers_close` (`"true"`) & `yp_close_count` / `sn_close_count` — grudge state after completing the 3-step exit.

---

## 5. Verification Status

1. **Syntax checks**: `node --check` passed (exit `0`) on `server.mjs`, `js/audio.js`, `js/moods.js`, `js/grammar.js`, `js/ai.js`, `js/modals.js`, `js/ragebait.js`, and `js/app.js`.
2. **Unit smoke test**: `node smoke_test.mjs` passed (`ALL_UNIT_CHECKS_PASSED`, exit `0`).
3. **HTTP server smoke test**: `node http_smoke.mjs` passed (`HTTP_SMOKE_TEST_PASSED`, exit `0`).

---

## 6. Recommended 90-Second Stage Demo Runbook

1. **Start clean**: Open `http://127.0.0.1:3456` (ensure grudge is reset via `Demo → Reset Grudge Memory` if needed) so it looks innocent.
2. **Live mid-typing ragebait (15s)**: Type `"Today i am building teh"` slowly without fixing it — let the audience watch the center ragebait modal, corner-hopping error, and shrinking error erupt mid-sentence.
3. **Instant multi-feature trigger (20s)**: Click `Demo → Insert Roastable Sample Text` to fire the font-shrink punishment (`11px` + `🔍 Beg For Normal Font`), wavy underlines, Margin Notes cards, and AI Judgment roast simultaneously; click `🔍 Beg For Normal Font` and dodge `✨ Autocorrect` once for a laugh.
4. **Mood & Meltdown highlights (25s)**: Switch `Mood → Intellectual` or `Angry` (`Demo → Trigger Angry Word Scramble`), then run `Ctrl+S` (`Demo → Save Sabotage: Rate /10` or `5s Suspense`) and `Demo → Trigger Mass-Delete Meltdown`.
5. **Scoreboard & Mic-Drop Exit (30s)**: Open `Help → Category Coverage (A–D)` to show live hackathon telemetry, then click the window `✕` button through all 3 exit prompts so `i_remember.txt` drops and the staring-eyes Abandoned Desktop screen closes the pitch.
