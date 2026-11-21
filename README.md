<p align="center">
  <img src="assets/yappad.png" alt="YapPad Logo" width="140" />
</p>

# YapPad

A zero-dependency web text editor that judges everything you type in real time and escalates into ragebait chaos.

## Features

- **Real-Time Grammar & Ragebait**: Instant typo/grammar shaming, click-dodging violation modals, fix-before-typing lockout, and font-shrink punishment.
- **6 Shifting Moods & Ghostwriting**: Cycles through Passive-Aggressive, Dramatic, Intellectual, Sad, Angry, and rare Supportive states with an animated SVG face and idle ghostwriting takeover.
- **AI Writing Critic**: Evaluates your text every ~30 words (or via `Ctrl+J`) using a built-in offline critic, with optional Google Gemini (`gemini-2.5-flash`) or OpenAI (`gpt-4o-mini`) support.
- **Save & Exit Sabotage**: Hijacked `Ctrl+S` flows (note deletion, `/10` rating, 5s suspense), note-taking annoyances, a 3-step exit trap, and `i_remember.txt` grudge persistence.
- **Procedural Audio**: Built-in Web Audio API sound effects with zero external audio files.

## Quick Start

Requires Node.js (or open `index.html` directly in any modern browser).

```bash
node server.mjs
```

Open `http://127.0.0.1:3456` in your browser. Set `PORT` or `HOST` environment variables to override the default address.

## Tests

```bash
node smoke_test.mjs
node http_smoke.mjs
```

## Project Structure

```text
index.html        App shell and editor UI
styles.css        Mood themes, animations, and layout
server.mjs        Zero-dependency Node HTTP server
assets/           YapPad logo
js/               Audio, moods, grammar, AI, modals, ragebait, annoyances, and app controller
```