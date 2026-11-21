/**
 * YapPad Note-Taking Annoyance Engine (YP.Annoyances / SN.Annoyances).
 * Sabotages universal note-taking habits (copy/paste, Tab, bullet lists, ALL CAPS,
 * formatting shortcuts, low virtual toner, filename drift, Yappy paperclip, trial nag,
 * tab-switch jealousy, micro-scroll drift, and typography crimes) while preserving
 * Ctrl+Z undo safety and single-click sanity restoration.
 */
(function () {
  'use strict';

  const root = typeof window !== 'undefined' ? window : globalThis;
  root.YP = root.YP || {};
  root.SN = root.YP;

  const CONFIG = {
    PASTE_MIN_CHARS: 8,
    TAB_SPACES: '   ',
    BULLET_SABOTAGE_EVERY: 3,
    TONER_START: 100,
    TONER_MIN: 15,
    TONER_WARN_THRESHOLD: 40,
    TONER_COST_PER_CHAR: 0.65,
    TONER_ESCALATED_COST_PER_CHAR: 1.1,
    SHOUTING_COOLDOWN_MS: 12000,
    SHOUTING_TILT_MS: 6000,
    TAB_AWAY_MS: 3000,
    SCROLL_DRIFT_COOLDOWN_MS: 22000,
    SCROLL_DRIFT_DEBOUNCE_MS: 350,
    SCROLL_DRIFT_PX: 32,
    YAPPY_COMEBACK_MS: 20000,
    TAB_NOTE_COOLDOWN_MS: 4500,
    FILENAMES: [
      'untitled_regret.txt',
      'notes_final.txt',
      'notes_final_v2.txt',
      'notes_FINAL_REAL_v3.txt',
      'dont_open_in_public.txt'
    ]
  };

  const FORBIDDEN_SHORTCUT_LINES = {
    b: [
      'Bold? Your prose is not brave enough for bold.',
      'Ctrl+B denied. Try writing stronger verbs instead.'
    ],
    i: [
      'Italics will not make that sentence sound any smarter.',
      'Ctrl+I rejected. Plain text is all you deserve.'
    ],
    u: [
      'Underline? I am already underlining all your typos in red.',
      'Ctrl+U blocked. My wavy underlines are superior.'
    ],
    f: [
      'Ctrl+F? I hid Find. Scroll like our ancestors did.',
      'Searching your own notes? Bold of you to assume you wrote it down.'
    ]
  };

  const BULLET_SNARKS = [
    '😒 (still pretending you will read these notes later)',
    'iv. (yes, I switched your list to Roman numerals)',
    '• [TODO: actually understand this lecture]'
  ];

  const YAPPY_LINES = [
    'Hi! It looks like you are trying to take notes. Want me to make that harder?',
    'Need help organizing your thoughts? Have you tried having better ones?',
    'Pro Tip: Pressing Ctrl+S is now a thrilling game of emotional roulette!',
    'I noticed you have not panicked in 12 seconds. Should I fix that?'
  ];

  const TAB_JEALOUSY_LINES = [
    "Oh, back from Google? Don't worry, I didn't see you looking up how to spell 'definitely'.",
    'Cheat on me with another browser tab again and see what happens to your font size.',
    'Welcome back. While you were gone, I judged every paragraph you left unattended.'
  ];

  const state = {
    toner: CONFIG.TONER_START,
    tonerWarned: false,
    pasteCount: 0,
    copyCount: 0,
    tabCount: 0,
    bulletCount: 0,
    shortcutCount: 0,
    filenameStep: 0,
    yappyVisible: false,
    yappyDismissCount: 0,
    yappyLineIdx: 0,
    yappyChaosIdx: 0,
    trialNagVisible: false,
    trialNagAutoShown: false,
    fontCrime: 'none',
    yellingTilt: false,
    hiddenSince: null,
    tabJealousyIdx: 0,
    lastShoutAt: 0,
    lastTabNoteAt: 0,
    lastScrollDriftAt: 0,
    scrollDriftDir: 1
  };

  let tiltTimer = null;
  let yappyComebackTimer = null;
  let scrollDriftTimer = null;
  let controlsWired = false;

  function el(id) {
    if (typeof document === 'undefined') return null;
    return document.getElementById(id);
  }

  function formatPasteWatermark(count) {
    const n = Math.max(1, Number(count) || 1);
    return ` [Copied without shame — Ctrl+V #${n}]`;
  }

  function formatCopySignature(telemetry = {}) {
    const errors = Math.max(0, Number(telemetry.errors) || 0);
    const backspaces = Math.max(0, Number(telemetry.backspaces) || 0);
    return `\n\n— Written under protest in YapPad (${errors} sin${errors === 1 ? '' : 's'}, ${backspaces} backspace${backspaces === 1 ? '' : 's'})`;
  }

  function isShoutingText(text) {
    return /\b[A-Z]{4,}\s+[A-Z]{4,}\b/.test(String(text || ''));
  }

  function computeTonerOpacity(tonerVal) {
    const t = Math.max(CONFIG.TONER_MIN, Math.min(CONFIG.TONER_START, Number(tonerVal) || 0));
    if (t > CONFIG.TONER_WARN_THRESHOLD) return 1;
    const ratio = t / CONFIG.TONER_WARN_THRESHOLD;
    return Math.round((0.54 + ratio * 0.46) * 100) / 100;
  }

  function syncTonerUI() {
    const opacity = computeTonerOpacity(state.toner);
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.style.setProperty('--editor-ink-opacity', String(opacity));
    }
    const btn = el('btn-shake-toner');
    if (btn) {
      const low = state.toner <= CONFIG.TONER_WARN_THRESHOLD;
      btn.hidden = !low;
      if (low) {
        btn.textContent = `🖨️ Toner: ${Math.round(state.toner)}% — Shake`;
      }
    }
    return { toner: state.toner, opacity };
  }

  function consumeInk(chars = 1) {
    const App = root.YP.App;
    const escalation = App && App.state ? App.state.escalation : 0;
    const rate =
      escalation >= 2 ? CONFIG.TONER_ESCALATED_COST_PER_CHAR : CONFIG.TONER_COST_PER_CHAR;
    const amount = Math.max(0, Number(chars) || 0) * rate;
    state.toner = Math.max(CONFIG.TONER_MIN, Math.round((state.toner - amount) * 10) / 10);
    const ui = syncTonerUI();

    if (state.toner <= CONFIG.TONER_WARN_THRESHOLD && !state.tonerWarned) {
      state.tonerWarned = true;
      const line =
        'Running low on virtual toner. Click "🖨️ Toner — Shake" before your brilliance fades away.';
      if (App && typeof App.addCommentary === 'function') {
        App.addCommentary(line, { tag: '🖨️ Low Toner' });
      }
      if (App && typeof App.showToast === 'function') {
        App.showToast(line, 'warning');
      }
    }
    return ui;
  }

  function dropToner(level = 22) {
    const clamped = Math.max(CONFIG.TONER_MIN, Math.min(CONFIG.TONER_WARN_THRESHOLD, Number(level) || 22));
    state.toner = clamped;
    state.tonerWarned = true;
    const ui = syncTonerUI();
    const App = root.YP.App;
    const Audio = root.YP.Audio;
    if (Audio && typeof Audio.playDisappointmentDing === 'function') {
      Audio.playDisappointmentDing();
    }
    const line = `Virtual toner critically low (${Math.round(state.toner)}%). Shake the cartridge to keep reading your notes.`;
    if (App && typeof App.addCommentary === 'function') {
      App.addCommentary(line, { tag: '🖨️ Low Toner' });
    }
    if (App && typeof App.showToast === 'function') {
      App.showToast(line, 'warning');
    }
    return ui;
  }

  function shakeTonerCartridge() {
    const App = root.YP.App;
    const Audio = root.YP.Audio;
    state.toner = CONFIG.TONER_START;
    state.tonerWarned = false;
    const ui = syncTonerUI();

    if (Audio && typeof Audio.playCartridgeShake === 'function') {
      Audio.playCartridgeShake();
    }
    const frame = el('window-frame');
    if (frame) {
      frame.classList.remove('panic-shake');
      void frame.offsetWidth;
      frame.classList.add('panic-shake');
    }
    const line = 'Violently shook the virtual toner cartridge. Ink restored to 100% (for now).';
    if (App && typeof App.addCommentary === 'function') {
      App.addCommentary(line, { tag: '🖨️ Toner Refilled' });
    }
    if (App && typeof App.showToast === 'function') {
      App.showToast('🖨️ Toner shaken back to 100%!', 'success');
    }
    return ui;
  }

  function handlePaste(e) {
    const App = root.YP.App;
    const Audio = root.YP.Audio;
    const textarea = el('editor-textarea');
    if (!textarea || !e) return false;

    const clip = e.clipboardData || (typeof window !== 'undefined' ? window.clipboardData : null);
    const pasted = clip && typeof clip.getData === 'function' ? String(clip.getData('text') || '') : '';
    if (pasted.length < CONFIG.PASTE_MIN_CHARS) return false;

    e.preventDefault();
    if (App && typeof App.captureUndoSnapshot === 'function') {
      App.captureUndoSnapshot();
    }

    state.pasteCount += 1;
    const watermark = formatPasteWatermark(state.pasteCount);
    const inserted = pasted + watermark;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    textarea.value = before + inserted + after;

    const newPos = start + inserted.length;
    try {
      textarea.selectionStart = newPos;
      textarea.selectionEnd = newPos;
    } catch {
      // Ignore selection errors in non-interactive environments
    }

    if (Audio && typeof Audio.playPlagiarismAlarm === 'function') {
      Audio.playPlagiarismAlarm();
    }
    if (App && typeof App.syncAfterTextMutation === 'function') {
      App.syncAfterTextMutation(false);
    }

    const line = `Oh, copy-pasting ${pasted.length} characters? Bold move. I tagged it for academic honesty (Ctrl+Z to undo).`;
    if (App && typeof App.addCommentary === 'function') {
      App.addCommentary(line, { tag: '🚨 Plagiarism Police' });
    }
    if (App && typeof App.showToast === 'function') {
      App.showToast(`🚨 Plagiarism alert! Ctrl+V #${state.pasteCount} watermarked.`, 'warning');
    }
    return true;
  }

  function handleCopy(e) {
    const App = root.YP.App;
    const Audio = root.YP.Audio;
    const textarea = el('editor-textarea');
    if (!textarea || !e || !e.clipboardData || typeof e.clipboardData.setData !== 'function') {
      return false;
    }
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    if (end <= start) return false;

    const selected = textarea.value.slice(start, end);
    if (!selected) return false;

    state.copyCount += 1;
    const telemetry = App && typeof App.getTelemetry === 'function' ? App.getTelemetry() : {};
    const signed = selected + formatCopySignature(telemetry);
    e.preventDefault();
    e.clipboardData.setData('text/plain', signed);

    if (Audio && typeof Audio.playGuiltPop === 'function') {
      Audio.playGuiltPop();
    }
    const line = 'Taking my best work to another app? Cute. I appended a YapPad signature to your clipboard.';
    if (App && typeof App.addCommentary === 'function') {
      App.addCommentary(line, { tag: '📋 Clipboard Tax' });
    }
    if (App && typeof App.showToast === 'function') {
      App.showToast('📋 Clipboard signed with a YapPad watermark.', 'snark');
    }
    return true;
  }

  function handleForbiddenShortcut(e) {
    if (!e || !(e.ctrlKey || e.metaKey) || e.altKey) return false;
    const key = String(e.key || '').toLowerCase();
    const pool = FORBIDDEN_SHORTCUT_LINES[key];
    if (!pool) return false;

    e.preventDefault();
    const line = pool[state.shortcutCount % pool.length];
    state.shortcutCount += 1;

    const App = root.YP.App;
    const Audio = root.YP.Audio;
    if (Audio && typeof Audio.playFakeErrorBonk === 'function') {
      Audio.playFakeErrorBonk();
    }
    if (App && typeof App.addCommentary === 'function') {
      App.addCommentary(line, { tag: `🚫 Ctrl+${key.toUpperCase()} Denied` });
    }
    if (App && typeof App.showToast === 'function') {
      App.showToast(line, 'warning');
    }
    return true;
  }

  function handleTabKey(e) {
    if (!e || e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return false;
    const textarea = el('editor-textarea');
    if (!textarea) return false;

    e.preventDefault();
    const App = root.YP.App;
    const Audio = root.YP.Audio;
    if (App && typeof App.captureUndoSnapshot === 'function') {
      App.captureUndoSnapshot();
    }

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    textarea.value =
      textarea.value.slice(0, start) + CONFIG.TAB_SPACES + textarea.value.slice(end);
    const pos = start + CONFIG.TAB_SPACES.length;
    try {
      textarea.selectionStart = pos;
      textarea.selectionEnd = pos;
    } catch {
      // Ignore selection errors
    }

    state.tabCount += 1;
    if (App && typeof App.syncAfterTextMutation === 'function') {
      App.syncAfterTextMutation(false);
    }
    if (Audio && typeof Audio.playGuiltPop === 'function') {
      Audio.playGuiltPop();
    }

    const now = Date.now();
    if (now - state.lastTabNoteAt >= CONFIG.TAB_NOTE_COOLDOWN_MS) {
      state.lastTabNoteAt = now;
      const line = 'Tabs vs. spaces? I chose 3 uneven spaces. Good luck aligning that.';
      if (App && typeof App.addCommentary === 'function') {
        App.addCommentary(line, { tag: '↹ 3-Space Chaos' });
      }
      if (App && typeof App.showToast === 'function') {
        App.showToast('Inserted 3 uneven spaces. You are welcome.', 'snark');
      }
    }
    return true;
  }

  function handleEnterKey(e) {
    if (!e || e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
    const textarea = el('editor-textarea');
    if (!textarea) return false;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const before = textarea.value.slice(0, start);
    const lineStart = before.lastIndexOf('\n') + 1;
    const currentLine = before.slice(lineStart);
    const bulletMatch = currentLine.match(/^(\s*)(?:[-*•]|\d+[.)])\s+\S/);
    if (!bulletMatch) return false;

    state.bulletCount += 1;
    if (state.bulletCount % CONFIG.BULLET_SABOTAGE_EVERY !== 0) return false;

    e.preventDefault();
    const App = root.YP.App;
    const Audio = root.YP.Audio;
    if (App && typeof App.captureUndoSnapshot === 'function') {
      App.captureUndoSnapshot();
    }

    const indent = bulletMatch[1] || '';
    const snarkBullet =
      BULLET_SNARKS[Math.floor(state.bulletCount / CONFIG.BULLET_SABOTAGE_EVERY - 1) % BULLET_SNARKS.length];
    const insertion = `\n${indent}${snarkBullet} `;
    textarea.value = before + insertion + textarea.value.slice(end);
    const pos = start + insertion.length;
    try {
      textarea.selectionStart = pos;
      textarea.selectionEnd = pos;
    } catch {
      // Ignore selection errors
    }

    if (App && typeof App.syncAfterTextMutation === 'function') {
      App.syncAfterTextMutation(false);
    }
    if (Audio && typeof Audio.playTypewriterDing === 'function') {
      Audio.playTypewriterDing();
    }
    const line = 'I improved your bullet list formatting! Press Ctrl+Z if you hate joy.';
    if (App && typeof App.addCommentary === 'function') {
      App.addCommentary(line, { tag: '📎 Evil Formatter' });
    }
    return true;
  }

  function checkShouting(text, nowOverride) {
    if (!isShoutingText(text)) return false;
    const now = typeof nowOverride === 'number' ? nowOverride : Date.now();
    if (now - state.lastShoutAt < CONFIG.SHOUTING_COOLDOWN_MS) return false;

    state.lastShoutAt = now;
    state.yellingTilt = true;
    const stage = el('editor-stage');
    if (stage) {
      stage.classList.add('is-yelling-tilt');
    }
    if (tiltTimer) clearTimeout(tiltTimer);
    tiltTimer = setTimeout(() => {
      tiltTimer = null;
      if (state.fontCrime === 'none') {
        state.yellingTilt = false;
        const st = el('editor-stage');
        if (st) st.classList.remove('is-yelling-tilt');
      }
    }, CONFIG.SHOUTING_TILT_MS);

    const App = root.YP.App;
    const Audio = root.YP.Audio;
    if (Audio && typeof Audio.playAngryBuzz === 'function') {
      Audio.playAngryBuzz();
    }
    const line = 'STOP YELLING AT ME. My buffer has sensitive ears — now your paper is crooked.';
    if (App && typeof App.addCommentary === 'function') {
      App.addCommentary(line, { tag: '📢 Volume Police' });
    }
    if (App && typeof App.showToast === 'function') {
      App.showToast('📢 CAPS LOCK detected! Crooked page penalty active.', 'danger');
    }
    return true;
  }

  function escalateFilename(manual = false) {
    const App = root.YP.App;
    const current = App && App.state ? App.state.filename : CONFIG.FILENAMES[0];
    if (!manual && !CONFIG.FILENAMES.includes(current)) {
      return current;
    }
    state.filenameStep = (state.filenameStep + 1) % CONFIG.FILENAMES.length;
    if (state.filenameStep === 0) state.filenameStep = 1;
    const nextName = CONFIG.FILENAMES[state.filenameStep];
    if (App && typeof App.setFilename === 'function') {
      App.setFilename(nextName);
    }
    const line = `Renamed your draft to "${nextName}" to better reflect your current trajectory.`;
    if (App && typeof App.addCommentary === 'function') {
      App.addCommentary(line, { tag: '🏷️ Filename Drift' });
    }
    if (App && typeof App.showToast === 'function') {
      App.showToast(`🏷️ Renamed to ${nextName}`, 'info');
    }
    return nextName;
  }

  function summonYappy(customLine) {
    if (yappyComebackTimer) {
      clearTimeout(yappyComebackTimer);
      yappyComebackTimer = null;
    }
    state.yappyVisible = true;
    const card = el('yappy-assistant');
    const msgEl = el('yappy-message');
    const line =
      typeof customLine === 'string' && customLine.trim()
        ? customLine
        : YAPPY_LINES[state.yappyLineIdx % YAPPY_LINES.length];
    state.yappyLineIdx += 1;

    if (msgEl) msgEl.textContent = line;
    if (card) {
      card.hidden = false;
      const scale = Math.max(0.84, 1 - Math.min(2, state.yappyDismissCount) * 0.06);
      card.style.transform = `scale(${scale})`;
    }
    const Audio = root.YP.Audio;
    if (Audio && typeof Audio.playRoastPop === 'function') {
      Audio.playRoastPop();
    }
    return line;
  }

  function dismissYappy(silent = false) {
    const wasVisible = state.yappyVisible;
    state.yappyVisible = false;
    const card = el('yappy-assistant');
    if (card) card.hidden = true;
    if (yappyComebackTimer) {
      clearTimeout(yappyComebackTimer);
      yappyComebackTimer = null;
    }

    if (!silent && wasVisible) {
      state.yappyDismissCount += 1;
      const App = root.YP.App;
      const Audio = root.YP.Audio;
      if (Audio && typeof Audio.playCornerZip === 'function') {
        Audio.playCornerZip();
      }
      const line = 'Yappy: "Noted! I will definitely leave you alone... for 20 seconds."';
      if (App && typeof App.addCommentary === 'function') {
        App.addCommentary(line, { tag: '📎 Yappy' });
      }
      if (App && typeof App.showToast === 'function') {
        App.showToast('📎 Yappy will return in 20s.', 'info');
      }
      yappyComebackTimer = setTimeout(() => {
        yappyComebackTimer = null;
        const Modals = root.YP.Modals;
        const ab = el('abandoned-screen');
        const blocked = Boolean(
          (Modals && typeof Modals.isOpen === 'function' && Modals.isOpen()) ||
            (ab && !ab.hidden)
        );
        if (!blocked && !state.yappyVisible) {
          summonYappy("I'm back! You missed me, right? Let's ruin your flow again.");
        }
      }, CONFIG.YAPPY_COMEBACK_MS);
    }
  }

  function handleYappyAccept() {
    const actionIdx = state.yappyChaosIdx % 3;
    state.yappyChaosIdx += 1;
    const App = root.YP.App;
    const Ragebait = root.YP.Ragebait;
    if (actionIdx === 0) {
      applyTypographyChaos('comic');
    } else if (actionIdx === 1) {
      dropToner(24);
    } else if (Ragebait && typeof Ragebait.showCenterRagebait === 'function') {
      Ragebait.showCenterRagebait({
        token: 'Yappy "Help"',
        message: 'You literally clicked "Yes, Ruin My Focus." This is entirely on you.'
      });
    }
    if (App && typeof App.showToast === 'function') {
      App.showToast('📎 Yappy applied "helpful" productivity chaos!', 'snark');
    }
    dismissYappy(true);
  }

  function showTrialNag() {
    state.trialNagVisible = true;
    state.trialNagAutoShown = true;
    const bar = el('trial-nag-bar');
    if (bar) bar.hidden = false;
    const Audio = root.YP.Audio;
    if (Audio && typeof Audio.playDisappointmentDing === 'function') {
      Audio.playDisappointmentDing();
    }
    return true;
  }

  function dismissTrialNag(withDignity = true) {
    state.trialNagVisible = false;
    const bar = el('trial-nag-bar');
    if (bar) bar.hidden = true;
    if (withDignity) {
      const App = root.YP.App;
      const Audio = root.YP.Audio;
      if (Audio && typeof Audio.playSupportiveChime === 'function') {
        Audio.playSupportiveChime();
      }
      const line = 'Dignity accepted as payment. Vowels unlocked for 60 seconds.';
      if (App && typeof App.addCommentary === 'function') {
        App.addCommentary(line, { tag: '⚠️ Free Trial' });
      }
      if (App && typeof App.showToast === 'function') {
        App.showToast('⚠️ Dignity accepted. Vowels unlocked for 60s.', 'success');
      }
    }
  }

  function handleVisibilityChange(hiddenOverride, nowOverride) {
    const isHidden =
      typeof hiddenOverride === 'boolean'
        ? hiddenOverride
        : typeof document !== 'undefined'
        ? Boolean(document.hidden)
        : false;
    const now = typeof nowOverride === 'number' ? nowOverride : Date.now();

    if (isHidden) {
      state.hiddenSince = now;
      return { status: 'hidden' };
    }

    const awayMs = state.hiddenSince !== null ? now - state.hiddenSince : 0;
    state.hiddenSince = null;
    if (awayMs < CONFIG.TAB_AWAY_MS) {
      return { status: 'returned-brief', awayMs };
    }

    const line = TAB_JEALOUSY_LINES[state.tabJealousyIdx % TAB_JEALOUSY_LINES.length];
    state.tabJealousyIdx += 1;
    const App = root.YP.App;
    const Audio = root.YP.Audio;
    if (Audio && typeof Audio.playDisappointmentDing === 'function') {
      Audio.playDisappointmentDing();
    }
    if (App && typeof App.addCommentary === 'function') {
      App.addCommentary(line, { tag: '👀 Tab Jealousy' });
    }
    if (App && typeof App.showToast === 'function') {
      App.showToast(line, 'snark');
    }
    return { status: 'jealous', awayMs, line };
  }

  function nudgeScroll(force = false, nowOverride) {
    const textarea = el('editor-textarea');
    if (!textarea) return false;
    const overflow = textarea.scrollHeight - textarea.clientHeight;
    if (overflow <= 60) return false;

    const now = typeof nowOverride === 'number' ? nowOverride : Date.now();
    if (!force && now - state.lastScrollDriftAt < CONFIG.SCROLL_DRIFT_COOLDOWN_MS) {
      return false;
    }

    state.lastScrollDriftAt = now;
    const delta = CONFIG.SCROLL_DRIFT_PX * state.scrollDriftDir;
    state.scrollDriftDir *= -1;
    const nextTop = Math.max(0, Math.min(overflow, textarea.scrollTop + delta));
    if (nextTop === textarea.scrollTop) return false;

    textarea.scrollTop = nextTop;
    const App = root.YP.App;
    const Audio = root.YP.Audio;
    if (App && typeof App.syncBackdropAndGutter === 'function') {
      App.syncBackdropAndGutter();
    }
    if (Audio && typeof Audio.playShrinkSqueak === 'function') {
      Audio.playShrinkSqueak();
    }
    if (App && typeof App.showToast === 'function') {
      App.showToast('🌀 Lost your place? Try reading faster.', 'info');
    }
    return true;
  }

  function scheduleScrollDrift() {
    if (scrollDriftTimer) clearTimeout(scrollDriftTimer);
    scrollDriftTimer = setTimeout(() => {
      scrollDriftTimer = null;
      nudgeScroll(false);
    }, CONFIG.SCROLL_DRIFT_DEBOUNCE_MS);
  }

  function applyTypographyChaos(mode = 'comic') {
    state.fontCrime = mode === 'none' ? 'none' : 'comic';
    if (typeof document !== 'undefined' && document.body) {
      if (state.fontCrime === 'none') {
        document.body.removeAttribute('data-font-crime');
      } else {
        document.body.setAttribute('data-font-crime', state.fontCrime);
      }
    }
    const stage = el('editor-stage');
    if (stage) {
      stage.classList.toggle('is-yelling-tilt', state.fontCrime !== 'none');
    }
    state.yellingTilt = state.fontCrime !== 'none';

    if (state.fontCrime !== 'none') {
      const App = root.YP.App;
      const Audio = root.YP.Audio;
      if (Audio && typeof Audio.playRageBuzzer === 'function') {
        Audio.playRageBuzzer();
      }
      const line = 'Typography punishment enabled: Comic Sans + crooked paper. Use "Restore Sanity" to beg for monospace.';
      if (App && typeof App.addCommentary === 'function') {
        App.addCommentary(line, { tag: '🔠 Font Crime' });
      }
      if (App && typeof App.showToast === 'function') {
        App.showToast('🔠 Comic Sans + crooked paper activated!', 'danger');
      }
    }
    return state.fontCrime;
  }

  function onEscalationChanged(stageNum) {
    if (stageNum >= 2 && !state.trialNagAutoShown) {
      showTrialNag();
    }
    if (stageNum >= 3 && state.filenameStep === 0) {
      escalateFilename(false);
    }
  }

  function unleashMaximumAnnoyance() {
    dropToner(22);
    showTrialNag();
    applyTypographyChaos('comic');
    escalateFilename(true);
    summonYappy('Hi! It looks like you wanted MAXIMUM note-taking chaos. Mission accomplished!');
    const Ragebait = root.YP.Ragebait;
    if (Ragebait && typeof Ragebait.showCenterRagebait === 'function') {
      Ragebait.showCenterRagebait({
        token: 'Peaceful Note-Taking',
        message: 'Maximum Annoyance Mode is live. Try catching this popup, shaking your toner, and paying with dignity.'
      });
    }
  }

  function restoreSanity() {
    if (tiltTimer) {
      clearTimeout(tiltTimer);
      tiltTimer = null;
    }
    if (yappyComebackTimer) {
      clearTimeout(yappyComebackTimer);
      yappyComebackTimer = null;
    }
    if (scrollDriftTimer) {
      clearTimeout(scrollDriftTimer);
      scrollDriftTimer = null;
    }

    state.toner = CONFIG.TONER_START;
    state.tonerWarned = false;
    state.fontCrime = 'none';
    state.yellingTilt = false;
    syncTonerUI();

    if (typeof document !== 'undefined' && document.body) {
      document.body.removeAttribute('data-font-crime');
    }
    const stage = el('editor-stage');
    if (stage) stage.classList.remove('is-yelling-tilt');
    const autoBtn = el('btn-autocorrect');
    if (autoBtn) autoBtn.style.transform = '';

    dismissYappy(true);
    dismissTrialNag(false);

    const Ragebait = root.YP.Ragebait;
    if (Ragebait && typeof Ragebait.clearAll === 'function') {
      Ragebait.clearAll();
    }
    const App = root.YP.App;
    if (App && typeof App.restoreNormalFont === 'function' && App.state && App.state.fontSizePx < 15.5) {
      App.restoreNormalFont();
    }
    if (App && typeof App.addCommentary === 'function') {
      App.addCommentary('Fine. Temporary truce granted. Enjoy your boring, peaceful notepad.', {
        tag: '🕊️ Truce'
      });
    }
    if (App && typeof App.showToast === 'function') {
      App.showToast('🕊️ Sanity restored (temporarily).', 'success');
    }
  }

  function wireControls() {
    if (controlsWired || typeof document === 'undefined') return;
    controlsWired = true;

    const tonerBtn = el('btn-shake-toner');
    if (tonerBtn) {
      tonerBtn.addEventListener('click', shakeTonerCartridge);
    }

    const trialBtn = el('btn-trial-dignity');
    if (trialBtn) {
      trialBtn.addEventListener('click', () => dismissTrialNag(true));
    }

    const yappyYes = el('yappy-btn-yes');
    if (yappyYes) {
      yappyYes.addEventListener('click', handleYappyAccept);
    }

    const yappyNo = el('yappy-btn-no');
    if (yappyNo) {
      yappyNo.addEventListener('click', () => dismissYappy(false));
    }

    const yappyClose = el('yappy-close-x');
    if (yappyClose) {
      yappyClose.addEventListener('click', () => dismissYappy(false));
    }

    const docName = el('doc-filename');
    if (docName) {
      docName.addEventListener('click', () => escalateFilename(true));
    }

    document.addEventListener('visibilitychange', () => {
      handleVisibilityChange();
    });
  }

  function init() {
    syncTonerUI();
    wireControls();
  }

  root.YP.Annoyances = {
    CONFIG,
    FORBIDDEN_SHORTCUT_LINES,
    state,
    init,
    formatPasteWatermark,
    formatCopySignature,
    isShoutingText,
    computeTonerOpacity,
    syncTonerUI,
    consumeInk,
    dropToner,
    shakeTonerCartridge,
    handlePaste,
    handleCopy,
    handleForbiddenShortcut,
    handleTabKey,
    handleEnterKey,
    checkShouting,
    escalateFilename,
    summonYappy,
    dismissYappy,
    handleYappyAccept,
    showTrialNag,
    dismissTrialNag,
    handleVisibilityChange,
    scheduleScrollDrift,
    nudgeScroll,
    applyTypographyChaos,
    onEscalationChanged,
    unleashMaximumAnnoyance,
    restoreSanity
  };
})();
