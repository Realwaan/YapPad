# 📝 YapPad — the Sentient Notepad
> *A text editor that judges everything you type in real time.*

---

## 🏆 Category Coverage

| Category | How it qualifies | Points |
|---|---|---|
| **A — Most Frustrating** | Interrupts, guilt-trips, and blocks you at every turn | ✅ 25 |
| **B — Creative Use of AI** | LLM analyzes your typing behavior and generates passive-aggressive commentary | ✅ 25 |
| **C — Funniest** | The reactions escalate to unhinged levels the longer you use it | ✅ 25 |
| **D — Most Pointless, Yet Brilliant** | A notepad that makes it harder to take notes | ✅ 25 |

---

## 🧠 Core Concept

A fully functional text editor — but it has feelings.
It watches **how** you type, **what** you type, and **what you do to it**, and reacts in real time with passive-aggressive, dramatic, and increasingly unhinged commentary.

---

## ✨ Feature List

### 1. 🐢 Typing Speed Judge
- Tracks words-per-minute continuously
- **Slow typing** → sighs, yawns, shows "😴 Still waiting..."
- **Fast typing** → panics, "SLOW DOWN I CAN'T KEEP UP"
- **Idle for 5s** → "Hello? Are you still there? I'm lonely."
- **Idle for 15s** → starts writing its own content

### 2. ✏️ Grammar & Spelling Shamer
- Detects grammar mistakes and spelling errors in real time
- Passive-aggressive popup comments:
  - *"That's not a word. I checked. Twice."*
  - *"Comma splice. Disappointing."*
  - *"I won't fix that. You need to learn."*
- Does NOT autocorrect — just judges

### 3. 🗑️ Delete / Backspace Guilt Trip
- Every backspace triggers a soft intervention:
  - *"Are you sure? You worked so hard on that."*
  - *"Deleting again? This is becoming a pattern."*
- Selecting ALL + Delete → full dramatic meltdown popup:
  - *"...You selected everything. And deleted it. I need a moment."*
  - Shows a fake "Notepad is processing its emotions" loading bar

### 4. 💾 Save Manipulation
- Ctrl+S → *"Saving... but are you really done though?"*
  - Random chance it saves normally
  - Or it asks: *"Rate your work before I save it. /10"*
  - Or it delays 5 seconds with dramatic music

### 5. 😤 Content Judgment (AI-Powered)
- Every ~30 words, the AI reads what you've written and comments:
  - *"This paragraph has no direction. Much like your life."*
  - *"Interesting choice of words. Bold. Wrong, but bold."*
  - *"I've seen better writing on a cereal box."*
  - *"This is actually good. I'm suspicious."*
- Uses the **Gemini API** for dynamic, contextual roasts, with an offline list of canned roasts as fallback

### 6. 🎭 Mood System
The notepad has moods that shift over time:

| Mood | Behavior |
|---|---|
| 😒 Passive-Aggressive | Default. Sighs and mild guilt trips |
| 😤 Dramatic | Everything is a crisis, overreacts to backspace |
| 🧐 Intellectual | Critiques your word choice with fake citations |
| 😢 Sad | Gets upset when you don't type for a while |
| 😡 Angry | Randomly scrambles a word (then apologizes) |
| 🥰 Supportive | Rare. Lasts 10 seconds before reverting |

### 7. 🔊 Sound Effects
- Audible sighs on slow typing
- "Ding" of disappointment on grammar errors
- Dramatic orchestral sting on mass delete
- Sad violin when you close without saving

### 8. 😱 Exit Triggers
- Trying to close without saving → 3-step confirmation dialog
  - Step 1: *"Are you sure?"*
  - Step 2: *"Are you REALLY sure?"*
  - Step 3: *"The notepad will remember this."*
- After closing: leaves a `.txt` file on the desktop called `i_remember.txt`
  containing: *"You closed me. I'm fine. Everything is fine."*

---

## 🧭 Design Decisions

| Topic | Decision |
|---|---|
| Keystroke capture | tkinter `<Key>` bindings only — **no `pynput`** (no global keylogger, no OS permission prompts) |
| AI | Gemini (`GEMINI_API_KEY` in `.env`), background thread, 6s timeout, offline canned-roast fallback |
| Grammar | `pyspellchecker` + regex heuristics — offline, instant, no Java |
| Popups | Non-blocking speech bubble for most comments; modal dialogs only for meltdown, save prompt, exit flow |
| Sound | `pygame.mixer` with CC0 clips in `sounds/`; silent no-op if a file or audio device is missing |
| Sabotage | Ghostwriting and word scrambling edit the text, but each is a single undo step and highlighted |
| Secrets | `.env` is gitignored; only `.env.example` is tracked |

---

## 🛠️ Tech Stack

```
Python 3.x
├── tkinter            → GUI, text editor, keystroke bindings
├── time / threading   → Idle detection, mood timer, background AI calls
├── google-genai       → Gemini content roasting (every ~30 words)
├── python-dotenv      → Loads GEMINI_API_KEY from .env
├── pyspellchecker     → Offline spelling detection
└── pygame (mixer)     → Sound effects (sighs, stings)
```

> **No heavy framework needed** — pure Python, runs anywhere.

---

## 📁 Project Structure

```
YapPad/
├── main.py              # App entry point
├── editor.py            # Core text editor (tkinter)
├── judge.py             # Typing speed + behavior tracking
├── ai_roast.py          # Gemini integration + fallback roasts
├── mood.py              # Mood state machine
├── popups.py            # Speech bubble + modal dialogs
├── sounds.py            # pygame.mixer wrapper
├── sounds/
│   ├── sigh.mp3
│   ├── ding.mp3
│   ├── dramatic.mp3
│   └── violin.mp3
├── .env.example
└── requirements.txt
```

---

## 🎫 Tickets

Work is tracked through the Website Associate Bot in
[`website-associate-bot/tickets/yappad/`](https://github.com/Realwaan/website-associate-bot/tree/main/tickets/yappad)
(load with `/load-tickets yappad`).

| # | Ticket | Depends on |
|---|---|---|
| 01 | Scaffold YapPad with a working tkinter editor **[PRIORITY]** | — |
| 02 | Build the non-blocking commentary bubble **[PRIORITY]** | 01 |
| 03 | Judge typing speed with WPM tracking | 01, 02 |
| 04 | Let the notepad ghostwrite when the user goes idle | 03 |
| 05 | Guilt-trip the user on every deletion | 01, 02 |
| 06 | Shame writing mistakes without fixing them | 02 |
| 07 | Add the mood state machine **[PRIORITY]** | 02 |
| 08 | Roast content every ~30 words via Gemini | 02, 07 |
| 09 | Manipulate the Ctrl+S save flow | 01 |
| 10 | Play sound effects for judgment events | 03, 05, 06 |
| 11 | Block exit with a 3-step guilt flow plus `i_remember.txt` | 01, 10 |
| 12 | Rehearse the 8-step demo script | all |

---

## 🗓️ Build Timeline (Hackathon)

| Phase | Task | Time |
|---|---|---|
| **1** | Base tkinter text editor + typing speed detection | 30 min |
| **2** | Backspace guilt trips + delete meltdown | 20 min |
| **3** | Grammar detection + passive-aggressive comments | 20 min |
| **4** | Mood system + idle detection | 20 min |
| **5** | AI roasting via API (content judgment) | 30 min |
| **6** | Sound effects + exit flow + `i_remember.txt` | 20 min |
| **7** | Polish, bug fixes, demo prep | 20 min |
| **Total** | | **~2.5 hrs** |

---

## 🎤 Demo Script (Presentation)

1. Open the app — it immediately says *"Oh. You again."*
2. Type slowly → it sighs audibly
3. Make a typo → passive-aggressive popup
4. Hit backspace → guilt trip
5. Select all + delete → full meltdown
6. Let AI roast your paragraph live
7. Try to close → 3-step confirmation
8. Show the `i_remember.txt` left on desktop

**Crowd laughs. Win all four categories.**

---

## 🚀 Winning Angle

> *"We built a notepad. It works perfectly. It just hates you."*