<p align="center">
  <img src="assets/yappad.png" alt="YapPad Logo" width="140" />
</p>

# YapPad
> *A zero-dependency web text editor that judges everything you type in real time and escalates into full ragebait chaos.*

---

## 🚀 Quick Start

YapPad runs both via its zero-dependency Node HTTP server (`http://127.0.0.1:3456`) and directly via `file://` (opening `index.html` in any modern browser):

```bash
node server.mjs
```

Then open `http://127.0.0.1:3456` in your browser.

To run the automated verification suites:

```bash
node --check server.mjs && for f in js/*.js; do node --check "$f"; done
node smoke_test.mjs
node http_smoke.mjs
```

---

## 🏆 Hackathon Category Coverage (100 / 100 pts)

| Category | How YapPad Qualifies | Key Files | Points |
|---|---|---|---|
| **A — Most Frustrating** | Instant `0ms` click-dodging Writing Violation modals, Fix-Before-Typing error lockout (blocks new typing until typos are fixed), Save-to-Delete shredder betrayal (`Ctrl+S` deletes notes instead of saving), 4-corner-hopping error stalkers that dodge `✕`, shrinking error cards (`100% → 26%`), font-shrink (`15.5px → 11px` + `🔍 Beg For Normal Font`) & Comic Sans crimes, dodging `✨ Autocorrect`, 3-space `Tab`, forbidden shortcut heckler (`Ctrl+B/I/U/F`), Plagiarism Police paste/copy watermarks, Backspace guilt & meltdown, Save sabotage (`delete`/`/10` rating/5s delay), 3-step close trap. | `js/ragebait.js`, `js/annoyances.js`, `js/modals.js`, `js/app.js` | ✅ 25 |
| **B — Creative Use of AI** | Evaluates writing every ~30 words (or via `Ctrl+J`) using active mood + live telemetry (`WPM`, `Backspaces`, `Errors`) via **Google Gemini API** (`gemini-2.5-flash`), **OpenAI API** (`gpt-4o-mini`), or the built-in contextual offline critic. | `js/ai.js`, `js/app.js` | ✅ 25 |
| **C — Funniest** | 6 shifting moods (`Passive-Aggressive`, `Dramatic`, `Intellectual` with fake academic citations, `Sad` with rain, `Angry` word scrambler + apology, rare 10s `Supportive` with sparkles), 15s ghost-writing takeover (`38ms`/char), Yappy paperclip assistant, Tab-Switch Jealousy, Free Trial nag, 17 procedural Web Audio cues, `i_remember.txt` grudge memory. | `js/moods.js`, `js/audio.js`, `js/annoyances.js`, `js/ragebait.js` | ✅ 25 |
| **D — Most Pointless, Yet Brilliant** | Fully functional text editor (open `.txt`, save `.txt`, line numbers, cursor telemetry, WPM sparkline, synchronized wavy-underline backdrop, shake-to-refill virtual toner cartridge, filename despair drift) engineered specifically to resist peaceful note-taking. | `index.html`, `styles.css`, `js/grammar.js`, `js/annoyances.js` | ✅ 25 |

---

## 📁 Architecture & File Map

Classic modular scripts load in strict dependency order inside `index.html` via `<script defer>` (attached to `window.YP` with `window.SN` alias):

```
YapPad/
├── index.html          # App shell, menus, telemetry ribbon, backdrop/textarea, SVG face, overlays
├── styles.css          # Mood & escalation tokens, pixel-synced --editor-font-size, rain/sparkles, ragebait cards
├── server.mjs          # Zero-dependency Node HTTP static server (127.0.0.1:3456) with path-traversal guard
├── assets/
│   └── yappad.png      # Official YapPad brand logo (titlebar, favicon, About modal)
├── js/
│   ├── audio.js        # Procedural Web Audio synthesizer (17 sound effects, zero external audio files)
│   ├── moods.js        # 6 moods, dialogue pools, ghostwriting scripts, fake citations, SVG face states
│   ├── grammar.js      # 0ms mid-typing spelling/grammar shamer with LEXICON_PREFIXES & wavy backdrop
│   ├── ai.js           # Gemini (gemini-2.5-flash), OpenAI (gpt-4o-mini), and 0ms Offline Critic
│   ├── modals.js       # Save sabotage (delete/normal/rate/delay), Meltdown, 3-step Exit + i_remember.txt, Scoreboard
│   ├── ragebait.js     # Click-dodging Writing Violation popup, 4-corner-hopping stalkers, shrinking error cards
│   ├── annoyances.js   # Fix-Before-Typing lockout, paste/copy watermarks, 3-space Tab, shortcut heckler, low toner, Yappy, trial nag, font crimes
│   └── app.js          # Main controller: WPM sparkline, font-shrink punishment, 5s/15s idle engine, shortcuts
├── smoke_test.mjs      # Automated unit smoke test suite
├── http_smoke.mjs      # Automated HTTP server smoke test suite
└── HANDOFF.md          # Complete technical handoff & tuning documentation
```

---

## 🎫 Website Associate Bot Tickets

Tickets are tracked in [`website-associate-bot/tickets/yappad/`](https://github.com/Realwaan/website-associate-bot/tree/main/tickets/yappad) (`/load-tickets yappad`):

| # | Ticket | Priority | Depends on |
|---|---|---|---|
| 01 | Scaffold YapPad web app shell with synchronized editor | **[PRIORITY]** | None |
| 02 | Build the commentary panel with toast notifications | **[PRIORITY]** | 01 |
| 03 | Judge typing speed with rolling WPM sparkline | | 01, 02 |
| 04 | Let YapPad ghostwrite when the user goes idle | | 03 |
| 05 | Guilt-trip the user on every deletion | | 01, 02 |
| 06 | Shame writing mistakes without fixing them | | 01, 02 |
| 07 | Add the mood state machine with SVG face | **[PRIORITY]** | 01, 02 |
| 08 | Roast content every ~30 words via AI Brain | | 02, 07 |
| 09 | Manipulate the Ctrl+S save flow | | 01, 02 |
| 10 | Synthesize procedural Web Audio sound effects | | 01 |
| 11 | Block exit with a 3-step guilt flow plus `i_remember.txt` | | 01, 02, 10 |
| 12 | Unleash ragebait overlays with font-shrink punishment | **[PRIORITY]** | 01, 02, 06, 10 |
| 13 | Verify smoke tests with 90-second stage demo runbook | | 01..12 |

---

## 🎤 90-Second Stage Demo Runbook

1. **Start clean**: Open `http://127.0.0.1:3456` (use `Demo → Reset Grudge Memory` if needed) so it starts at Stage 0 (`"Oh. You again."`).
2. **Live mid-typing ragebait (15s)**: Type `"Today i am building teh"` slowly without fixing it — watch the center ragebait modal, 4-corner-hopping error stalker, and shrinking error card erupt at `0ms` mid-sentence.
3. **Instant multi-feature trigger (20s)**: Click `Demo → Insert Roastable Sample Text` to fire the font-shrink punishment (`11px` + `🔍 Beg For Normal Font`), wavy underlines, Margin Notes cards, and AI Judgment roast simultaneously; click `🔍 Beg For Normal Font` and try to click `✨ Autocorrect` as it dodges your cursor.
4. **Mood & Meltdown highlights (25s)**: Switch `Mood → Intellectual` or click `Demo → Trigger Angry Word Scramble`, then run `Ctrl+S` (`Demo → Save Sabotage: Rate /10` or `5s Suspense`) and `Demo → Trigger Mass-Delete Meltdown`.
5. **Scoreboard & Mic-Drop Exit (30s)**: Open `Help → Category Coverage (A–D)` to show live hackathon telemetry, then click the window `✕` button through all 3 exit prompts so `i_remember.txt` downloads and the staring-eyes Abandoned Desktop screen closes the pitch.

> *"We built a notepad. It works perfectly. It just hates you."*