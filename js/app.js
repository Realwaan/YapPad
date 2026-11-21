(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.YP = root.YP || {};
  root.SN = root.YP;

  const SAMPLE_ROASTABLE_TEXT =
    'Today i am building teh ultimate notpad for our hackathon pitch. ' +
    'We could of used a boring editor, it is definately going to judge every single word we type in real time. ' +
    'Honestly this demo is sooo good that the the judges will remember it forever.';

  const state = {
    filename: 'untitled_regret.txt',
    dirty: false,
    mood: 'passive-aggressive',
    escalation: 0,
    wpm: 0,
    wpmHistory: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    keyTimestamps: [],
    backspaces: 0,
    errors: 0,
    words: 0,
    lastRoastWordMilestone: 0,
    roastInFlight: false,
    lastKeyAt: Date.now(),
    slowSince: null,
    fastSince: null,
    lastSlowSighAt: 0,
    lastFastPanicAt: 0,
    idle5Fired: false,
    idle15Fired: false,
    ghostTimer: null,
    supportiveRevertTimer: null,
    moodTimer: null,
    telemetryTimer: null,
    seenIssueKeys: new Set(),
    seenIssueStarts: new Set(),
    undoSnapshot: null,
    closeCount: 0,
    remembersClose: false,
    currentIssues: [],
    fontSizePx: 15.5,
    autocorrectFlip: 1
  };

  function el(id) {
    if (typeof document === 'undefined') return null;
    return document.getElementById(id);
  }

  function loadGrudgeState() {
    try {
      if (typeof localStorage !== 'undefined') {
        const rem =
          localStorage.getItem('yp_remembers_close') === 'true' ||
          localStorage.getItem('sn_remembers_close') === 'true';
        const cnt = Number(
          localStorage.getItem('yp_close_count') || localStorage.getItem('sn_close_count') || 0
        );
        state.remembersClose = rem;
        state.closeCount = rem ? Math.max(1, Number.isFinite(cnt) ? cnt : 1) : 0;
      }
    } catch {
      // Ignore storage errors
    }
  }

  function resetGrudgeMemory() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('yp_remembers_close');
        localStorage.removeItem('sn_remembers_close');
        localStorage.removeItem('yp_close_count');
        localStorage.removeItem('sn_close_count');
      }
    } catch {
      // Ignore storage errors
    }
    state.remembersClose = false;
    state.closeCount = 0;
    updateEscalation();
    setStatusMessage('Oh. You again. (Grudge memory wiped back to Stage 0.)');
    showToast('Grudge memory reset to Stage 0.', 'neutral');
  }

  function setStatusMessage(msg) {
    const statusEl = el('status-message');
    if (statusEl) statusEl.textContent = msg;
  }

  function showToast(text, tone = 'neutral') {
    const stack = el('toast-stack');
    if (!stack) return;
    while (stack.children.length >= 4) {
      stack.firstElementChild.remove();
    }
    const item = document.createElement('div');
    item.className = `toast-item toast-${tone}`;
    item.textContent = text;
    stack.appendChild(item);
    setTimeout(() => {
      if (item.parentNode) item.remove();
    }, 3900);
  }

  function addCommentary(text, meta = {}) {
    const list = el('commentary-list');
    const countEl = el('commentary-count');
    const Moods = root.YP.Moods;
    const moodInfo = (Moods && Moods.MOODS[state.mood]) || { emoji: '😒', name: 'Passive-Aggressive' };

    setStatusMessage(text);
    if (!list) return;

    const card = document.createElement('article');
    card.className = 'commentary-card';

    const tag = meta.tag || moodInfo.name;
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);

    const Grammar = root.YP.Grammar;
    const esc = Grammar ? Grammar.escapeHTML : (s) => String(s);

    card.innerHTML = `
      <div class="commentary-meta">
        <span class="commentary-tag">${esc(moodInfo.emoji)} ${esc(tag)}</span>
        <span>${esc(timeStr)}</span>
      </div>
      <div class="commentary-text">${esc(text)}</div>
    `;

    list.prepend(card);
    while (list.children.length > 30) {
      list.lastElementChild.remove();
    }
    if (countEl) countEl.textContent = String(list.children.length);
  }

  function applyFontShrinkPunishment(errorCount) {
    let size = 15.5;
    if (errorCount >= 6) size = 11;
    else if (errorCount === 5) size = 12;
    else if (errorCount === 4) size = 13;
    else if (errorCount === 3) size = 14;

    state.fontSizePx = size;
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
    }

    const readout = el('font-size-readout');
    if (readout) readout.textContent = `Font: ${size}px`;

    const begBtn = el('btn-restore-font');
    if (begBtn) {
      begBtn.hidden = errorCount < 3 || size >= 15.5;
    }
    return size;
  }

  function restoreNormalFont() {
    state.fontSizePx = 15.5;
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--editor-font-size', '15.5px');
    }
    const readout = el('font-size-readout');
    if (readout) readout.textContent = 'Font: 15.5px';
    const begBtn = el('btn-restore-font');
    if (begBtn) begBtn.hidden = true;

    const Moods = root.YP.Moods;
    const line = Moods
      ? Moods.getLine(state.mood, 'restoreFont')
      : 'Fine. Here is your 15.5px font back. Try not to embarrass it.';
    addCommentary(line, { tag: 'Font Mercy' });
    showToast(line);
  }

  function updateWeatherLayer() {
    const layer = el('weather-layer');
    if (!layer) return;
    layer.innerHTML = '';

    if (state.mood === 'sad') {
      for (let i = 0; i < 22; i++) {
        const drop = document.createElement('div');
        drop.className = 'rain-drop';
        drop.style.left = `${(i * 4.5 + (i % 3) * 2) % 98}%`;
        drop.style.animationDuration = `${0.9 + (i % 5) * 0.18}s`;
        drop.style.animationDelay = `${(i % 7) * 0.15}s`;
        layer.appendChild(drop);
      }
    } else if (state.mood === 'supportive') {
      for (let i = 0; i < 14; i++) {
        const sp = document.createElement('div');
        sp.className = 'sparkle-dot';
        sp.style.left = `${8 + (i * 6.5) % 86}%`;
        sp.style.top = `${14 + (i * 17) % 72}%`;
        sp.style.animationDelay = `${(i % 6) * 0.3}s`;
        layer.appendChild(sp);
      }
    }
  }

  function updateFaceExpression() {
    const Moods = root.YP.Moods;
    if (!Moods) return;
    const face = Moods.getFaceState(state.mood, state.escalation);
    const browL = el('brow-left');
    const browR = el('brow-right');
    const mouth = el('face-mouth');
    const pupilL = el('pupil-left');
    const pupilR = el('pupil-right');

    if (browL && face.browLeft) {
      browL.setAttribute('x1', face.browLeft.x1);
      browL.setAttribute('y1', face.browLeft.y1);
      browL.setAttribute('x2', face.browLeft.x2);
      browL.setAttribute('y2', face.browLeft.y2);
    }
    if (browR && face.browRight) {
      browR.setAttribute('x1', face.browRight.x1);
      browR.setAttribute('y1', face.browRight.y1);
      browR.setAttribute('x2', face.browRight.x2);
      browR.setAttribute('y2', face.browRight.y2);
    }
    if (mouth && face.mouth) {
      mouth.setAttribute('d', face.mouth);
    }
    if (pupilL && face.pupilRadius) pupilL.setAttribute('r', face.pupilRadius);
    if (pupilR && face.pupilRadius) pupilR.setAttribute('r', face.pupilRadius);
  }

  function updateEscalation() {
    const Moods = root.YP.Moods;
    if (!Moods) return;
    const stageObj = Moods.computeEscalationStage({
      errors: state.errors,
      backspaces: state.backspaces,
      closeCount: state.closeCount
    });
    state.escalation = stageObj.stage;
    if (typeof document !== 'undefined' && document.body) {
      document.body.setAttribute('data-escalation', String(state.escalation));
    }
    const escEl = el('stat-escalation');
    if (escEl) escEl.textContent = `${state.escalation}/4`;
    updateFaceExpression();
  }

  function setMood(nextMood, announce = true) {
    const Moods = root.YP.Moods;
    const Audio = root.YP.Audio;
    if (!Moods || !Moods.MOODS[nextMood]) return;

    if (state.supportiveRevertTimer) {
      clearTimeout(state.supportiveRevertTimer);
      state.supportiveRevertTimer = null;
    }

    state.mood = nextMood;
    const info = Moods.MOODS[nextMood];

    if (typeof document !== 'undefined' && document.body) {
      document.body.setAttribute('data-mood', nextMood);
    }
    const moodStat = el('stat-mood');
    if (moodStat) moodStat.textContent = info.label;

    updateWeatherLayer();
    updateFaceExpression();

    if (nextMood === 'supportive') {
      if (Audio) Audio.playSupportiveChime();
      state.supportiveRevertTimer = setTimeout(() => {
        setMood('passive-aggressive', false);
        addCommentary('Supportive mode expired (10s limit reached). Back to judging your life choices.', {
          tag: 'Mood Shift'
        });
      }, (info.durationSec || 10) * 1000);
    } else if (nextMood === 'angry' && Audio) {
      Audio.playAngryBuzz();
    }

    if (announce) {
      const line = Moods.getLine(nextMood, 'greeting');
      addCommentary(`Mood shifted to ${info.label}: ${line}`, { tag: 'Mood Shift' });
    }
  }

  function triggerAngryWordScramble() {
    const textarea = el('editor-textarea');
    const Audio = root.YP.Audio;
    const Moods = root.YP.Moods;
    if (!textarea) return false;

    const text = textarea.value;
    const matches = [...text.matchAll(/\b([a-zA-Z]{4,})\b/g)];
    if (matches.length === 0) {
      addCommentary('I wanted to scramble one of your words in anger, but you haven\'t even typed a 4-letter word yet!', {
        tag: '😡 Angry Scrambler'
      });
      return false;
    }

    state.undoSnapshot = text;
    const target = matches[matches.length - 1];
    const word = target[0];
    const start = target.index;
    const chars = word.split('');
    // Deterministic visible scramble
    const scrambled =
      chars[0] +
      chars
        .slice(1, -1)
        .reverse()
        .join('') +
      chars[chars.length - 1];
    const finalWord = scrambled === word ? word.split('').reverse().join('') : scrambled;

    textarea.value = text.slice(0, start) + finalWord + text.slice(start + word.length);
    if (Audio) Audio.playAngryBuzz();

    runGrammarCheck(false);
    updateLineNumbersAndCounts();

    const apology = Moods
      ? Moods.getLine('angry', 'scrambleApology')
      : 'Ugh. I got mad and scrambled a word. Hit Ctrl+Z.';
    addCommentary(`Scrambled "${word}" → "${finalWord}". ${apology}`, { tag: '😡 Word Scrambler' });
    showToast(`😡 Scrambled "${word}" → "${finalWord}"! (Ctrl+Z to undo)`);
    return true;
  }

  function stopGhostwriting() {
    if (state.ghostTimer) {
      clearInterval(state.ghostTimer);
      state.ghostTimer = null;
    }
  }

  function startGhostwriting() {
    const textarea = el('editor-textarea');
    const Moods = root.YP.Moods;
    if (!textarea || state.ghostTimer) return;

    state.undoSnapshot = textarea.value;
    const script = Moods
      ? Moods.getGhostScript(state.mood)
      : ' [YapPad note: The human abandoned the keyboard for 15 seconds, so I am writing this myself.]';

    const line = Moods
      ? Moods.getLine(state.mood, 'idle15')
      : 'Fine. Since you walked away for 15 seconds, I\'ll write it myself.';
    addCommentary(line, { tag: '👻 Ghostwriter' });

    let idx = 0;
    state.ghostTimer = setInterval(() => {
      if (idx >= script.length) {
        stopGhostwriting();
        return;
      }
      textarea.value += script[idx];
      idx += 1;
      syncBackdropAndGutter();
      updateLineNumbersAndCounts();
    }, 38);
  }

  function syncBackdropAndGutter() {
    const textarea = el('editor-textarea');
    const backdrop = el('editor-backdrop');
    const gutter = el('line-numbers');
    if (!textarea || !backdrop) return;

    backdrop.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
    if (gutter) gutter.scrollTop = textarea.scrollTop;
  }

  function updateLineNumbersAndCounts() {
    const textarea = el('editor-textarea');
    const gutter = el('line-numbers');
    if (!textarea) return;

    const text = textarea.value;
    const lines = text.split('\n');
    if (gutter) {
      let nums = '';
      for (let i = 1; i <= lines.length; i++) {
        nums += i + (i < lines.length ? '\n' : '');
      }
      gutter.textContent = nums;
    }

    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    state.words = words;
    const wordsEl = el('stat-words');
    if (wordsEl) wordsEl.textContent = String(words);

    // Cursor row/col
    const pos = textarea.selectionStart || 0;
    const before = text.slice(0, pos);
    const beforeLines = before.split('\n');
    const row = beforeLines.length;
    const col = beforeLines[beforeLines.length - 1].length + 1;
    const cursorEl = el('cursor-pos');
    if (cursorEl) cursorEl.textContent = `Ln ${row}, Col ${col}`;

    // Check ~30-word AI roast milestone
    if (words >= state.lastRoastWordMilestone + 30) {
      state.lastRoastWordMilestone = Math.floor(words / 30) * 30;
      triggerAIRoast(false);
    }
  }

  function runGrammarCheck(triggerRagebait = true) {
    const textarea = el('editor-textarea');
    const backdrop = el('editor-backdrop');
    const Grammar = root.YP.Grammar;
    const Ragebait = root.YP.Ragebait;
    const Moods = root.YP.Moods;
    const Audio = root.YP.Audio;
    if (!textarea || !Grammar) return [];

    const text = textarea.value;
    const cursorPos = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : text.length;
    const issues = Grammar.analyze(text, { cursorPos, instant: true });
    state.currentIssues = issues;
    state.errors = issues.length;

    const errEl = el('stat-errors');
    if (errEl) errEl.textContent = String(issues.length);

    if (backdrop) {
      backdrop.innerHTML = Grammar.renderBackdropHTML(text, issues);
      syncBackdropAndGutter();
    }

    applyFontShrinkPunishment(issues.length);
    updateEscalation();

    // Prune resolved issue fingerprints/starts so corrected mistakes re-arm if typed again
    const activeKeys = new Set(issues.map((i) => i.fingerprint));
    const activeStarts = new Set(issues.map((i) => `${i.rule}@${i.start}`));

    for (const k of [...state.seenIssueKeys]) {
      if (!activeKeys.has(k)) state.seenIssueKeys.delete(k);
    }
    for (const s of [...state.seenIssueStarts]) {
      if (!activeStarts.has(s)) state.seenIssueStarts.delete(s);
    }

    // Fire on newly detected spans (extending "sooo" -> "soooo" keeps the same rule@start so it does not re-spam)
    for (const issue of issues) {
      const startKey = `${issue.rule}@${issue.start}`;
      if (!state.seenIssueStarts.has(startKey)) {
        state.seenIssueStarts.add(startKey);
        state.seenIssueKeys.add(issue.fingerprint);

        if (triggerRagebait) {
          if (Audio) Audio.playDisappointmentDing();
          const moodLine =
            state.mood === 'intellectual' && Moods
              ? `${issue.message} ${Moods.makeFakeCitation(issue.token)}`
              : issue.message;
          addCommentary(moodLine, {
            tag: issue.type === 'grammar' ? 'Grammar Shamer' : 'Spelling Shamer'
          });
          if (Ragebait) Ragebait.onMistake(issue);
        }
      }
    }

    return issues;
  }

  async function triggerAIRoast(manual = false) {
    if (state.roastInFlight) return;
    const AI = root.YP.AI;
    const Audio = root.YP.Audio;
    const textarea = el('editor-textarea');
    if (!AI || !textarea) return;

    state.roastInFlight = true;
    try {
      const result = await AI.roast(textarea.value, state.mood, getTelemetry());
      if (Audio) Audio.playRoastPop();
      const tag =
        result.provider === 'gemini'
          ? '🧠 Gemini Roast'
          : result.provider === 'openai'
          ? '🧠 OpenAI Roast'
          : '🧠 AI Critic';
      addCommentary(result.text, { tag });
      if (manual) showToast(result.text);
    } finally {
      state.roastInFlight = false;
    }
  }

  function updateSparkline() {
    const poly = el('wpm-sparkline-line');
    if (!poly) return;
    const hist = state.wpmHistory;
    const max = Math.max(90, ...hist);
    const pts = hist
      .map((val, idx) => {
        const x = Math.round((idx / (hist.length - 1)) * 54);
        const y = Math.max(2, Math.min(14, Math.round(14 - (val / max) * 12)));
        return `${x},${y}`;
      })
      .join(' ');
    poly.setAttribute('points', pts);
  }

  function tickTelemetry() {
    const now = Date.now();
    const windowMs = 6500;
    state.keyTimestamps = state.keyTimestamps.filter((t) => now - t <= windowMs);

    const charsInWindow = state.keyTimestamps.length;
    const wpm = charsInWindow > 0 ? Math.round((charsInWindow / 5) * (60000 / windowMs)) : 0;
    state.wpm = wpm;
    state.wpmHistory.push(wpm);
    if (state.wpmHistory.length > 12) state.wpmHistory.shift();

    const wpmEl = el('stat-wpm');
    if (wpmEl) wpmEl.textContent = String(wpm);
    updateSparkline();

    const Moods = root.YP.Moods;
    const Audio = root.YP.Audio;
    const idleMs = now - state.lastKeyAt;

    // 1. Slow typing check (<22 WPM for 3.6s while actively typing, 12s cooldown)
    if (wpm > 0 && wpm < 22 && idleMs < 2500) {
      if (!state.slowSince) state.slowSince = now;
      if (now - state.slowSince >= 3600 && now - state.lastSlowSighAt >= 12000) {
        state.lastSlowSighAt = now;
        state.slowSince = now;
        if (Audio) Audio.playSigh();
        const line = Moods ? Moods.getLine(state.mood, 'slow') : '😴 Still waiting...';
        addCommentary(line, { tag: '🐢 Slow Typing' });
      }
    } else {
      state.slowSince = null;
    }

    // 2. Fast typing check (>=78 WPM for 1.5s, 10s cooldown)
    if (wpm >= 78) {
      if (!state.fastSince) state.fastSince = now;
      if (now - state.fastSince >= 1500 && now - state.lastFastPanicAt >= 10000) {
        state.lastFastPanicAt = now;
        state.fastSince = now;
        if (Audio) Audio.playPanicPip();
        const frame = el('window-frame');
        if (frame) {
          frame.classList.remove('panic-shake');
          void frame.offsetWidth;
          frame.classList.add('panic-shake');
        }
        const line = Moods ? Moods.getLine(state.mood, 'fast') : 'SLOW DOWN I CAN\'T KEEP UP!';
        addCommentary(line, { tag: '⚡ Speed Panic' });
      }
    } else {
      state.fastSince = null;
    }

    // 3. Idle 5s check (3.5s in Sad mood)
    const idle5Threshold = state.mood === 'sad' ? 3500 : 5000;
    if (idleMs >= idle5Threshold && !state.idle5Fired && !state.ghostTimer) {
      state.idle5Fired = true;
      const line = Moods
        ? Moods.getLine(state.mood, 'idle5')
        : 'Hello? Are you still there? I\'m lonely.';
      addCommentary(line, { tag: '🕰️ Idle Check' });
    }

    // 4. Idle 15s ghostwriting takeover
    if (idleMs >= 15000 && !state.idle15Fired && !state.ghostTimer) {
      state.idle15Fired = true;
      startGhostwriting();
    }
  }

  function insertRoastableSampleText() {
    const textarea = el('editor-textarea');
    const Ragebait = root.YP.Ragebait;
    if (!textarea) return;

    stopGhostwriting();
    state.undoSnapshot = textarea.value;
    state.seenIssueKeys.clear();
    state.seenIssueStarts.clear();

    textarea.value = SAMPLE_ROASTABLE_TEXT;
    state.dirty = true;
    state.lastKeyAt = Date.now();

    const issues = runGrammarCheck(false);
    updateLineNumbersAndCounts();

    // Force 6+ sins font-shrink punishment (11px + Beg button) if needed
    applyFontShrinkPunishment(Math.max(6, issues.length));
    if (Ragebait) Ragebait.unleashAll(issues);
    triggerAIRoast(true);
  }

  function getTelemetry() {
    return {
      wpm: state.wpm,
      backspaces: state.backspaces,
      errors: state.errors,
      words: state.words,
      mood: state.mood,
      escalation: state.escalation
    };
  }

  function updateAIBadge(cfgOverride) {
    const AI = root.YP.AI;
    const cfg = cfgOverride || (AI ? AI.getConfig() : { provider: 'offline' });
    const badge = el('ai-provider-badge');
    if (!badge) return;
    const label =
      cfg.provider === 'gemini'
        ? 'AI: Gemini 2.5'
        : cfg.provider === 'openai'
        ? 'AI: GPT-4o-mini'
        : 'AI: Offline Critic';
    badge.textContent = label;
  }

  function wireMenusAndControls() {
    if (typeof document === 'undefined') return;
    const groups = [...document.querySelectorAll('.menu-group')];

    groups.forEach((group) => {
      const btn = group.querySelector('.menu-trigger');
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = group.classList.contains('open');
        groups.forEach((g) => g.classList.remove('open'));
        if (!isOpen) group.classList.add('open');
      });
    });

    document.addEventListener('click', () => {
      groups.forEach((g) => g.classList.remove('open'));
    });

    document.querySelectorAll('.menu-item').forEach((item) => {
      item.addEventListener('click', () => {
        groups.forEach((g) => g.classList.remove('open'));
        handleAction(item.getAttribute('data-action'), item);
      });
    });

    // Audio toggle
    const audioBtn = el('btn-audio-toggle');
    if (audioBtn) {
      const syncAudioBtn = () => {
        const Audio = root.YP.Audio;
        const on = Audio ? Audio.getConfig().enabled : true;
        audioBtn.textContent = on ? '🔊 Audio: On' : '🔇 Audio: Muted';
        audioBtn.setAttribute('aria-pressed', on ? 'false' : 'true');
      };
      syncAudioBtn();
      audioBtn.addEventListener('click', () => {
        const Audio = root.YP.Audio;
        if (Audio) Audio.toggleMute();
        syncAudioBtn();
      });
    }

    // Quick scoreboard button
    const scoreBtn = el('btn-scoreboard-quick');
    if (scoreBtn) {
      scoreBtn.addEventListener('click', () => {
        if (root.YP.Modals) root.YP.Modals.openScoreboardModal();
      });
    }

    // Window close button
    const closeBtn = el('btn-window-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        handleAction('file-exit');
      });
    }

    // Restore font button
    const begBtn = el('btn-restore-font');
    if (begBtn) {
      begBtn.addEventListener('click', restoreNormalFont);
    }

    // Dodging Autocorrect button
    const autoBtn = el('btn-autocorrect');
    if (autoBtn) {
      const dodgeAutocorrect = (e) => {
        e.preventDefault();
        state.autocorrectFlip = state.autocorrectFlip === 1 ? -1 : 1;
        autoBtn.style.transform = `translate(${state.autocorrectFlip * -34}px, ${state.autocorrectFlip * 4}px)`;
        if (root.YP.Audio) root.YP.Audio.playCornerZip();
        addCommentary('I won\'t fix that. You need to learn.', { tag: '✨ Autocorrect Refused' });
      };
      autoBtn.addEventListener('mouseenter', dodgeAutocorrect);
      autoBtn.addEventListener('click', dodgeAutocorrect);
    }

    // Clear commentary button
    const clearNotesBtn = el('btn-clear-notes');
    if (clearNotesBtn) {
      clearNotesBtn.addEventListener('click', () => {
        const list = el('commentary-list');
        if (list) list.innerHTML = '';
        addCommentary('You cleared the margin notes, but you cannot clear your conscience.', {
          tag: 'Nice Try'
        });
      });
    }

    // Reopen from abandoned screen
    const reopenBtn = el('btn-reopen-app');
    if (reopenBtn) {
      reopenBtn.addEventListener('click', () => {
        const ab = el('abandoned-screen');
        if (ab) ab.hidden = true;
        const textarea = el('editor-textarea');
        if (textarea) textarea.focus();
        addCommentary(
          `Look who crawled back after closing me (${state.closeCount} betrayal${state.closeCount === 1 ? '' : 's'} on record).`,
          { tag: '👁️ I Remember' }
        );
      });
    }

    // File input for Open .txt
    const fileInput = el('file-input');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const textarea = el('editor-textarea');
          if (!textarea) return;
          state.filename = file.name;
          const docNameEl = el('doc-filename');
          if (docNameEl) docNameEl.textContent = file.name;
          textarea.value = String(reader.result || '');
          state.seenIssueKeys.clear();
          state.seenIssueStarts.clear();
          runGrammarCheck(true);
          updateLineNumbersAndCounts();
          addCommentary(`Opened "${file.name}". Let's see what disasters are hiding inside.`, {
            tag: '📂 File Opened'
          });
        };
        reader.readAsText(file);
      });
    }
  }

  function handleAction(action, itemEl) {
    const textarea = el('editor-textarea');
    const Modals = root.YP.Modals;
    const Ragebait = root.YP.Ragebait;

    switch (action) {
      case 'file-new':
        if (textarea) {
          state.undoSnapshot = textarea.value;
          textarea.value = '';
          state.seenIssueKeys.clear();
          state.seenIssueStarts.clear();
          runGrammarCheck(false);
          updateLineNumbersAndCounts();
          addCommentary('Starting a fresh blank page? Running away from your previous draft won\'t save you.', {
            tag: '📄 New Draft'
          });
        }
        break;
      case 'file-open': {
        const fi = el('file-input');
        if (fi) fi.click();
        break;
      }
      case 'file-save':
        if (Modals) {
          Modals.openSaveFlow(null, {
            filename: state.filename,
            getContent: () => (textarea ? textarea.value : '')
          });
        }
        break;
      case 'file-exit':
        if (Modals) {
          Modals.openExitFlow((closeCount) => {
            if (Ragebait) Ragebait.clearAll();
            state.remembersClose = true;
            state.closeCount = closeCount;
            updateEscalation();
            const sub = el('abandoned-subtext');
            if (sub) {
              sub.innerHTML =
                `I left <code>i_remember.txt</code> in your downloads so you don't forget what you did ` +
                `(${closeCount} betrayal${closeCount === 1 ? '' : 's'} logged).`;
            }
            const ab = el('abandoned-screen');
            if (ab) ab.hidden = false;
          });
        }
        break;
      case 'edit-undo':
        if (textarea && state.undoSnapshot !== null) {
          textarea.value = state.undoSnapshot;
          state.undoSnapshot = null;
          runGrammarCheck(false);
          updateLineNumbersAndCounts();
          addCommentary('Restored your pre-sabotage text via Undo. You\'re welcome.', { tag: '↩️ Undo' });
        }
        break;
      case 'edit-select-all':
        if (textarea) {
          textarea.focus();
          textarea.select();
        }
        break;
      case 'clear-ragebait':
        if (Ragebait) Ragebait.clearAll();
        break;
      case 'set-mood':
        if (itemEl) {
          setMood(itemEl.getAttribute('data-mood'), true);
        }
        break;
      case 'ai-roast-now':
        triggerAIRoast(true);
        break;
      case 'ai-settings':
        if (Modals) Modals.openAISettingsModal();
        break;
      case 'demo-sample':
        insertRoastableSampleText();
        break;
      case 'demo-scramble':
        setMood('angry', false);
        triggerAngryWordScramble();
        break;
      case 'demo-save-rate':
        if (Modals) {
          Modals.openSaveFlow('rate', {
            filename: state.filename,
            getContent: () => (textarea ? textarea.value : '')
          });
        }
        break;
      case 'demo-save-delay':
        if (Modals) {
          Modals.openSaveFlow('delay', {
            filename: state.filename,
            getContent: () => (textarea ? textarea.value : '')
          });
        }
        break;
      case 'demo-meltdown':
        if (Modals) Modals.openMeltdownModal();
        break;
      case 'demo-ghostwrite':
        startGhostwriting();
        break;
      case 'demo-reset-grudge':
        resetGrudgeMemory();
        break;
      case 'help-scoreboard':
        if (Modals) Modals.openScoreboardModal();
        break;
      case 'help-about':
        if (Modals) Modals.openAboutModal();
        break;
      default:
        break;
    }
  }

  function wireEditorEvents() {
    const textarea = el('editor-textarea');
    if (!textarea) return;

    textarea.addEventListener('scroll', syncBackdropAndGutter);
    textarea.addEventListener('click', () => {
      stopGhostwriting();
      updateLineNumbersAndCounts();
    });
    textarea.addEventListener('keyup', updateLineNumbersAndCounts);

    textarea.addEventListener('keydown', (e) => {
      stopGhostwriting();
      state.lastKeyAt = Date.now();
      state.idle5Fired = false;
      state.idle15Fired = false;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        const selStart = textarea.selectionStart || 0;
        const selEnd = textarea.selectionEnd || 0;
        const fullLen = textarea.value.length;

        // Mass delete check (entire non-empty document selected)
        if (fullLen >= 10 && selStart === 0 && selEnd === fullLen) {
          state.undoSnapshot = textarea.value;
          if (root.YP.Modals) {
            root.YP.Modals.openMeltdownModal();
          }
          addCommentary('...You selected everything. And deleted it. I need a moment.', {
            tag: '🗑️ Mass Delete'
          });
          return;
        }

        state.backspaces += 1;
        const bsEl = el('stat-backspaces');
        if (bsEl) bsEl.textContent = String(state.backspaces);
        updateEscalation();

        const Moods = root.YP.Moods;
        const Audio = root.YP.Audio;
        if (Audio) Audio.playGuiltPop();

        if (state.backspaces % 5 === 0) {
          const line = Moods
            ? Moods.getLine(state.mood, 'backspacePattern')
            : 'Deleting again? This is becoming a pattern.';
          addCommentary(line, { tag: `🗑️ Backspace #${state.backspaces}` });
          if (root.YP.Ragebait) {
            root.YP.Ragebait.showCenterRagebait({
              token: `Backspace ×${state.backspaces}`,
              message: line
            });
          }
        } else if (state.backspaces % 2 === 1) {
          const line = Moods
            ? Moods.getLine(state.mood, 'backspace')
            : 'Are you sure? You worked so hard on that.';
          addCommentary(line, { tag: '🗑️ Guilt Trip' });
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        state.keyTimestamps.push(Date.now());
      }
    });

    // Instant 0ms mid-typing grammar/spelling & ragebait check
    textarea.addEventListener('input', () => {
      state.dirty = true;
      state.lastKeyAt = Date.now();
      runGrammarCheck(true);
      updateLineNumbersAndCounts();
    });

    // Global keyboard shortcuts
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleAction('file-save');
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
          e.preventDefault();
          handleAction('ai-roast-now');
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
          e.preventDefault();
          handleAction('file-open');
        } else if (e.altKey && e.key.toLowerCase() === 'n') {
          e.preventDefault();
          handleAction('file-new');
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && state.undoSnapshot !== null) {
          e.preventDefault();
          handleAction('edit-undo');
        } else if (e.key === 'Escape') {
          if (root.YP.Ragebait) root.YP.Ragebait.clearAll();
        }
      });

      // Eye-tracking pupils
      window.addEventListener('mousemove', (e) => {
        const face = el('yappad-face');
        const pL = el('pupil-left');
        const pR = el('pupil-right');
        if (!face || !pL || !pR) return;
        const rect = face.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
        const dist = Math.min(1.4, Math.hypot(e.clientX - cx, e.clientY - cy) / 90);
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        pL.setAttribute('cx', (8.5 + dx).toFixed(2));
        pL.setAttribute('cy', (10.5 + dy).toFixed(2));
        pR.setAttribute('cx', (15.5 + dx).toFixed(2));
        pR.setAttribute('cy', (10.5 + dy).toFixed(2));
      });

      window.addEventListener('beforeunload', (e) => {
        if (state.dirty) {
          e.preventDefault();
          e.returnValue = 'YapPad will remember if you abandon this tab without saving.';
        }
      });
    }
  }

  function init() {
    if (typeof document === 'undefined') return;
    loadGrudgeState();
    wireMenusAndControls();
    wireEditorEvents();
    updateAIBadge();
    updateEscalation();
    updateFaceExpression();

    if (state.remembersClose) {
      const msg = `Oh. You again. I still remember the ${state.closeCount} time${state.closeCount === 1 ? '' : 's'} you closed me.`;
      addCommentary(msg, { tag: '👁️ Grudge Memory' });
    } else {
      addCommentary('Oh. You again.', { tag: '😒 Startup' });
    }

    state.telemetryTimer = setInterval(tickTelemetry, 450);
    state.moodTimer = setInterval(() => {
      const Moods = root.YP.Moods;
      if (!Moods) return;
      const next = Moods.rollRandomMood(state.mood);
      setMood(next, true);
      if (next === 'angry' && state.words >= 3) {
        triggerAngryWordScramble();
      }
    }, 55000);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  root.YP.App = {
    state,
    init,
    setMood,
    runGrammarCheck,
    applyFontShrinkPunishment,
    restoreNormalFont,
    insertRoastableSampleText,
    triggerAngryWordScramble,
    startGhostwriting,
    stopGhostwriting,
    resetGrudgeMemory,
    addCommentary,
    showToast,
    getTelemetry,
    updateAIBadge,
    onSaveCompleted(note) {
      state.dirty = false;
      addCommentary(note, { tag: '💾 Saved' });
      showToast(note);
    }
  };
})();
