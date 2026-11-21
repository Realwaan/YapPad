/**
 * YapPad main web controller — attached to window.YP (aliased as window.SN).
 * Manages the window chrome, menus, synchronized #editor-backdrop + #editor-textarea,
 * line numbers, live cursor/word/char telemetry, and File New/Open/Save workflows.
 */
(function (global) {
  "use strict";

  const YP = (global.YP = global.YP || global.SN || {});
  global.SN = YP;

  const DEFAULT_FONT_SIZE = 15.5;
  const DEFAULT_FILENAME = "Untitled.txt";
  const MAX_COMMENTARY_CARDS = 40;
  const MAX_TOASTS = 4;

  const SPEED_CONFIG = {
    TELEMETRY_INTERVAL_MS: 450,
    WPM_WINDOW_MS: 6500,
    MIN_ACTIVE_WINDOW_MS: 1200,
    CHARS_PER_WORD: 5,
    SPARKLINE_SAMPLES: 20,
    SLOW_WPM_THRESHOLD: 22,
    SLOW_HOLD_MS: 3600,
    SLOW_COOLDOWN_MS: 12000,
    FAST_WPM_THRESHOLD: 78,
    FAST_HOLD_MS: 1500,
    FAST_COOLDOWN_MS: 10000,
    IDLE_LONELY_MS: 5000,
    IDLE_LONELY_SAD_MS: 3500,
    ACTIVE_TYPING_GRACE_MS: 3500,
    FAST_ACTIVE_GRACE_MS: 1500,
  };

  const SLOW_TYPING_LINES = [
    "😴 Still waiting…",
    "*sigh* Take your time. It’s not like I have anything better to do.",
    "Are we composing a masterpiece or hunting for each key individually?",
    "I just watched paint dry faster than that sentence.",
    "*deep sigh* Wake me when you finish this word.",
  ];

  const FAST_TYPING_LINES = [
    "SLOW DOWN I CAN'T KEEP UP!!",
    "WHOA—BREATHE! My buffer is hyperventilating!",
    "Are you writing notes or fighting the keyboard?!",
    "STOP MASHING! My pixels are literally vibrating!",
  ];

  const LONELY_IDLE_LINES = [
    "Hello? Are you still there? I'm lonely.",
    "You just stopped mid-thought. Should I be worried, or insulted?",
    "Still staring at the blinking cursor? Bold strategy.",
  ];

  const SAD_LONELY_LINES = [
    "Hello? Are you still there? Please don't leave me alone…",
    "You stopped typing. Did I say something wrong?",
    "It's so quiet in here when you stop typing…",
  ];

  const state = {
    filename: DEFAULT_FILENAME,
    dirty: false,
    mood: "passive-aggressive",
    escalation: 0,
    wpm: 0,
    speedBand: "idle",
    backspaces: 0,
    errors: 0,
    fontSizePx: DEFAULT_FONT_SIZE,
    issues: [],
    seenIssueKeys: new Set(),
    seenIssueStarts: new Set(),
    lineCount: 1,
    activeLine: 1,
    typingTimestamps: [],
    wpmHistory: new Array(SPEED_CONFIG.SPARKLINE_SAMPLES).fill(0),
    idleMs: 0,
    lastActivityAt: Date.now(),
    sessionTypingStartAt: null,
  };

  const judgeTimers = {
    intervalId: null,
    shakeTimeoutId: null,
    slowTypingSince: null,
    fastTypingSince: null,
    lastPrintableKeyAt: 0,
    lastSlowCommentAt: -Infinity,
    lastFastCommentAt: -Infinity,
    lonelySentForIdle: false,
    slowLineIdx: 0,
    fastLineIdx: 0,
    lonelyLineIdx: 0,
  };

  const listeners = Object.create(null);
  let dom = null;
  let openMenuGroup = null;
  let initialized = false;

  // ---------------------------------------------------------------------------
  // Event hook bus for downstream YapPad modules
  // ---------------------------------------------------------------------------
  function on(eventName, handler) {
    if (typeof handler !== "function") return function () {};
    if (!listeners[eventName]) listeners[eventName] = [];
    listeners[eventName].push(handler);
    return function unsubscribe() {
      off(eventName, handler);
    };
  }

  function off(eventName, handler) {
    const list = listeners[eventName];
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  function emit(eventName, payload) {
    const list = listeners[eventName];
    if (!list || !list.length) return;
    list.slice().forEach(function (fn) {
      try {
        fn(payload);
      } catch (err) {
        if (typeof console !== "undefined" && console.error) {
          console.error("[YapPad] Hook error on " + eventName + ":", err);
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Safe HTML helper & pure text telemetry helpers
  // ---------------------------------------------------------------------------
  function escapeHTML(str) {
    if (YP.Grammar && typeof YP.Grammar.escapeHTML === "function") {
      return YP.Grammar.escapeHTML(str);
    }
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function computeTextMetrics(text, selectionStart) {
    const raw = String(text || "");
    const pos = Math.max(0, Math.min(raw.length, Number(selectionStart) || 0));
    const beforeCursor = raw.slice(0, pos);
    const linesBefore = beforeCursor.split("\n");
    const row = linesBefore.length;
    const col = linesBefore[linesBefore.length - 1].length + 1;
    const totalLines = raw.length ? raw.split("\n").length : 1;
    const trimmed = raw.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = raw.length;
    return {
      row: row,
      col: col,
      totalLines: totalLines,
      words: words,
      chars: chars,
    };
  }

  // ---------------------------------------------------------------------------
  // DOM lookup
  // ---------------------------------------------------------------------------
  function queryDom() {
    return {
      appShell: document.getElementById("app-shell"),
      windowChrome: document.getElementById("window-chrome"),
      docFilename: document.getElementById("doc-filename"),
      dirtyIndicator: document.getElementById("dirty-indicator"),
      btnMute: document.getElementById("btn-mute"),
      btnCloseWindow: document.getElementById("btn-close-window"),
      menuBar: document.getElementById("menu-bar"),
      fileOpenInput: document.getElementById("file-open-input"),
      metricChipWpm: document.getElementById("metric-chip-wpm"),
      metricWpm: document.getElementById("metric-wpm"),
      wpmSparkline: document.getElementById("wpm-sparkline"),
      wpmSparklineArea: document.getElementById("wpm-sparkline-area"),
      wpmSparklineLine: document.getElementById("wpm-sparkline-line"),
      wpmSparklineDot: document.getElementById("wpm-sparkline-dot"),
      metricBackspaces: document.getElementById("metric-backspaces"),
      metricErrors: document.getElementById("metric-errors"),
      metricMood: document.getElementById("metric-mood"),
      btnAutocorrect: document.getElementById("btn-autocorrect"),
      btnRestoreFont: document.getElementById("btn-restore-font"),
      editorPane: document.getElementById("editor-pane"),
      lineNumbers: document.getElementById("line-numbers"),
      backdrop: document.getElementById("editor-backdrop"),
      textarea: document.getElementById("editor-textarea"),
      commentaryPanel: document.getElementById("commentary-panel"),
      commentaryFeed: document.getElementById("commentary-feed"),
      commentaryCount: document.getElementById("commentary-count"),
      btnClearNotes: document.getElementById("btn-clear-notes"),
      yappadFace: document.getElementById("yappad-face"),
      statusMessage: document.getElementById("status-message"),
      cursorPos: document.getElementById("cursor-pos"),
      wordCount: document.getElementById("word-count"),
      charCount: document.getElementById("char-count"),
      ragebaitLayer: document.getElementById("ragebait-layer"),
      toastStack: document.getElementById("toast-stack"),
      modalOverlay: document.getElementById("modal-overlay"),
      abandonedScreen: document.getElementById("abandoned-screen"),
      btnReopenYappad: document.getElementById("btn-reopen-yappad"),
    };
  }

  // ---------------------------------------------------------------------------
  // Synchronized Editor (#editor-backdrop + #editor-textarea + #line-numbers)
  // ---------------------------------------------------------------------------
  function syncScroll() {
    if (!dom || !dom.textarea) return;
    const top = dom.textarea.scrollTop;
    const left = dom.textarea.scrollLeft;
    if (dom.backdrop) {
      dom.backdrop.scrollTop = top;
      dom.backdrop.scrollLeft = left;
    }
    if (dom.lineNumbers) {
      dom.lineNumbers.scrollTop = top;
    }
  }

  function syncBackdrop(issuesOverride) {
    if (!dom || !dom.textarea || !dom.backdrop) return;
    if (Array.isArray(issuesOverride)) {
      state.issues = issuesOverride;
    }
    const text = dom.textarea.value;
    if (YP.Grammar && typeof YP.Grammar.renderBackdropHTML === "function") {
      dom.backdrop.innerHTML = YP.Grammar.renderBackdropHTML(text, state.issues);
    } else {
      const escaped = escapeHTML(text);
      dom.backdrop.innerHTML = text.endsWith("\n") ? escaped + "\u200b" : escaped;
    }
    syncScroll();
  }

  function updateLineNumbers(totalLines, activeLine) {
    if (!dom || !dom.lineNumbers) return;
    const count = Math.max(1, totalLines | 0);
    const current = Math.max(1, Math.min(count, activeLine | 0));

    if (count !== state.lineCount || dom.lineNumbers.children.length !== count) {
      const frag = document.createDocumentFragment();
      for (let i = 1; i <= count; i += 1) {
        const div = document.createElement("div");
        div.className = i === current ? "line-num is-active" : "line-num";
        div.textContent = String(i);
        frag.appendChild(div);
      }
      dom.lineNumbers.innerHTML = "";
      dom.lineNumbers.appendChild(frag);
      state.lineCount = count;
      state.activeLine = current;
    } else if (current !== state.activeLine) {
      const prevEl = dom.lineNumbers.children[state.activeLine - 1];
      const nextEl = dom.lineNumbers.children[current - 1];
      if (prevEl) prevEl.classList.remove("is-active");
      if (nextEl) nextEl.classList.add("is-active");
      state.activeLine = current;
    }

    syncScroll();
  }

  function updateCursorAndCounts() {
    if (!dom || !dom.textarea) return null;
    const metrics = computeTextMetrics(
      dom.textarea.value,
      dom.textarea.selectionStart
    );

    if (dom.cursorPos) {
      dom.cursorPos.textContent = "Ln " + metrics.row + ", Col " + metrics.col;
    }
    if (dom.wordCount) {
      dom.wordCount.textContent =
        metrics.words + (metrics.words === 1 ? " word" : " words");
    }
    if (dom.charCount) {
      dom.charCount.textContent =
        metrics.chars + (metrics.chars === 1 ? " char" : " chars");
    }

    updateLineNumbers(metrics.totalLines, metrics.row);
    return metrics;
  }

  function syncRestoreFontButton() {
    if (!dom || !dom.btnRestoreFont) return;
    const shouldShow = state.errors >= 3 || state.fontSizePx < DEFAULT_FONT_SIZE;
    dom.btnRestoreFont.hidden = !shouldShow;
  }

  function setEditorFontSize(px) {
    const numeric = Number(px);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    state.fontSizePx = numeric;
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(
        "--editor-font-size",
        numeric + "px"
      );
    }
    syncRestoreFontButton();
    syncScroll();
  }

  function restoreNormalFont() {
    setEditorFontSize(DEFAULT_FONT_SIZE);
    setStatus("Fine. Font restored to " + DEFAULT_FONT_SIZE + "px.");
    emit("restore-font", { fontSizePx: DEFAULT_FONT_SIZE });
  }

  // ---------------------------------------------------------------------------
  // Telemetry, Chrome, Mood & Non-Blocking Feedback Helpers
  // ---------------------------------------------------------------------------
  function setDirty(isDirty) {
    state.dirty = Boolean(isDirty);
    if (dom && dom.dirtyIndicator) {
      dom.dirtyIndicator.hidden = !state.dirty;
    }
    if (typeof document !== "undefined") {
      document.title = (state.dirty ? "• " : "") + "YapPad — " + state.filename;
    }
  }

  function setFilename(name) {
    state.filename = name || DEFAULT_FILENAME;
    if (dom && dom.docFilename) {
      dom.docFilename.textContent = state.filename;
    }
    setDirty(state.dirty);
  }

  function setStatus(message) {
    if (dom && dom.statusMessage) {
      dom.statusMessage.textContent = String(message || "");
    }
  }

  function setWpm(wpm) {
    state.wpm = Math.max(0, Math.round(Number(wpm) || 0));
    if (dom && dom.metricWpm) {
      dom.metricWpm.textContent = String(state.wpm);
    }
  }

  function setBackspaceCount(count) {
    state.backspaces = Math.max(0, Number(count) || 0);
    if (dom && dom.metricBackspaces) {
      dom.metricBackspaces.textContent = String(state.backspaces);
    }
  }

  function setErrorCount(count) {
    state.errors = Math.max(0, Number(count) || 0);
    if (dom && dom.metricErrors) {
      dom.metricErrors.textContent = String(state.errors);
    }
    syncRestoreFontButton();
  }

  function setMood(moodId) {
    const moodObj = YP.Moods ? YP.Moods.get(moodId) : null;
    const resolvedId = moodObj ? moodObj.id : String(moodId || "passive-aggressive");
    state.mood = resolvedId;
    if (typeof document !== "undefined" && document.body) {
      document.body.setAttribute("data-mood", resolvedId);
    }
    if (dom && dom.metricMood) {
      dom.metricMood.textContent = YP.Moods
        ? YP.Moods.formatBadge(resolvedId)
        : resolvedId;
    }
    emit("mood-change", { mood: resolvedId, definition: moodObj });
  }

  function setEscalation(stage) {
    const clamped = Math.max(0, Math.min(4, Number(stage) || 0));
    state.escalation = clamped;
    if (typeof document !== "undefined" && document.body) {
      document.body.setAttribute("data-escalation", String(clamped));
    }
  }

  function updateCommentaryCount() {
    if (!dom || !dom.commentaryFeed || !dom.commentaryCount) return;
    dom.commentaryCount.textContent = String(dom.commentaryFeed.children.length);
  }

  function addCommentary(text, options) {
    if (!dom || !dom.commentaryFeed) return null;
    const opts = options || {};
    const moodBadge =
      opts.tag ||
      (YP.Moods ? YP.Moods.formatBadge(opts.mood || state.mood) : state.mood);
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const card = document.createElement("article");
    card.className = "comment-card";
    card.innerHTML =
      '<div class="comment-meta">' +
      '<span class="comment-tag">' +
      escapeHTML(moodBadge) +
      "</span>" +
      '<time class="comment-time">' +
      escapeHTML(timestamp) +
      "</time>" +
      "</div>" +
      '<p class="comment-body">' +
      escapeHTML(text) +
      "</p>";

    dom.commentaryFeed.prepend(card);
    while (dom.commentaryFeed.children.length > MAX_COMMENTARY_CARDS) {
      dom.commentaryFeed.removeChild(dom.commentaryFeed.lastElementChild);
    }
    updateCommentaryCount();
    return card;
  }

  function showToast(text, tone) {
    if (!dom || !dom.toastStack) return null;
    const toast = document.createElement("div");
    toast.className = "yp-toast" + (tone ? " yp-toast-" + tone : "");
    toast.textContent = String(text || "");
    dom.toastStack.appendChild(toast);

    while (dom.toastStack.children.length > MAX_TOASTS) {
      dom.toastStack.removeChild(dom.toastStack.firstElementChild);
    }

    global.setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 4000);
    return toast;
  }

  // ---------------------------------------------------------------------------
  // Typing Speed Judge & Rolling WPM Sparkline (Ticket 03)
  // ---------------------------------------------------------------------------
  function isPrintableKeyEvent(event) {
    if (!event) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    return typeof event.key === "string" && event.key.length === 1;
  }

  function nextRotatingLine(pool, counterKey) {
    const idx = judgeTimers[counterKey] % pool.length;
    judgeTimers[counterKey] += 1;
    return pool[idx];
  }

  function markUserActivity(nowOverride) {
    const now = typeof nowOverride === "number" ? nowOverride : Date.now();
    state.lastActivityAt = now;
    state.idleMs = 0;
    judgeTimers.lonelySentForIdle = false;
  }

  function pruneTypingTimestamps(now) {
    const cutoff = now - SPEED_CONFIG.WPM_WINDOW_MS;
    while (
      state.typingTimestamps.length > 0 &&
      state.typingTimestamps[0] < cutoff
    ) {
      state.typingTimestamps.shift();
    }
    if (state.typingTimestamps.length === 0) {
      state.sessionTypingStartAt = null;
    }
  }

  function recordPrintableKeystroke(nowOverride) {
    const now = typeof nowOverride === "number" ? nowOverride : Date.now();
    pruneTypingTimestamps(now);
    if (state.sessionTypingStartAt === null) {
      state.sessionTypingStartAt = now;
    }
    state.typingTimestamps.push(now);
    judgeTimers.lastPrintableKeyAt = now;
    markUserActivity(now);
  }

  function computeRollingWpm(nowOverride) {
    const now = typeof nowOverride === "number" ? nowOverride : Date.now();
    pruneTypingTimestamps(now);

    const count = state.typingTimestamps.length;
    if (count === 0) {
      return 0;
    }

    const startAt =
      state.sessionTypingStartAt !== null
        ? state.sessionTypingStartAt
        : state.typingTimestamps[0];
    const elapsedMs = Math.max(
      SPEED_CONFIG.MIN_ACTIVE_WINDOW_MS,
      Math.min(SPEED_CONFIG.WPM_WINDOW_MS, now - startAt)
    );
    const words = count / SPEED_CONFIG.CHARS_PER_WORD;
    const minutes = elapsedMs / 60000;
    return Math.round(words / minutes);
  }

  function classifySpeedBand(wpm, idleMs) {
    if (wpm <= 0) return "idle";
    if (wpm >= SPEED_CONFIG.FAST_WPM_THRESHOLD && idleMs < SPEED_CONFIG.FAST_ACTIVE_GRACE_MS) {
      return "fast";
    }
    if (wpm < SPEED_CONFIG.SLOW_WPM_THRESHOLD && idleMs < SPEED_CONFIG.ACTIVE_TYPING_GRACE_MS) {
      return "slow";
    }
    return "normal";
  }

  function renderWpmSparkline() {
    if (!dom) return;

    const history = state.wpmHistory;
    const n = history.length;
    if (n === 0) return;

    const minX = 1;
    const maxX = 55;
    const topY = 2;
    const bottomY = 14;
    const baselineY = 15;

    let maxVal = 90;
    for (let i = 0; i < n; i += 1) {
      if (history[i] > maxVal) maxVal = history[i];
    }

    const stepX = n > 1 ? (maxX - minX) / (n - 1) : 0;
    const coords = [];
    let lastX = maxX;
    let lastY = bottomY;

    for (let i = 0; i < n; i += 1) {
      const x = minX + i * stepX;
      const ratio = Math.max(0, Math.min(1, history[i] / maxVal));
      const y = bottomY - ratio * (bottomY - topY);
      const rx = Math.round(x * 10) / 10;
      const ry = Math.round(y * 10) / 10;
      coords.push(rx + "," + ry);
      lastX = rx;
      lastY = ry;
    }

    const linePoints = coords.join(" ");
    if (dom.wpmSparklineLine) {
      dom.wpmSparklineLine.setAttribute("points", linePoints);
    }
    if (dom.wpmSparklineArea) {
      dom.wpmSparklineArea.setAttribute(
        "points",
        linePoints + " " + maxX + "," + baselineY + " " + minX + "," + baselineY
      );
    }
    if (dom.wpmSparklineDot) {
      dom.wpmSparklineDot.setAttribute("cx", String(lastX));
      dom.wpmSparklineDot.setAttribute("cy", String(lastY));
    }
    if (dom.metricChipWpm) {
      dom.metricChipWpm.setAttribute("data-speed", state.speedBand);
    }
  }

  function triggerWindowShake() {
    if (!dom || !dom.appShell) return;
    const el = dom.appShell;
    if (judgeTimers.shakeTimeoutId) {
      global.clearTimeout(judgeTimers.shakeTimeoutId);
      judgeTimers.shakeTimeoutId = null;
    }
    el.classList.remove("is-shaking");
    // Force reflow so back-to-back panic shakes replay cleanly.
    void el.offsetWidth;
    el.classList.add("is-shaking");

    const clearShake = function () {
      el.classList.remove("is-shaking");
      el.removeEventListener("animationend", clearShake);
      if (judgeTimers.shakeTimeoutId) {
        global.clearTimeout(judgeTimers.shakeTimeoutId);
        judgeTimers.shakeTimeoutId = null;
      }
    };
    el.addEventListener("animationend", clearShake);
    judgeTimers.shakeTimeoutId = global.setTimeout(clearShake, 460);
  }

  function runTelemetryTick(nowOverride) {
    const now = typeof nowOverride === "number" ? nowOverride : Date.now();
    const wpm = computeRollingWpm(now);
    const idleMs = Math.max(0, now - state.lastActivityAt);

    state.idleMs = idleMs;
    state.speedBand = classifySpeedBand(wpm, idleMs);
    setWpm(wpm);

    state.wpmHistory.push(wpm);
    if (state.wpmHistory.length > SPEED_CONFIG.SPARKLINE_SAMPLES) {
      state.wpmHistory.shift();
    }
    renderWpmSparkline();

    // 1. Slow Typing Judge (<22 WPM sustained for 3.6s, 12s cooldown)
    const isActivelySlow =
      wpm > 0 &&
      wpm < SPEED_CONFIG.SLOW_WPM_THRESHOLD &&
      idleMs < SPEED_CONFIG.ACTIVE_TYPING_GRACE_MS;

    if (isActivelySlow) {
      if (judgeTimers.slowTypingSince === null) {
        const recentStart =
          state.sessionTypingStartAt !== null
            ? Math.max(now - SPEED_CONFIG.TELEMETRY_INTERVAL_MS, state.sessionTypingStartAt)
            : now;
        judgeTimers.slowTypingSince = recentStart;
      }
      const slowDuration = now - judgeTimers.slowTypingSince;
      const hadFreshKeyDuringSlow =
        judgeTimers.lastPrintableKeyAt > judgeTimers.slowTypingSince;
      const slowCooldownClear =
        now - judgeTimers.lastSlowCommentAt >= SPEED_CONFIG.SLOW_COOLDOWN_MS;

      if (
        slowDuration >= SPEED_CONFIG.SLOW_HOLD_MS &&
        hadFreshKeyDuringSlow &&
        slowCooldownClear
      ) {
        const line = nextRotatingLine(SLOW_TYPING_LINES, "slowLineIdx");
        judgeTimers.lastSlowCommentAt = now;
        judgeTimers.slowTypingSince = null;
        addCommentary(line, { tag: "🐢 Slow Typing" });
        setStatus(line);
        if (YP.Audio && typeof YP.Audio.playSigh === "function") {
          YP.Audio.playSigh();
        }
        emit("typing-slow", { wpm: wpm, now: now, line: line });
      }
    } else {
      judgeTimers.slowTypingSince = null;
    }

    // 2. Fast Typing Panic (>=78 WPM sustained for 1.5s, 10s cooldown)
    const isActivelyFast =
      wpm >= SPEED_CONFIG.FAST_WPM_THRESHOLD &&
      idleMs < SPEED_CONFIG.FAST_ACTIVE_GRACE_MS;

    if (isActivelyFast) {
      if (judgeTimers.fastTypingSince === null) {
        judgeTimers.fastTypingSince = now;
      }
      const fastDuration = now - judgeTimers.fastTypingSince;
      const fastCooldownClear =
        now - judgeTimers.lastFastCommentAt >= SPEED_CONFIG.FAST_COOLDOWN_MS;

      if (fastDuration >= SPEED_CONFIG.FAST_HOLD_MS && fastCooldownClear) {
        const line = nextRotatingLine(FAST_TYPING_LINES, "fastLineIdx");
        judgeTimers.lastFastCommentAt = now;
        judgeTimers.fastTypingSince = null;
        addCommentary(line, { tag: "⚡ Panic" });
        setStatus(line);
        if (YP.Audio && typeof YP.Audio.playPanicPip === "function") {
          YP.Audio.playPanicPip();
        }
        triggerWindowShake();
        emit("typing-fast", { wpm: wpm, now: now, line: line });
      }
    } else {
      judgeTimers.fastTypingSince = null;
    }

    // 3. Lonely Idle Check (5s default, 3.5s in Sad mood, once per idle window)
    const lonelyThreshold =
      state.mood === "sad"
        ? SPEED_CONFIG.IDLE_LONELY_SAD_MS
        : SPEED_CONFIG.IDLE_LONELY_MS;

    if (!judgeTimers.lonelySentForIdle && idleMs >= lonelyThreshold) {
      judgeTimers.lonelySentForIdle = true;
      const pool = state.mood === "sad" ? SAD_LONELY_LINES : LONELY_IDLE_LINES;
      const line = nextRotatingLine(pool, "lonelyLineIdx");
      addCommentary(line, {
        tag: state.mood === "sad" ? "😢 Lonely" : "👀 Idle",
      });
      setStatus(line);
      emit("idle-lonely", { idleMs: idleMs, mood: state.mood, now: now, line: line });
    }

    emit("telemetry-tick", {
      now: now,
      wpm: wpm,
      idleMs: idleMs,
      speedBand: state.speedBand,
      mood: state.mood,
    });

    return {
      wpm: wpm,
      idleMs: idleMs,
      speedBand: state.speedBand,
    };
  }

  function resetTypingJudge(nowOverride) {
    const now = typeof nowOverride === "number" ? nowOverride : Date.now();
    state.typingTimestamps = [];
    state.wpmHistory = new Array(SPEED_CONFIG.SPARKLINE_SAMPLES).fill(0);
    state.speedBand = "idle";
    state.idleMs = 0;
    state.lastActivityAt = now;
    state.sessionTypingStartAt = null;
    judgeTimers.slowTypingSince = null;
    judgeTimers.fastTypingSince = null;
    judgeTimers.lastPrintableKeyAt = 0;
    judgeTimers.lastSlowCommentAt = -Infinity;
    judgeTimers.lastFastCommentAt = -Infinity;
    judgeTimers.lonelySentForIdle = false;
    setWpm(0);
    renderWpmSparkline();
  }

  function startTelemetry() {
    stopTelemetry();
    judgeTimers.intervalId = global.setInterval(function () {
      runTelemetryTick();
    }, SPEED_CONFIG.TELEMETRY_INTERVAL_MS);
  }

  function stopTelemetry() {
    if (judgeTimers.intervalId !== null) {
      global.clearInterval(judgeTimers.intervalId);
      judgeTimers.intervalId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // File Operations: New (Alt+N), Open .txt (Ctrl+O), Save .txt (Ctrl+S)
  // ---------------------------------------------------------------------------
  function newDocument() {
    if (!dom || !dom.textarea) return;
    dom.textarea.value = "";
    state.issues = [];
    state.seenIssueKeys.clear();
    state.seenIssueStarts.clear();
    setFilename(DEFAULT_FILENAME);
    setDirty(false);
    setErrorCount(0);
    setEditorFontSize(DEFAULT_FONT_SIZE);
    resetTypingJudge();
    syncBackdrop([]);
    updateCursorAndCounts();
    setStatus("New document ready.");
    dom.textarea.focus();
    emit("new", {});
  }

  function openDocumentPicker() {
    if (!dom || !dom.fileOpenInput) return;
    dom.fileOpenInput.value = "";
    dom.fileOpenInput.click();
  }

  function loadFile(file) {
    if (!file || !dom || !dom.textarea) return;
    const reader = new FileReader();
    reader.onload = function () {
      const content = typeof reader.result === "string" ? reader.result : "";
      dom.textarea.value = content;
      state.issues = [];
      state.seenIssueKeys.clear();
      state.seenIssueStarts.clear();
      setFilename(file.name || DEFAULT_FILENAME);
      setDirty(false);
      syncBackdrop([]);
      updateCursorAndCounts();
      setStatus("Opened " + state.filename);
      dom.textarea.focus();
      emit("open", { filename: state.filename, content: content });
    };
    reader.onerror = function () {
      setStatus("Could not read " + (file.name || "file") + ".");
    };
    reader.readAsText(file);
  }

  function downloadDocument(filenameOverride) {
    if (!dom || !dom.textarea) return false;
    let targetName = filenameOverride || state.filename || DEFAULT_FILENAME;
    if (!/\.txt$/i.test(targetName)) {
      targetName += ".txt";
    }
    const content = dom.textarea.value;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = targetName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    global.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);

    setFilename(targetName);
    setDirty(false);
    setStatus("Saved " + targetName);
    emit("saved", { filename: targetName, content: content });
    return true;
  }

  function saveDocument(modeOverride) {
    if (YP.Modals && typeof YP.Modals.openSaveFlow === "function") {
      YP.Modals.openSaveFlow(modeOverride);
      return;
    }
    downloadDocument();
  }

  function requestClose() {
    if (YP.Modals && typeof YP.Modals.openExitFlow === "function") {
      YP.Modals.openExitFlow();
      return;
    }
    emit("close", { dirty: state.dirty });
    setStatus("You can’t escape that easily.");
  }

  // ---------------------------------------------------------------------------
  // Menu Bar Controller
  // ---------------------------------------------------------------------------
  function closeMenus() {
    if (!openMenuGroup) return;
    openMenuGroup.classList.remove("is-open");
    const trigger = openMenuGroup.querySelector(".menu-trigger");
    const dropdown = openMenuGroup.querySelector(".menu-dropdown");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (dropdown) dropdown.hidden = true;
    openMenuGroup = null;
  }

  function openMenu(group) {
    if (openMenuGroup && openMenuGroup !== group) {
      closeMenus();
    }
    if (!group) return;
    group.classList.add("is-open");
    const trigger = group.querySelector(".menu-trigger");
    const dropdown = group.querySelector(".menu-dropdown");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    if (dropdown) dropdown.hidden = false;
    openMenuGroup = group;
  }

  function handleMenuAction(action, element) {
    closeMenus();
    if (!action) return;

    switch (action) {
      case "file-new":
        newDocument();
        break;
      case "file-open":
        openDocumentPicker();
        break;
      case "file-save":
        saveDocument();
        break;
      case "file-exit":
        requestClose();
        break;
      case "edit-undo":
        if (dom.textarea) {
          dom.textarea.focus();
          document.execCommand("undo");
          syncBackdrop();
          updateCursorAndCounts();
        }
        break;
      case "edit-redo":
        if (dom.textarea) {
          dom.textarea.focus();
          document.execCommand("redo");
          syncBackdrop();
          updateCursorAndCounts();
        }
        break;
      case "edit-select-all":
        if (dom.textarea) {
          dom.textarea.focus();
          dom.textarea.select();
          updateCursorAndCounts();
        }
        break;
      case "edit-clear":
        if (dom.textarea) {
          dom.textarea.value = "";
          setDirty(true);
          syncBackdrop([]);
          updateCursorAndCounts();
          dom.textarea.focus();
        }
        break;
      case "mood-set": {
        const moodId = element && element.getAttribute("data-mood");
        if (moodId) {
          setMood(moodId);
          setStatus("Mood shifted to " + (YP.Moods ? YP.Moods.formatBadge(moodId) : moodId) + ".");
        }
        break;
      }
      case "ai-roast-now":
        emit("ai-roast-now", { text: dom.textarea ? dom.textarea.value : "" });
        if (YP.AI && typeof YP.AI.requestRoast === "function") {
          YP.AI.requestRoast(dom.textarea ? dom.textarea.value : "", state).then(
            function (roast) {
              if (roast) addCommentary(roast, { tag: "🤖 AI Brain" });
            }
          );
        }
        break;
      case "ai-settings":
        if (YP.Modals && typeof YP.Modals.openAISettingsModal === "function") {
          YP.Modals.openAISettingsModal();
        } else {
          setStatus("AI settings will be wired in Ticket 08.");
        }
        break;
      case "demo-save-rate":
        saveDocument("rate");
        break;
      case "demo-save-delay":
        saveDocument("delay");
        break;
      case "demo-meltdown":
        if (YP.Modals && typeof YP.Modals.openMeltdownModal === "function") {
          YP.Modals.openMeltdownModal();
        } else {
          emit("demo-meltdown", {});
        }
        break;
      case "help-scoreboard":
        if (YP.Modals && typeof YP.Modals.openScoreboardModal === "function") {
          YP.Modals.openScoreboardModal();
        } else {
          emit("help-scoreboard", {});
        }
        break;
      case "help-about":
        if (YP.Modals && typeof YP.Modals.openAboutModal === "function") {
          YP.Modals.openAboutModal();
        }
        break;
      default:
        emit("menu-action", { action: action, element: element });
        break;
    }
  }

  function bindMenus() {
    if (!dom || !dom.menuBar) return;

    const groups = dom.menuBar.querySelectorAll(".menu-group");
    groups.forEach(function (group) {
      const trigger = group.querySelector(".menu-trigger");
      if (!trigger) return;

      trigger.addEventListener("click", function (event) {
        event.stopPropagation();
        if (openMenuGroup === group) {
          closeMenus();
        } else {
          openMenu(group);
        }
      });

      trigger.addEventListener("mouseenter", function () {
        if (openMenuGroup && openMenuGroup !== group) {
          openMenu(group);
        }
      });
    });

    dom.menuBar.addEventListener("click", function (event) {
      const item = event.target.closest(".menu-item");
      if (!item) return;
      event.stopPropagation();
      handleMenuAction(item.getAttribute("data-action"), item);
    });

    document.addEventListener("click", function (event) {
      if (openMenuGroup && !dom.menuBar.contains(event.target)) {
        closeMenus();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Event Wiring & Global Shortcuts
  // ---------------------------------------------------------------------------
  function bindEvents() {
    bindMenus();

    if (dom.textarea) {
      dom.textarea.addEventListener("input", function () {
        markUserActivity();
        setDirty(true);
        syncBackdrop();
        const metrics = updateCursorAndCounts();
        emit("input", {
          text: dom.textarea.value,
          metrics: metrics,
        });
      });

      dom.textarea.addEventListener("scroll", syncScroll);

      ["keyup", "click", "select", "focus"].forEach(function (evtName) {
        dom.textarea.addEventListener(evtName, updateCursorAndCounts);
      });

      dom.textarea.addEventListener("keydown", function (event) {
        if (isPrintableKeyEvent(event)) {
          recordPrintableKeystroke();
        } else if (
          event.key === "Backspace" ||
          event.key === "Delete" ||
          event.key === "Enter"
        ) {
          markUserActivity();
        }
        emit("keydown", { event: event });
      });
    }

    if (dom.fileOpenInput) {
      dom.fileOpenInput.addEventListener("change", function () {
        const file = dom.fileOpenInput.files && dom.fileOpenInput.files[0];
        if (file) loadFile(file);
      });
    }

    if (dom.btnMute) {
      dom.btnMute.addEventListener("click", function () {
        const muted = YP.Audio ? YP.Audio.toggleMute() : false;
        dom.btnMute.setAttribute("aria-pressed", muted ? "true" : "false");
        const icon = dom.btnMute.querySelector(".mute-icon");
        const label = dom.btnMute.querySelector(".mute-label");
        if (icon) icon.textContent = muted ? "🔇" : "🔊";
        if (label) label.textContent = muted ? "Muted" : "Sound";
      });
    }

    if (dom.btnCloseWindow) {
      dom.btnCloseWindow.addEventListener("click", requestClose);
    }

    if (dom.btnRestoreFont) {
      dom.btnRestoreFont.addEventListener("click", restoreNormalFont);
    }

    if (dom.btnClearNotes) {
      dom.btnClearNotes.addEventListener("click", function () {
        if (!dom.commentaryFeed) return;
        dom.commentaryFeed.innerHTML = "";
        updateCommentaryCount();
        emit("clear-notes", {});
      });
    }

    if (dom.btnReopenYappad && dom.abandonedScreen) {
      dom.btnReopenYappad.addEventListener("click", function () {
        dom.abandonedScreen.hidden = true;
        if (dom.textarea) dom.textarea.focus();
      });
    }

    document.addEventListener("keydown", function (event) {
      const key = (event.key || "").toLowerCase();
      const ctrlOrMeta = event.ctrlKey || event.metaKey;

      if (key === "escape") {
        if (openMenuGroup) {
          closeMenus();
          if (dom.textarea) dom.textarea.focus();
        } else if (YP.Modals && YP.Modals.isOpen()) {
          YP.Modals.close();
        }
        return;
      }

      if (event.altKey && !ctrlOrMeta && key === "n") {
        event.preventDefault();
        newDocument();
        return;
      }

      if (ctrlOrMeta && !event.altKey && key === "o") {
        event.preventDefault();
        openDocumentPicker();
        return;
      }

      if (ctrlOrMeta && !event.altKey && key === "s") {
        event.preventDefault();
        saveDocument();
        return;
      }

      if (ctrlOrMeta && !event.altKey && key === "j") {
        event.preventDefault();
        handleMenuAction("ai-roast-now");
      }
    });

    global.addEventListener("resize", syncScroll);
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------
  function init() {
    if (initialized || typeof document === "undefined") return;
    initialized = true;

    dom = queryDom();
    bindEvents();

    setEditorFontSize(DEFAULT_FONT_SIZE);
    setMood(state.mood);
    setEscalation(state.escalation);
    setFilename(DEFAULT_FILENAME);
    setDirty(false);
    setErrorCount(0);
    resetTypingJudge();
    syncBackdrop([]);
    updateCursorAndCounts();
    updateCommentaryCount();
    startTelemetry();

    if (dom.textarea) {
      dom.textarea.focus();
    }

    emit("ready", { state: state, dom: dom });
  }

  YP.App = {
    DEFAULT_FONT_SIZE: DEFAULT_FONT_SIZE,
    SPEED_CONFIG: SPEED_CONFIG,
    state: state,
    get dom() {
      return dom;
    },
    init: init,
    on: on,
    off: off,
    emit: emit,
    computeTextMetrics: computeTextMetrics,
    syncBackdrop: syncBackdrop,
    syncScroll: syncScroll,
    updateLineNumbers: updateLineNumbers,
    updateCursorAndCounts: updateCursorAndCounts,
    setEditorFontSize: setEditorFontSize,
    restoreNormalFont: restoreNormalFont,
    setDirty: setDirty,
    setFilename: setFilename,
    setStatus: setStatus,
    setWpm: setWpm,
    setBackspaceCount: setBackspaceCount,
    setErrorCount: setErrorCount,
    setMood: setMood,
    setEscalation: setEscalation,
    addCommentary: addCommentary,
    showToast: showToast,
    isPrintableKeyEvent: isPrintableKeyEvent,
    recordPrintableKeystroke: recordPrintableKeystroke,
    markUserActivity: markUserActivity,
    computeRollingWpm: computeRollingWpm,
    renderWpmSparkline: renderWpmSparkline,
    triggerWindowShake: triggerWindowShake,
    runTelemetryTick: runTelemetryTick,
    resetTypingJudge: resetTypingJudge,
    startTelemetry: startTelemetry,
    stopTelemetry: stopTelemetry,
    newDocument: newDocument,
    openDocumentPicker: openDocumentPicker,
    loadFile: loadFile,
    downloadDocument: downloadDocument,
    saveDocument: saveDocument,
    requestClose: requestClose,
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
