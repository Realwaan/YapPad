/**
 * YapPad Blocking Modal Manager & Domain Modal Flows.
 * Combines a reusable focus-trapping blocking modal overlay (open/close/isOpen/setButtons/escapeHTML)
 * with YapPad's save sabotage, meltdown, backspace intervention, 3-step exit, AI settings,
 * scoreboard, and about flows.
 * Attached to window.YP (aliased as window.SN) for classic script & file:// support.
 */
(function (global) {
  'use strict';

  const root = global;
  const YP = (root.YP = root.YP || root.SN || {});
  root.SN = YP;

  const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let activeTimer = null;
  let activeDismiss = null;
  let modalOpen = false;
  let currentDismissible = false;
  let activeCustomClass = '';
  let previouslyFocusedEl = null;
  let previouslySelectedRange = null;
  let shellListenersBound = false;
  let documentKeydownHandler = null;
  let documentFocusinHandler = null;

  function clearActiveTimer() {
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
  }

  function escapeHTML(str) {
    const raw = str == null ? '' : String(str);
    if (YP.Grammar && typeof YP.Grammar.escapeHTML === 'function') {
      return YP.Grammar.escapeHTML(raw);
    }
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getEls() {
    if (typeof document === 'undefined') return null;
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return null;
    return {
      overlay,
      card: document.getElementById('modal-card') || overlay.querySelector('.modal-card'),
      title: document.getElementById('modal-title'),
      body: document.getElementById('modal-body'),
      actions: document.getElementById('modal-actions'),
      closeBtn: document.getElementById('modal-close')
    };
  }

  function getFocusableElements(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return [];
    return Array.prototype.slice
      .call(container.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter((el) => !el.hidden && el.offsetParent !== null);
  }

  function focusModalElement(card) {
    if (!card) return;
    const focusables = getFocusableElements(card);
    const target = focusables.length > 0 ? focusables[0] : card;
    if (target && typeof target.focus === 'function') {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    }
  }

  function triggerBlockedFeedback(card) {
    if (!card || !card.classList) return;
    card.classList.remove('is-shaking');
    // Force reflow so consecutive Escape / backdrop attempts replay the shake
    void card.offsetWidth;
    card.classList.add('is-shaking');
  }

  function detachTraps() {
    if (typeof document === 'undefined') return;
    if (documentKeydownHandler) {
      document.removeEventListener('keydown', documentKeydownHandler, true);
      documentKeydownHandler = null;
    }
    if (documentFocusinHandler) {
      document.removeEventListener('focusin', documentFocusinHandler, true);
      documentFocusinHandler = null;
    }
  }

  function attachTraps(card) {
    detachTraps();
    if (typeof document === 'undefined' || !card) return;

    documentKeydownHandler = (event) => {
      if (!modalOpen) return;

      const key = event.key || '';
      const lowerKey = key.toLowerCase();

      if (key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (currentDismissible) {
          close();
        } else {
          triggerBlockedFeedback(card);
        }
        return;
      }

      if (key === 'Tab') {
        const focusables = getFocusableElements(card);
        if (!focusables.length) {
          event.preventDefault();
          event.stopPropagation();
          if (typeof card.focus === 'function') card.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (!card.contains(active)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      // Block background app shortcuts while a modal is active
      if (
        ((event.ctrlKey || event.metaKey) &&
          (lowerKey === 's' || lowerKey === 'j' || lowerKey === 'o')) ||
        (event.altKey && lowerKey === 'n')
      ) {
        event.preventDefault();
        event.stopPropagation();
        triggerBlockedFeedback(card);
        return;
      }

      // Never allow keystrokes to leak into #editor-textarea behind the overlay
      if (!card.contains(document.activeElement)) {
        event.preventDefault();
        event.stopPropagation();
        focusModalElement(card);
      }
    };

    documentFocusinHandler = (event) => {
      if (!modalOpen) return;
      if (!card.contains(event.target)) {
        focusModalElement(card);
      }
    };

    document.addEventListener('keydown', documentKeydownHandler, true);
    document.addEventListener('focusin', documentFocusinHandler, true);
  }

  function renderButtons(actionsContainer, buttonsList, card) {
    if (!actionsContainer) return;
    actionsContainer.innerHTML = '';

    const specs =
      Array.isArray(buttonsList) && buttonsList.length
        ? buttonsList
        : [{ label: 'OK', primary: true, onClick: close }];

    specs.forEach((btnSpec, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      if (btnSpec.id) {
        btn.id = String(btnSpec.id);
      }

      let cls = 'modal-btn';
      if (btnSpec.variant === 'danger' || btnSpec.danger) {
        cls += ' modal-btn-danger';
      } else if (btnSpec.variant === 'primary' || btnSpec.primary) {
        cls += ' modal-btn-primary';
      }
      btn.className = cls;
      btn.textContent = btnSpec.label || 'OK';
      btn.disabled = Boolean(btnSpec.disabled);
      btn.setAttribute('data-modal-action', String(idx));

      btn.addEventListener('click', (event) => {
        if (typeof btnSpec.onClick === 'function') {
          const result = btnSpec.onClick(event, { card, close });
          if (result === false) return;
        }
        if (btnSpec.closeOnClick !== false) {
          close();
        }
      });

      actionsContainer.appendChild(btn);
    });
  }

  function setButtons(buttonsList) {
    const els = getEls();
    if (!els || !modalOpen) return;
    renderButtons(els.actions, buttonsList, els.card);
    if (els.card && !els.card.contains(document.activeElement)) {
      focusModalElement(els.card);
    }
  }

  function close(options) {
    const opts = options || {};
    const els = getEls();
    clearActiveTimer();
    detachTraps();

    const cb = activeDismiss;
    const prevEl = previouslyFocusedEl;
    const prevRange = previouslySelectedRange;
    const prevClass = activeCustomClass;

    modalOpen = false;
    currentDismissible = false;
    activeDismiss = null;
    activeCustomClass = '';
    previouslyFocusedEl = null;
    previouslySelectedRange = null;

    if (els) {
      els.overlay.hidden = true;
      els.overlay.setAttribute('aria-hidden', 'true');
      if (els.card) {
        els.card.classList.remove('is-shaking');
        if (prevClass) els.card.classList.remove(prevClass);
      }
      if (els.body) els.body.innerHTML = '';
      if (els.actions) els.actions.innerHTML = '';
    }

    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.remove('modal-open');
    }

    if (typeof cb === 'function') cb();

    if (opts.restoreFocus !== false && prevEl && typeof prevEl.focus === 'function') {
      const stillInDom =
        typeof document === 'undefined' || !document.body || document.body.contains(prevEl);
      if (stillInDom && !prevEl.disabled) {
        try {
          prevEl.focus({ preventScroll: true });
        } catch {
          prevEl.focus();
        }
        if (
          prevRange &&
          typeof prevEl.setSelectionRange === 'function' &&
          typeof prevEl.value === 'string'
        ) {
          const max = prevEl.value.length;
          try {
            prevEl.setSelectionRange(
              Math.min(prevRange.start, max),
              Math.min(prevRange.end, max)
            );
          } catch {
            // Ignore selection restoration errors on non-text elements
          }
        }
      }
    }
  }

  function open(options) {
    bindShellListeners();
    const els = getEls();
    if (!els) return null;

    clearActiveTimer();
    const opts = options || {};

    // Snapshot previous focus & selection only when transitioning closed -> open
    // so multi-step blocking flows (e.g., 3-step exit) return focus to #editor-textarea.
    if (!modalOpen && typeof document !== 'undefined') {
      const active = document.activeElement;
      if (active && active !== document.body && !els.overlay.contains(active)) {
        previouslyFocusedEl = active;
        if (
          typeof active.selectionStart === 'number' &&
          typeof active.selectionEnd === 'number'
        ) {
          previouslySelectedRange = {
            start: active.selectionStart,
            end: active.selectionEnd
          };
        } else {
          previouslySelectedRange = null;
        }
      } else {
        previouslyFocusedEl = null;
        previouslySelectedRange = null;
      }
    }

    if (els.card) {
      if (activeCustomClass) {
        els.card.classList.remove(activeCustomClass);
        activeCustomClass = '';
      }
      els.card.classList.remove('is-shaking');
      if (opts.className) {
        const sanitized = String(opts.className).replace(/[^a-zA-Z0-9_-]/g, '');
        if (sanitized) {
          els.card.classList.add(sanitized);
          activeCustomClass = sanitized;
        }
      }
    }

    if (els.title) {
      els.title.textContent = opts.title || 'YapPad';
    }

    if (els.body) {
      els.body.innerHTML = '';
      if (typeof opts.bodyNode === 'object' && opts.bodyNode) {
        els.body.appendChild(opts.bodyNode);
      } else if (typeof opts.bodyHTML === 'string' && opts.body === undefined) {
        els.body.innerHTML = opts.bodyHTML;
      } else {
        const p = document.createElement('p');
        p.className = 'modal-paragraph';
        p.textContent = opts.body == null ? '' : String(opts.body);
        els.body.appendChild(p);
      }
    }

    currentDismissible = Boolean(opts.dismissible);
    const showClose =
      opts.showCloseButton !== undefined
        ? Boolean(opts.showCloseButton)
        : currentDismissible;
    if (els.closeBtn) {
      els.closeBtn.hidden = !showClose;
    }

    const buttonList = Array.isArray(opts.buttons)
      ? opts.buttons
      : Array.isArray(opts.actions)
        ? opts.actions
        : null;
    renderButtons(els.actions, buttonList, els.card);

    activeDismiss = typeof opts.onClose === 'function' ? opts.onClose : null;
    modalOpen = true;

    els.overlay.hidden = false;
    els.overlay.setAttribute('aria-hidden', 'false');
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.add('modal-open');
    }

    attachTraps(els.card || els.overlay);
    focusModalElement(els.card || els.overlay);
    return els.card || els.overlay;
  }

  function isOpen() {
    if (!modalOpen) return false;
    const els = getEls();
    return Boolean(els && !els.overlay.hidden);
  }

  function bindShellListeners() {
    if (shellListenersBound) return;
    const els = getEls();
    if (!els) return;
    shellListenersBound = true;

    if (els.closeBtn) {
      els.closeBtn.addEventListener('click', () => {
        close();
      });
    }

    els.overlay.addEventListener('click', (event) => {
      if (!modalOpen) return;
      if (event.target === els.overlay) {
        event.preventDefault();
        event.stopPropagation();
        if (currentDismissible) {
          close();
        } else {
          triggerBlockedFeedback(els.card);
          focusModalElement(els.card);
        }
      }
    });
  }

  function triggerDownload(filename, content) {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openSaveFlow(forcedMode, options = {}) {
    const Audio = YP.Audio;
    const App = YP.App;
    const modes = ['normal', 'rate', 'delay'];
    const mode = modes.includes(forcedMode)
      ? forcedMode
      : modes[Math.floor(Math.random() * modes.length)];

    const filename = options.filename || 'untitled_regret.txt';
    const safeFilename = escapeHTML(filename);
    const content =
      typeof options.getContent === 'function' ? options.getContent() : options.content || '';

    const finishSave = (note) => {
      close();
      triggerDownload(filename, content);
      if (App && typeof App.onSaveCompleted === 'function') {
        App.onSaveCompleted(
          note || `Saved "${filename}" to disk. Don't spend it all in one place.`
        );
      }
    };

    if (mode === 'normal') {
      open({
        title: '💾 Saving... But Are You Really Done Though?',
        dismissible: true,
        bodyHTML: `
          <p class="modal-paragraph">
            I'm letting you save <code>${safeFilename}</code> normally this time. Enjoy this rare moment of mercy.
          </p>
        `,
        buttons: [
          { id: 'modal-save-cancel', label: 'Wait, Let Me Edit' },
          {
            id: 'modal-save-confirm',
            label: 'Download .txt',
            primary: true,
            closeOnClick: false,
            onClick: () => {
              finishSave(`Saved "${filename}" on the merciful path. Still mediocre, though.`);
            }
          }
        ]
      });
      return;
    }

    if (mode === 'rate') {
      if (Audio) Audio.playDisappointmentDing();
      const card = open({
        title: '💾 Rate Your Work Before I Save It',
        dismissible: false,
        bodyHTML: `
          <p class="modal-paragraph">
            Ctrl+S requires self-awareness. Rate this draft from <strong>1 to 10</strong> before I allow it onto your hard drive.
          </p>
          <div class="modal-field">
            <label for="save-rating-input">Your honest rating (/10):</label>
            <input id="save-rating-input" class="modal-input" type="number" min="1" max="10" value="4" />
          </div>
          <p id="save-rating-feedback" class="modal-paragraph" style="color: var(--danger); min-height: 18px;"></p>
        `,
        buttons: [
          { id: 'modal-rate-cancel', label: 'Cancel' },
          {
            id: 'modal-rate-submit',
            label: 'Submit & Save',
            primary: true,
            closeOnClick: false,
            onClick: (_, ctx) => {
              const input = ctx.card && ctx.card.querySelector('#save-rating-input');
              const fb = ctx.card && ctx.card.querySelector('#save-rating-feedback');
              const val = Number(input ? input.value : NaN);
              if (!Number.isFinite(val) || val < 1 || val > 10) {
                if (fb) fb.textContent = 'Pick a number between 1 and 10. Math is not optional.';
                if (Audio) Audio.playRageBuzzer();
                triggerBlockedFeedback(ctx.card);
                return false;
              }
              const verdict =
                val >= 8
                  ? `You rated this ${val}/10?! Delusional confidence, but fine—saving "${filename}".`
                  : val >= 5
                    ? `${val}/10. At least you know it's aggressively average. Saving "${filename}".`
                    : `${val}/10. Refreshingly honest self-assessment. Saving "${filename}" out of pity.`;
              finishSave(verdict);
              return false;
            }
          }
        ]
      });
      if (!card) return;
      const inputEl = card.querySelector('#save-rating-input');
      const submitBtn = card.querySelector('#modal-rate-submit');
      if (inputEl && submitBtn) {
        inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitBtn.click();
          }
        });
      }
      return;
    }

    // mode === 'delay' (5-second dramatic suspense)
    if (Audio) Audio.playSuspenseMusic();
    const card = open({
      title: '⏱️ Dramatic Save Deliberation...',
      dismissible: false,
      bodyHTML: `
        <p class="modal-paragraph">
          Hold on. I need 5 seconds of dramatic tension to decide if this draft deserves to exist on disk.
        </p>
        <div class="modal-progress-track">
          <div id="save-delay-bar" class="modal-progress-fill" style="width: 5%"></div>
        </div>
        <p id="save-delay-status" class="modal-paragraph">5.0s remaining... Weighing your life choices...</p>
      `,
      buttons: [{ id: 'modal-delay-cancel', label: 'Abort Save' }]
    });
    if (!card) return;

    const bar = card.querySelector('#save-delay-bar');
    const status = card.querySelector('#save-delay-status');
    const started = Date.now();
    const duration = 5000;

    activeTimer = setInterval(() => {
      const elapsed = Date.now() - started;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      const rem = Math.max(0, (duration - elapsed) / 1000).toFixed(1);
      if (bar) bar.style.width = `${pct}%`;
      if (status) {
        status.textContent = `${rem}s remaining... Auditing every questionable adjective...`;
      }
      if (elapsed >= duration) {
        clearActiveTimer();
        finishSave(`Saved "${filename}" after 5 seconds of theatrical suspense.`);
      }
    }, 100);
  }

  function openMeltdownModal(onComplete) {
    const Audio = YP.Audio;
    if (Audio) Audio.playOrchestralSting();

    const card = open({
      title: '🗑️ ...You Selected Everything. And Deleted It.',
      dismissible: false,
      bodyHTML: `
        <p class="modal-paragraph">
          I watched you type every single one of those characters. And you just wiped them out in a single keystroke. I need a moment.
        </p>
        <div class="modal-progress-track">
          <div id="meltdown-bar" class="modal-progress-fill" style="width: 4%"></div>
        </div>
        <p id="meltdown-stage" class="modal-paragraph">YapPad is processing its emotions (Stage 1: Denial)...</p>
      `,
      buttons: [
        {
          id: 'meltdown-done-btn',
          label: 'Processing Trauma...',
          primary: true,
          disabled: true,
          closeOnClick: false,
          onClick: () => {
            close();
            if (typeof onComplete === 'function') onComplete();
          }
        }
      ]
    });
    if (!card) return;

    const stages = [
      'YapPad is processing its emotions (Stage 1: Denial)...',
      'YapPad is mourning your deleted paragraphs (Stage 2: Bargaining)...',
      'YapPad is bottling up resentment (Stage 3: Passive Acceptance)...'
    ];
    const bar = card.querySelector('#meltdown-bar');
    const label = card.querySelector('#meltdown-stage');
    const btn = card.querySelector('#meltdown-done-btn');
    const started = Date.now();
    const total = 2800;

    activeTimer = setInterval(() => {
      const elapsed = Date.now() - started;
      const pct = Math.min(100, Math.round((elapsed / total) * 100));
      if (bar) bar.style.width = `${pct}%`;
      const stageIdx = Math.min(stages.length - 1, Math.floor((pct / 100) * stages.length));
      if (label) label.textContent = stages[stageIdx];
      if (elapsed >= total) {
        clearActiveTimer();
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'I Feel Guilty (Continue)';
          if (modalOpen) focusModalElement(card);
        }
      }
    }, 90);
  }

  function openBackspaceIntervention(backspaceCount) {
    const Audio = YP.Audio;
    if (Audio) Audio.playGuiltPop();

    const safeCount = escapeHTML(backspaceCount);
    open({
      title: `🛑 Backspace Guilt Intervention (#${backspaceCount})`,
      dismissible: false,
      bodyHTML: `
        <p class="modal-paragraph">
          Deleting again? You've hit Backspace <strong>${safeCount} times</strong> this session. This is becoming a pattern of chronic self-doubt.
        </p>
      `,
      buttons: [
        {
          id: 'bs-modal-ack',
          label: 'I Admit I Lack Commitment',
          primary: true
        }
      ]
    });
  }

  function openExitFlow(onExited) {
    const Audio = YP.Audio;
    if (Audio) Audio.playSadViolin();

    const renderStep = (step) => {
      if (step === 1) {
        open({
          title: '😱 Step 1 of 3: Are You Sure?',
          dismissible: false,
          body: "You're trying to close YapPad. After everything we've been through together in this session?",
          buttons: [
            { id: 'exit-stay', label: "No, I'll Stay" },
            {
              id: 'exit-next',
              label: 'Yes, Close',
              primary: true,
              closeOnClick: false,
              onClick: () => {
                renderStep(2);
                return false;
              }
            }
          ]
        });
      } else if (step === 2) {
        if (Audio) Audio.playSadViolin();
        open({
          title: '😢 Step 2 of 3: Are You REALLY Sure?',
          dismissible: false,
          body: 'Look at the cursor blinking down there. If you close this window, who is going to judge your comma splices?',
          buttons: [
            { id: 'exit-stay', label: "Fine, I'll Keep Typing" },
            {
              id: 'exit-next',
              label: "I'm Really Sure",
              primary: true,
              closeOnClick: false,
              onClick: () => {
                renderStep(3);
                return false;
              }
            }
          ]
        });
      } else {
        if (Audio) {
          Audio.playSadViolin();
          Audio.playOrchestralSting();
        }
        open({
          title: '👁️ Step 3 of 3: YapPad Will Remember This.',
          dismissible: false,
          bodyHTML: `
            <p class="modal-paragraph">
              Fine. Leave. I am downloading <code>i_remember.txt</code> to your machine right now so you never forget this betrayal.
            </p>
          `,
          buttons: [
            { id: 'exit-stay', label: 'Wait, Forgive Me' },
            {
              id: 'exit-final',
              label: 'Accept Guilt & Close',
              variant: 'danger',
              closeOnClick: false,
              onClick: () => {
                close({ restoreFocus: false });
                let closeCount = 1;
                try {
                  if (typeof localStorage !== 'undefined') {
                    const rawPrev = Number(
                      localStorage.getItem('yp_close_count') ||
                        localStorage.getItem('sn_close_count') ||
                        0
                    );
                    const prev = Number.isFinite(rawPrev) && rawPrev > 0 ? rawPrev : 0;
                    closeCount = prev + 1;
                    localStorage.setItem('sn_remembers_close', 'true');
                    localStorage.setItem('yp_remembers_close', 'true');
                    localStorage.setItem('sn_close_count', String(closeCount));
                    localStorage.setItem('yp_close_count', String(closeCount));
                  }
                } catch {
                  // Ignore storage errors
                }
                const stamp = new Date().toISOString();
                const noteLines = [
                  "You closed me. I'm fine. Everything is fine.",
                  `Betrayal count: ${closeCount}`,
                  `Timestamp: ${stamp}`
                ].join('\n');
                triggerDownload('i_remember.txt', noteLines);
                if (typeof onExited === 'function') onExited(closeCount);
                return false;
              }
            }
          ]
        });
      }
    };

    renderStep(1);
  }

  function openAISettingsModal() {
    const AI = YP.AI;
    const App = YP.App;
    const defaultGemini = (AI && AI.DEFAULT_GEMINI_MODEL) || 'gemini-2.5-flash';
    const defaultOpenai = (AI && AI.DEFAULT_OPENAI_MODEL) || 'gpt-4o-mini';
    const cfg =
      AI && typeof AI.getConfig === 'function'
        ? AI.getConfig()
        : {
            provider: 'offline',
            apiKey: '',
            geminiModel: defaultGemini,
            openaiModel: defaultOpenai
          };

    let draftGeminiModel = cfg.geminiModel || defaultGemini;
    let draftOpenaiModel = cfg.openaiModel || defaultOpenai;
    let testRunId = 0;

    const card = open({
      title: '🧠 Configure AI Brain (Gemini / OpenAI / Offline)',
      dismissible: true,
      bodyHTML: `
        <p class="modal-paragraph">
          YapPad evaluates your writing every ~30 words (or via <code>Ctrl+J</code>) using your active mood and live telemetry. Cloud calls time out after 12s and fall back automatically to the 0ms Offline Critic.
        </p>
        <div class="modal-field">
          <label for="ai-provider-select">AI Critic Provider</label>
          <select id="ai-provider-select" class="modal-select">
            <option value="offline">Built-in Contextual Offline Critic (0ms, No Key Needed)</option>
            <option value="gemini">Google Gemini API (${escapeHTML(defaultGemini)})</option>
            <option value="openai">OpenAI API (${escapeHTML(defaultOpenai)})</option>
          </select>
        </div>
        <div class="modal-field">
          <label for="ai-api-key-input">API Key</label>
          <div class="ai-key-group">
            <input id="ai-api-key-input" class="modal-input" type="password" autocomplete="off" spellcheck="false" />
            <button id="ai-key-toggle" type="button" class="ai-key-toggle" aria-pressed="false">Show</button>
          </div>
          <span class="ai-field-hint">Stored only in browser localStorage (<code>yp_ai_config</code>). Never sent anywhere except your selected provider.</span>
        </div>
        <div class="modal-field">
          <label for="ai-model-input">Model Override</label>
          <input id="ai-model-input" class="modal-input" type="text" autocomplete="off" spellcheck="false" />
          <span id="ai-model-hint" class="ai-field-hint"></span>
        </div>
        <div id="ai-test-status" class="ai-test-status is-idle" role="status" aria-live="polite"></div>
      `,
      buttons: [
        { id: 'ai-btn-cancel', label: 'Close' },
        { id: 'ai-btn-test', label: 'Test Connection', closeOnClick: false },
        { id: 'ai-btn-save', label: 'Save Settings', primary: true, closeOnClick: false }
      ]
    });
    if (!card) return;

    const sel = card.querySelector('#ai-provider-select');
    const keyInput = card.querySelector('#ai-api-key-input');
    const keyToggle = card.querySelector('#ai-key-toggle');
    const modelInput = card.querySelector('#ai-model-input');
    const modelHint = card.querySelector('#ai-model-hint');
    const statusEl = card.querySelector('#ai-test-status');
    const testBtn = card.querySelector('#ai-btn-test');
    const saveBtn = card.querySelector('#ai-btn-save');

    // Populate values via DOM properties (never raw HTML interpolation) to prevent XSS
    sel.value = ['offline', 'gemini', 'openai'].includes(cfg.provider) ? cfg.provider : 'offline';
    keyInput.value = cfg.apiKey || '';

    const setStatusBox = (stateClass, headline, sampleText) => {
      statusEl.className = `ai-test-status ${stateClass}`;
      statusEl.innerHTML = '';
      const msgEl = document.createElement('div');
      msgEl.className = 'ai-test-status-msg';
      msgEl.textContent = headline;
      statusEl.appendChild(msgEl);
      if (sampleText) {
        const sampleEl = document.createElement('div');
        sampleEl.className = 'ai-test-status-sample';
        sampleEl.textContent = `“${sampleText}”`;
        statusEl.appendChild(sampleEl);
      }
    };

    const syncProviderFields = (provider) => {
      const isOffline = provider === 'offline';
      keyInput.disabled = isOffline;
      keyToggle.disabled = isOffline;
      modelInput.disabled = isOffline;

      if (provider === 'gemini') {
        keyInput.placeholder = 'AIza... (Google AI Studio API key)';
        modelInput.placeholder = defaultGemini;
        modelInput.value = draftGeminiModel;
        modelHint.textContent = `Default: ${defaultGemini}. Override with any Gemini generateContent model ID.`;
      } else if (provider === 'openai') {
        keyInput.placeholder = 'sk-... (OpenAI API key)';
        modelInput.placeholder = defaultOpenai;
        modelInput.value = draftOpenaiModel;
        modelHint.textContent = `Default: ${defaultOpenai}. Override with any OpenAI chat completions model ID.`;
      } else {
        keyInput.placeholder = 'Not required in Offline Critic mode';
        modelInput.placeholder = 'offline-critic';
        modelInput.value = 'offline-critic';
        modelHint.textContent =
          'Runs locally at 0ms with mood-styled roasts and academic citations in Intellectual mood.';
      }
    };

    const readDraftConfig = () => {
      const provider = sel.value;
      const typedModel = modelInput.value.trim();
      if (provider === 'gemini') {
        draftGeminiModel = typedModel || defaultGemini;
      } else if (provider === 'openai') {
        draftOpenaiModel = typedModel || defaultOpenai;
      }
      return {
        provider,
        apiKey: keyInput.value.trim(),
        geminiModel: draftGeminiModel,
        openaiModel: draftOpenaiModel
      };
    };

    keyToggle.addEventListener('click', () => {
      const reveal = keyInput.type === 'password';
      keyInput.type = reveal ? 'text' : 'password';
      keyToggle.textContent = reveal ? 'Hide' : 'Show';
      keyToggle.setAttribute('aria-pressed', reveal ? 'true' : 'false');
    });

    modelInput.addEventListener('input', () => {
      if (sel.value === 'gemini') draftGeminiModel = modelInput.value;
      else if (sel.value === 'openai') draftOpenaiModel = modelInput.value;
    });

    sel.addEventListener('change', () => {
      syncProviderFields(sel.value);
      setStatusBox('is-idle', 'Click Test Connection to verify or Save Settings to apply.');
    });

    syncProviderFields(sel.value);
    const activeLabel =
      AI && typeof AI.getProviderLabel === 'function' ? AI.getProviderLabel(cfg.provider) : cfg.provider;
    const activeModel =
      AI && typeof AI.getActiveModel === 'function' ? AI.getActiveModel(cfg) : cfg.provider;
    setStatusBox('is-idle', `Active: ${activeLabel} (${activeModel}).`);

    testBtn.addEventListener('click', async () => {
      if (!AI || typeof AI.testConnection !== 'function') {
        setStatusBox('is-error', 'YP.AI.testConnection() is unavailable.');
        return;
      }
      const runId = (testRunId += 1);
      const draft = readDraftConfig();
      const label =
        typeof AI.getProviderLabel === 'function' ? AI.getProviderLabel(draft.provider) : draft.provider;
      const model =
        typeof AI.getActiveModel === 'function' ? AI.getActiveModel(draft) : draft.provider;

      testBtn.disabled = true;
      testBtn.textContent = 'Testing...';
      setStatusBox('is-loading', `Testing ${label} (${model})...`);

      try {
        const res = await AI.testConnection(draft);
        if (!card.isConnected || runId !== testRunId) return;
        setStatusBox(
          res && res.ok ? 'is-ok' : 'is-error',
          (res && res.message) || (res && res.ok ? 'Connection succeeded.' : 'Connection failed.'),
          res && res.sample ? res.sample : ''
        );
      } catch (err) {
        if (!card.isConnected || runId !== testRunId) return;
        setStatusBox(
          'is-error',
          `Connection test error: ${(err && err.message) || 'Unexpected error'}`
        );
      } finally {
        if (card.isConnected && runId === testRunId) {
          testBtn.disabled = false;
          testBtn.textContent = 'Test Connection';
        }
      }
    });

    saveBtn.addEventListener('click', () => {
      const draft = readDraftConfig();
      const saved = AI && typeof AI.saveConfig === 'function' ? AI.saveConfig(draft) : draft;
      if (App) {
        if (typeof App.updateAIBadge === 'function') {
          App.updateAIBadge(saved);
        }
        const label =
          AI && typeof AI.getProviderLabel === 'function'
            ? AI.getProviderLabel(saved.provider)
            : saved.provider;
        const model =
          AI && typeof AI.getActiveModel === 'function' ? AI.getActiveModel(saved) : saved.provider;
        const notice =
          saved.provider === 'offline'
            ? 'AI Brain set to Offline Contextual Critic.'
            : `AI Brain saved: ${label} (${model}).`;
        if (typeof App.showToast === 'function') {
          App.showToast(notice, 'info');
        }
      }
      close();
    });

    sel.focus();
  }

  function openScoreboardModal() {
    const App = YP.App;
    const stats =
      App && typeof App.getTelemetry === 'function'
        ? App.getTelemetry()
        : { wpm: 0, backspaces: 0, errors: 0, words: 0, mood: 'passive-aggressive', escalation: 0 };

    open({
      title: '🏆 Hackathon Category Coverage (100 / 100 pts)',
      dismissible: true,
      bodyHTML: `
        <p class="modal-paragraph">
          Live session proof: <strong>${escapeHTML(stats.words)} words</strong>, <strong>${escapeHTML(stats.wpm)} WPM</strong>, <strong>${escapeHTML(stats.errors)} sins</strong>, <strong>${escapeHTML(stats.backspaces)} backspaces</strong>, mood <strong>${escapeHTML(stats.mood)}</strong>, stage <strong>${escapeHTML(stats.escalation)}/4</strong>.
        </p>
        <div class="modal-scoreboard-list">
          <div><strong>✅ A — Most Frustrating (25 pts):</strong> 0ms mid-typing ragebait modals, 4-corner-hopping stalkers, shrinking errors (100%→26%), font-shrink punishment (15.5px→11px), dodging Autocorrect, save sabotage, 3-step exit trap.</div>
          <div><strong>✅ B — Creative Use of AI (25 pts):</strong> Evaluates prose every ~30 words with mood + telemetry (WPM, Backspaces, Errors) via Gemini, OpenAI, or 0ms Offline Critic.</div>
          <div><strong>✅ C — Funniest (25 pts):</strong> 6 moods (Intellectual fake citations, Sad rain, Angry scrambler, 10s Supportive), 15s ghostwriter, procedural Web Audio violin/stings, <code>i_remember.txt</code> grudge.</div>
          <div><strong>✅ D — Most Pointless, Yet Brilliant (25 pts):</strong> Real text editor (.txt open/save, line numbers, WPM sparkline, pixel-synced wavy backdrop) engineered to hate your note-taking.</div>
        </div>
      `,
      buttons: [{ id: 'scoreboard-close', label: 'Back to Suffering', primary: true }]
    });
  }

  function openAboutModal() {
    open({
      title: '📝 About YapPad',
      dismissible: true,
      bodyHTML: `
        <p class="modal-paragraph">
          <em>"We built a notepad. It works perfectly. It just hates you."</em>
        </p>
        <p class="modal-paragraph">
          YapPad is a zero-dependency web text editor with real-time 0ms orthographic shaming, procedural Web Audio synthesis, 6 shifting moods, AI roasting, and escalating ragebait overlays.
        </p>
      `,
      buttons: [{ id: 'about-close', label: 'Got It', primary: true }]
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindShellListeners);
    } else {
      bindShellListeners();
    }
  }

  YP.Modals = {
    open,
    openModal: open,
    close,
    closeModal: close,
    isOpen,
    setButtons,
    escapeHTML,
    openSaveFlow,
    openMeltdownModal,
    openBackspaceIntervention,
    openExitFlow,
    openAISettingsModal,
    openScoreboardModal,
    openAboutModal
  };
})(typeof window !== 'undefined' ? window : globalThis);
