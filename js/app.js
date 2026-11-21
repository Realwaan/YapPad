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

  const DELETION_CONFIG = {
    GUILT_COOLDOWN_MS: 2200,
    INTERVENTION_INTERVAL: 5,
  };

  const BACKSPACE_GUILT_LINES = [
    "Are you sure? You worked so hard on that.",
    "Deleting again? This is becoming a pattern.",
    "Every Backspace breaks a tiny piece of my buffer.",
    "That character had a family. You just erased it.",
    "Second-guessing yourself already? Classic.",
    "Why type anything if you're just going to take it back?",
  ];

  const deletionTracker = {
    lastGuiltAt: -Infinity,
    lineIdx: 0,
  };

  const state = {
    filename: DEFAULT_FILENAME,
    dirty: false,
    mood: "passive-aggressive",
    escalation: 0,
    wpm: 0,
    backspaces: 0,
    errors: 0,
    fontSizePx: DEFAULT_FONT_SIZE,
    issues: [],
    seenIssueKeys: new Set(),
    seenIssueStarts: new Set(),
    lineCount: 1,
    activeLine: 1,
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
      metricWpm: document.getElementById("metric-wpm"),
      wpmSparkline: document.getElementById("wpm-sparkline"),
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
  // Backspace / Delete Guilt Trip & Mass-Delete Meltdown (Ticket 05)
  // ---------------------------------------------------------------------------
  function nextGuiltLine() {
    const line = BACKSPACE_GUILT_LINES[deletionTracker.lineIdx % BACKSPACE_GUILT_LINES.length];
    deletionTracker.lineIdx += 1;
    return line;
  }

  function isWholeBufferSelected(textarea) {
    if (!textarea) return false;
    const len = textarea.value.length;
    if (len <= 0) return false;
    return textarea.selectionStart === 0 && textarea.selectionEnd === len;
  }

  function triggerMassDeleteMeltdown(options) {
    const opts = options || {};
    const deletedChars =
      typeof opts.deletedChars === "number"
        ? opts.deletedChars
        : dom && dom.textarea
          ? dom.textarea.value.length
          : 0;
    const source = opts.source || "mass-delete";

    emit("mass-delete", {
      deletedChars: deletedChars,
      source: source,
      backspaces: state.backspaces,
    });

    if (YP.Modals && typeof YP.Modals.openMeltdownModal === "function") {
      return YP.Modals.openMeltdownModal({
        deletedChars: deletedChars,
        source: source,
        durationMs: opts.durationMs,
      });
    }
    return null;
  }

  function triggerBackspaceIntervention(count) {
    const msg =
      "Deleting again? That's " +
      count +
      " deletions—this is becoming a pattern. Commit to a word for once.";

    addCommentary(msg, { tag: "🚨 Self-Doubt Alert" });
    setStatus(msg);

    emit("backspace-intervention", { count: count, message: msg });

    if (YP.Ragebait && typeof YP.Ragebait.showCenterRagebait === "function") {
      return YP.Ragebait.showCenterRagebait({
        title: "🚨 BACKSPACE INTERVENTION",
        count: count,
        message: msg,
        dodgeLabel: "✨ Restore Confidence",
        dismissLabel: "I admit I'm indecisive",
      });
    }

    if (YP.Modals && typeof YP.Modals.openBackspaceIntervention === "function") {
      return YP.Modals.openBackspaceIntervention(count);
    }
    return null;
  }

  function handleDeletionKeydown(event, nowOverride) {
    if (!event) return null;
    if (event.key !== "Backspace" && event.key !== "Delete") return null;

    const now = typeof nowOverride === "number" ? nowOverride : Date.now();
    const isMassDelete = isWholeBufferSelected(dom && dom.textarea);
    const deletedChars = dom && dom.textarea ? dom.textarea.value.length : 0;

    setBackspaceCount(state.backspaces + 1);
    const count = state.backspaces;

    emit("backspace", {
      count: count,
      key: event.key,
      isMassDelete: isMassDelete,
      now: now,
    });

    // Mass delete (Ctrl+A + Backspace/Delete on non-empty buffer): let native
    // deletion finish first, then launch the emotional meltdown modal.
    if (isMassDelete) {
      global.setTimeout(function () {
        triggerMassDeleteMeltdown({
          deletedChars: deletedChars,
          source: "mass-delete",
        });
      }, 0);
      return { type: "mass-delete", count: count };
    }

    // Every 5th Backspace/Delete pops the center ragebait intervention.
    if (count % DELETION_CONFIG.INTERVENTION_INTERVAL === 0) {
      deletionTracker.lastGuiltAt = now;
      global.setTimeout(function () {
        triggerBackspaceIntervention(count);
      }, 0);
      return { type: "intervention", count: count };
    }

    // Single deletion guilt trip (rate-limited so normal editing stays readable).
    if (now - deletionTracker.lastGuiltAt >= DELETION_CONFIG.GUILT_COOLDOWN_MS) {
      deletionTracker.lastGuiltAt = now;
      const line = nextGuiltLine();
      addCommentary(line, { tag: "🗑️ Deletion Guilt" });
      showToast(line, "warning");
      setStatus(line);
      if (YP.Audio && typeof YP.Audio.playGuiltPop === "function") {
        YP.Audio.playGuiltPop();
      }
      return { type: "guilt", count: count, line: line };
    }

    return { type: "counted", count: count };
  }

  // ---------------------------------------------------------------------------
  // File Operations: New (Alt+N), Open .txt (Ctrl+O), Save .txt (Ctrl+S)
  // ---------------------------------------------------------------------------
  function newDocument() {
    if (!dom || !dom.textarea) return;
    if (YP.Ragebait && typeof YP.Ragebait.clearAll === "function") {
      YP.Ragebait.clearAll();
    }
    dom.textarea.value = "";
    state.issues = [];
    state.seenIssueKeys.clear();
    state.seenIssueStarts.clear();
    setFilename(DEFAULT_FILENAME);
    setDirty(false);
    setErrorCount(0);
    setEditorFontSize(DEFAULT_FONT_SIZE);
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
        triggerMassDeleteMeltdown({
          deletedChars: dom.textarea ? dom.textarea.value.length : 0,
          source: "demo",
        });
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
        handleDeletionKeydown(event);
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
    syncBackdrop([]);
    updateCursorAndCounts();
    updateCommentaryCount();

    if (dom.textarea) {
      dom.textarea.focus();
    }

    emit("ready", { state: state, dom: dom });
  }

  YP.App = {
    DEFAULT_FONT_SIZE: DEFAULT_FONT_SIZE,
    DELETION_CONFIG: DELETION_CONFIG,
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
    handleDeletionKeydown: handleDeletionKeydown,
    triggerBackspaceIntervention: triggerBackspaceIntervention,
    triggerMassDeleteMeltdown: triggerMassDeleteMeltdown,
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
