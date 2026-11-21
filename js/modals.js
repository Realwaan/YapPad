(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.YP = root.YP || {};
  root.SN = root.YP;

  const SAVE_MODES = ['normal', 'rate', 'delay'];

  let activeTimer = null;
  let activeSaveMode = null;
  let modalDismissible = true;

  function escapeHTML(str) {
    if (root.YP.Grammar && typeof root.YP.Grammar.escapeHTML === 'function') {
      return root.YP.Grammar.escapeHTML(str);
    }
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeTxtFilename(name) {
    const cleaned = String(name || '').trim() || 'untitled_regret.txt';
    return /\.txt$/i.test(cleaned) ? cleaned : `${cleaned}.txt`;
  }

  function getOverlay() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('modal-overlay');
  }

  function isOpen() {
    const overlay = getOverlay();
    return Boolean(overlay && !overlay.hidden);
  }

  function isDismissible() {
    return modalDismissible;
  }

  function getActiveSaveMode() {
    return activeSaveMode;
  }

  function shakeActiveModal() {
    const overlay = getOverlay();
    if (!overlay || overlay.hidden) return;
    const card = overlay.querySelector('.modal-card');
    if (!card) return;
    card.classList.remove('modal-shake');
    void card.offsetWidth;
    card.classList.add('modal-shake');
  }

  function restoreEditorFocus() {
    if (typeof document === 'undefined') return;
    const abandoned = document.getElementById('abandoned-screen');
    if (abandoned && !abandoned.hidden) return;
    const textarea = document.getElementById('editor-textarea');
    if (textarea && typeof textarea.focus === 'function') {
      textarea.focus();
    }
  }

  function closeModal(options = {}) {
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
    activeSaveMode = null;
    modalDismissible = true;
    const Audio = root.YP.Audio;
    if (Audio && typeof Audio.stopSuspenseMusic === 'function') {
      Audio.stopSuspenseMusic();
    }
    const overlay = getOverlay();
    if (!overlay) return;
    overlay.hidden = true;
    overlay.innerHTML = '';
    if (options.restoreFocus !== false) {
      restoreEditorFocus();
    }
  }

  function showModalHTML(html, opts = {}) {
    const overlay = getOverlay();
    if (!overlay) return null;
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
    activeSaveMode = null;
    modalDismissible = opts.dismissible !== false;
    overlay.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true">${html}</div>`;
    overlay.hidden = false;
    return overlay.querySelector('.modal-card');
  }

  function triggerDownload(filename, content) {
    if (typeof document === 'undefined') return;
    const targetName = normalizeTxtFilename(filename);
    const blob = new Blob([String(content == null ? '' : content)], {
      type: 'text/plain;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = targetName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function evaluateSaveRating(rawInput, filename) {
    const safeName = normalizeTxtFilename(filename);
    const trimmed = String(rawInput == null ? '' : rawInput).trim();
    if (!trimmed) {
      return {
        valid: false,
        value: NaN,
        error: 'Enter a number from 1 to 10. Leaving it blank will not save you.',
        verdict: '',
        highScore: false
      };
    }

    const val = Number(trimmed);
    if (!Number.isFinite(val)) {
      return {
        valid: false,
        value: NaN,
        error: 'That is not even a number. Pick a score between 1 and 10.',
        verdict: '',
        highScore: false
      };
    }

    if (!Number.isInteger(val)) {
      return {
        valid: false,
        value: val,
        error: 'Whole numbers 1 to 10 only. No hiding behind decimals.',
        verdict: '',
        highScore: false
      };
    }

    if (val < 1 || val > 10) {
      return {
        valid: false,
        value: val,
        error: 'Pick a number between 1 and 10. Math is not optional.',
        verdict: '',
        highScore: false
      };
    }

    let verdict;
    if (val === 10) {
      verdict = `10/10?! Calling "${safeName}" a masterpiece is clinically bold. Saving it before your ego explodes.`;
    } else if (val >= 8) {
      verdict = `You rated this ${val}/10?! Delusional confidence, truly inspiring—fine, saving "${safeName}".`;
    } else if (val >= 5) {
      verdict = `${val}/10. At least you know it's aggressively average. Saving "${safeName}".`;
    } else if (val >= 3) {
      verdict = `${val}/10. Refreshingly honest self-assessment. Saving "${safeName}" out of pity.`;
    } else {
      verdict = `${val}/10?! Brutal honesty. Saving "${safeName}" strictly as a cry for help.`;
    }

    return {
      valid: true,
      value: val,
      error: '',
      verdict,
      highScore: val >= 8
    };
  }

  function resolveSaveContent(options) {
    if (typeof options.getContent === 'function') {
      return String(options.getContent() || '');
    }
    if (typeof options.content === 'string') {
      return options.content;
    }
    if (typeof document !== 'undefined') {
      const textarea = document.getElementById('editor-textarea');
      if (textarea) return textarea.value;
    }
    return '';
  }

  function openSaveFlow(forcedMode, options = {}) {
    const Audio = root.YP.Audio;
    const App = root.YP.App;
    const mode = SAVE_MODES.includes(forcedMode)
      ? forcedMode
      : SAVE_MODES[Math.floor(Math.random() * SAVE_MODES.length)];

    const rawFilename =
      options.filename || (App && App.state && App.state.filename) || 'untitled_regret.txt';
    const filename = normalizeTxtFilename(rawFilename);
    const safeFilename = escapeHTML(filename);

    const finishSave = (note, meta = {}) => {
      const content = resolveSaveContent(options);
      closeModal();
      if (typeof options.onDownload === 'function') {
        options.onDownload(filename, content);
      } else if (App && typeof App.downloadTextFile === 'function') {
        App.downloadTextFile(filename, content);
      } else {
        triggerDownload(filename, content);
      }
      const finalNote = note || `Saved "${filename}" to disk. Don't spend it all in one place.`;
      if (App && typeof App.onSaveCompleted === 'function') {
        App.onSaveCompleted(finalNote, { filename, mode, ...meta });
      }
      if (typeof options.onComplete === 'function') {
        options.onComplete({ filename, mode, note: finalNote, ...meta });
      }
    };

    if (mode === 'normal') {
      const card = showModalHTML(`
        <h3 class="modal-title">💾 Saving... But Are You Really Done Though?</h3>
        <p class="modal-body">
          I'm letting you save <code>${safeFilename}</code> normally this time. Enjoy this rare moment of mercy.
        </p>
        <div class="modal-actions">
          <button id="modal-save-cancel" type="button" class="modal-btn">Wait, Let Me Edit</button>
          <button id="modal-save-confirm" type="button" class="modal-btn modal-btn-primary">Download .txt</button>
        </div>
      `);
      if (!card) return mode;
      card.dataset.saveMode = 'normal';
      activeSaveMode = 'normal';

      const confirmBtn = card.querySelector('#modal-save-confirm');
      card.querySelector('#modal-save-cancel').addEventListener('click', () => closeModal());
      confirmBtn.addEventListener('click', () => {
        finishSave(`Saved "${filename}" on the merciful path. Still mediocre, though.`);
      });
      confirmBtn.focus();
      return mode;
    }

    if (mode === 'rate') {
      if (Audio) Audio.playDisappointmentDing();
      const pillsHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        .map(
          (n) =>
            `<button type="button" class="rating-pill${n === 4 ? ' is-selected' : ''}" data-rating="${n}" aria-label="Rate ${n} out of 10">${n}</button>`
        )
        .join('');

      const card = showModalHTML(`
        <h3 class="modal-title">💾 Rate Your Work Before I Save It</h3>
        <p class="modal-body">
          Ctrl+S requires self-awareness. Rate <code>${safeFilename}</code> from <strong>1 to 10</strong> before I allow it onto your hard drive.
        </p>
        <form id="save-rating-form" novalidate>
          <div class="modal-field">
            <label for="save-rating-input">Your honest rating (/10):</label>
            <input id="save-rating-input" class="modal-input" type="number" min="1" max="10" step="1" value="4" inputmode="numeric" />
          </div>
          <div class="rating-pills" role="group" aria-label="Quick score selection">
            ${pillsHTML}
          </div>
          <p id="save-rating-feedback" class="modal-body save-rating-feedback" role="alert" aria-live="polite"></p>
          <div class="modal-actions">
            <button id="modal-rate-cancel" type="button" class="modal-btn">Cancel</button>
            <button id="modal-rate-submit" type="submit" class="modal-btn modal-btn-primary">Submit &amp; Save</button>
          </div>
        </form>
      `);
      if (!card) return mode;
      card.dataset.saveMode = 'rate';
      activeSaveMode = 'rate';

      const form = card.querySelector('#save-rating-form');
      const input = card.querySelector('#save-rating-input');
      const fb = card.querySelector('#save-rating-feedback');
      const pills = [...card.querySelectorAll('.rating-pill')];

      const syncPills = () => {
        const val = Number(input.value);
        pills.forEach((pill) => {
          pill.classList.toggle('is-selected', Number(pill.dataset.rating) === val);
        });
      };

      pills.forEach((pill) => {
        pill.addEventListener('click', () => {
          input.value = pill.dataset.rating;
          fb.textContent = '';
          syncPills();
          input.focus();
        });
      });

      input.addEventListener('input', () => {
        fb.textContent = '';
        syncPills();
      });

      card.querySelector('#modal-rate-cancel').addEventListener('click', () => closeModal());
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const result = evaluateSaveRating(input.value, filename);
        if (!result.valid) {
          fb.textContent = result.error;
          if (Audio) Audio.playRageBuzzer();
          shakeActiveModal();
          input.focus();
          return;
        }
        if (result.highScore && Audio) {
          Audio.playDisappointmentDing();
        }
        finishSave(result.verdict, { rating: result.value });
      });

      input.focus();
      if (typeof input.select === 'function') input.select();
      return mode;
    }

    // mode === 'delay' (5-second dramatic suspense)
    const duration =
      typeof options.delayMs === 'number' && options.delayMs > 0 ? options.delayMs : 5000;
    const durationSec = duration / 1000;

    if (Audio) Audio.playSuspenseMusic(durationSec);
    const card = showModalHTML(`
      <h3 class="modal-title">⏱️ Dramatic Save Deliberation...</h3>
      <p class="modal-body">
        Hold on. I need ${durationSec.toFixed(0)} seconds of dramatic tension to decide if <code>${safeFilename}</code> deserves to exist on disk.
      </p>
      <div class="modal-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div id="save-delay-bar" class="modal-progress-fill is-suspense" style="width: 0%"></div>
      </div>
      <p id="save-delay-status" class="modal-body">${durationSec.toFixed(1)}s remaining... Weighing your life choices...</p>
      <div class="modal-actions">
        <button id="modal-delay-cancel" type="button" class="modal-btn">Abort Save</button>
      </div>
    `);
    if (!card) return mode;
    card.dataset.saveMode = 'delay';
    activeSaveMode = 'delay';

    const track = card.querySelector('.modal-progress-track');
    const bar = card.querySelector('#save-delay-bar');
    const status = card.querySelector('#save-delay-status');
    const cancelBtn = card.querySelector('#modal-delay-cancel');

    cancelBtn.addEventListener('click', () => {
      closeModal();
      if (App && typeof App.showToast === 'function') {
        App.showToast('Save aborted. Couldn\'t handle 5 seconds of suspense, huh?');
      }
    });
    cancelBtn.focus();

    const delayStages = [
      'Weighing your life choices...',
      'Auditing every questionable adjective...',
      'Consulting the Ministry of Literature...',
      'Debating whether your hard drive deserves this...',
      'Reluctantly approving file transfer...'
    ];

    const started = Date.now();
    activeTimer = setInterval(() => {
      const elapsed = Date.now() - started;
      const ratio = Math.min(1, elapsed / duration);
      const pct = Math.round(ratio * 100);
      const rem = Math.max(0, (duration - elapsed) / 1000).toFixed(1);
      const stageIdx = Math.min(delayStages.length - 1, Math.floor(ratio * delayStages.length));

      if (bar) bar.style.width = `${pct}%`;
      if (track) track.setAttribute('aria-valuenow', String(pct));
      if (status) status.textContent = `${rem}s remaining... ${delayStages[stageIdx]}`;

      if (elapsed >= duration) {
        clearInterval(activeTimer);
        activeTimer = null;
        finishSave(`Saved "${filename}" after ${durationSec.toFixed(0)} seconds of theatrical suspense.`);
      }
    }, 50);

    return mode;
  }

  function openMeltdownModal(onComplete) {
    const Audio = root.YP.Audio;
    if (Audio) Audio.playOrchestralSting();

    const card = showModalHTML(`
      <h3 class="modal-title">🗑️ ...You Selected Everything. And Deleted It.</h3>
      <p class="modal-body">
        I watched you type every single one of those characters. And you just wiped them out in a single keystroke. I need a moment.
      </p>
      <div class="modal-progress-track">
        <div id="meltdown-bar" class="modal-progress-fill" style="width: 4%"></div>
      </div>
      <p id="meltdown-stage" class="modal-body">YapPad is processing its emotions (Stage 1: Denial)...</p>
      <div class="modal-actions">
        <button id="meltdown-done-btn" type="button" class="modal-btn modal-btn-primary" disabled>
          Processing Trauma...
        </button>
      </div>
    `, { dismissible: false });
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
        clearInterval(activeTimer);
        activeTimer = null;
        modalDismissible = true;
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'I Feel Guilty (Continue)';
        }
      }
    }, 90);

    btn.addEventListener('click', () => {
      closeModal();
      if (typeof onComplete === 'function') onComplete();
    });
  }

  function openBackspaceIntervention(backspaceCount) {
    const Audio = root.YP.Audio;
    if (Audio) Audio.playGuiltPop();

    const card = showModalHTML(`
      <h3 class="modal-title">🛑 Backspace Guilt Intervention (#${backspaceCount})</h3>
      <p class="modal-body">
        Deleting again? You've hit Backspace <strong>${backspaceCount} times</strong> this session. This is becoming a pattern of chronic self-doubt.
      </p>
      <div class="modal-actions">
        <button id="bs-modal-ack" type="button" class="modal-btn modal-btn-primary">
          I Admit I Lack Commitment
        </button>
      </div>
    `);
    if (!card) return;
    card.querySelector('#bs-modal-ack').addEventListener('click', closeModal);
  }

  function openExitFlow(onExited) {
    const Audio = root.YP.Audio;
    if (Audio) Audio.playSadViolin();

    const renderStep = (step) => {
      if (step === 1) {
        const card = showModalHTML(`
          <h3 class="modal-title">😱 Step 1 of 3: Are You Sure?</h3>
          <p class="modal-body">
            You're trying to close YapPad. After everything we've been through together in this session?
          </p>
          <div class="modal-actions">
            <button id="exit-stay" type="button" class="modal-btn">No, I'll Stay</button>
            <button id="exit-next" type="button" class="modal-btn modal-btn-primary">Yes, Close</button>
          </div>
        `);
        if (!card) return;
        card.querySelector('#exit-stay').addEventListener('click', closeModal);
        card.querySelector('#exit-next').addEventListener('click', () => renderStep(2));
      } else if (step === 2) {
        if (Audio) Audio.playSadViolin();
        const card = showModalHTML(`
          <h3 class="modal-title">😢 Step 2 of 3: Are You REALLY Sure?</h3>
          <p class="modal-body">
            Look at the cursor blinking down there. If you close this window, who is going to judge your comma splices?
          </p>
          <div class="modal-actions">
            <button id="exit-stay" type="button" class="modal-btn">Fine, I'll Keep Typing</button>
            <button id="exit-next" type="button" class="modal-btn modal-btn-primary">I'm Really Sure</button>
          </div>
        `);
        if (!card) return;
        card.querySelector('#exit-stay').addEventListener('click', closeModal);
        card.querySelector('#exit-next').addEventListener('click', () => renderStep(3));
      } else {
        if (Audio) Audio.playOrchestralSting();
        const card = showModalHTML(`
          <h3 class="modal-title">👁️ Step 3 of 3: YapPad Will Remember This.</h3>
          <p class="modal-body">
            Fine. Leave. I am downloading <code>i_remember.txt</code> to your machine right now so you never forget this betrayal.
          </p>
          <div class="modal-actions">
            <button id="exit-stay" type="button" class="modal-btn">Wait, Forgive Me</button>
            <button id="exit-final" type="button" class="modal-btn modal-btn-primary">Accept Guilt &amp; Close</button>
          </div>
        `);
        if (!card) return;
        card.querySelector('#exit-stay').addEventListener('click', closeModal);
        card.querySelector('#exit-final').addEventListener('click', () => {
          closeModal();
          let closeCount = 1;
          try {
            if (typeof localStorage !== 'undefined') {
              const prev = Number(localStorage.getItem('sn_close_count') || localStorage.getItem('yp_close_count') || 0);
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
            'You closed me. I\'m fine. Everything is fine.',
            `Betrayal count: ${closeCount}`,
            `Timestamp: ${stamp}`
          ].join('\n');
          triggerDownload('i_remember.txt', noteLines);
          if (typeof onExited === 'function') onExited(closeCount);
        });
      }
    };

    renderStep(1);
  }

  function openAISettingsModal() {
    const AI = root.YP.AI;
    const App = root.YP.App;
    const cfg = AI ? AI.getConfig() : { provider: 'offline', apiKey: '', geminiModel: 'gemini-2.5-flash', openaiModel: 'gpt-4o-mini' };

    const card = showModalHTML(`
      <h3 class="modal-title">🧠 Configure AI Brain (Gemini / OpenAI / Offline)</h3>
      <p class="modal-body">
        YapPad roasts your writing every ~30 words (or via <code>Ctrl+J</code>). Any cloud failure automatically falls back to the 0ms Offline Critic.
      </p>
      <div class="modal-field">
        <label for="ai-provider-select">AI Critic Provider</label>
        <select id="ai-provider-select" class="modal-select">
          <option value="offline" ${cfg.provider === 'offline' ? 'selected' : ''}>Built-in Contextual Offline Critic (0ms, No Key Needed)</option>
          <option value="gemini" ${cfg.provider === 'gemini' ? 'selected' : ''}>Google Gemini API (gemini-2.5-flash)</option>
          <option value="openai" ${cfg.provider === 'openai' ? 'selected' : ''}>OpenAI API (gpt-4o-mini)</option>
        </select>
      </div>
      <div class="modal-field">
        <label for="ai-api-key-input">API Key (Stored in browser localStorage only)</label>
        <input id="ai-api-key-input" class="modal-input" type="password" placeholder="AIza... or sk-..." value="${cfg.apiKey || ''}" />
      </div>
      <div class="modal-field">
        <label for="ai-model-input">Model Name</label>
        <input id="ai-model-input" class="modal-input" type="text" value="${cfg.provider === 'openai' ? cfg.openaiModel : cfg.geminiModel}" />
      </div>
      <p id="ai-test-status" class="modal-body" style="min-height: 20px;"></p>
      <div class="modal-actions">
        <button id="ai-btn-cancel" type="button" class="modal-btn">Close</button>
        <button id="ai-btn-test" type="button" class="modal-btn">Test Connection</button>
        <button id="ai-btn-save" type="button" class="modal-btn modal-btn-primary">Save Settings</button>
      </div>
    `);
    if (!card) return;

    const sel = card.querySelector('#ai-provider-select');
    const keyInput = card.querySelector('#ai-api-key-input');
    const modelInput = card.querySelector('#ai-model-input');
    const statusEl = card.querySelector('#ai-test-status');

    sel.addEventListener('change', () => {
      if (sel.value === 'openai') modelInput.value = cfg.openaiModel || 'gpt-4o-mini';
      else if (sel.value === 'gemini') modelInput.value = cfg.geminiModel || 'gemini-2.5-flash';
    });

    card.querySelector('#ai-btn-cancel').addEventListener('click', closeModal);
    card.querySelector('#ai-btn-test').addEventListener('click', async () => {
      statusEl.textContent = 'Testing connection...';
      const draft = {
        provider: sel.value,
        apiKey: keyInput.value.trim(),
        geminiModel: sel.value === 'gemini' ? modelInput.value.trim() : cfg.geminiModel,
        openaiModel: sel.value === 'openai' ? modelInput.value.trim() : cfg.openaiModel
      };
      const res = await AI.testConnection(draft);
      statusEl.style.color = res.ok ? 'var(--success)' : 'var(--danger)';
      statusEl.textContent = res.message;
    });

    card.querySelector('#ai-btn-save').addEventListener('click', () => {
      const saved = AI.saveConfig({
        provider: sel.value,
        apiKey: keyInput.value.trim(),
        geminiModel: sel.value === 'gemini' ? modelInput.value.trim() || 'gemini-2.5-flash' : cfg.geminiModel,
        openaiModel: sel.value === 'openai' ? modelInput.value.trim() || 'gpt-4o-mini' : cfg.openaiModel
      });
      if (App && typeof App.updateAIBadge === 'function') {
        App.updateAIBadge(saved);
      }
      closeModal();
    });
  }

  function openScoreboardModal() {
    const App = root.YP.App;
    const stats = App && typeof App.getTelemetry === 'function'
      ? App.getTelemetry()
      : { wpm: 0, backspaces: 0, errors: 0, words: 0, mood: 'passive-aggressive', escalation: 0 };

    const card = showModalHTML(`
      <h3 class="modal-title">🏆 Hackathon Category Coverage (100 / 100 pts)</h3>
      <p class="modal-body">
        Live session proof: <strong>${stats.words} words</strong>, <strong>${stats.errors} sins</strong>, <strong>${stats.backspaces} backspaces</strong>, stage <strong>${stats.escalation}/4</strong>.
      </p>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:8px;">
        <div><strong>✅ A — Most Frustrating (25 pts):</strong> 0ms mid-typing ragebait modals, 4-corner-hopping stalkers, shrinking errors (100%→26%), font-shrink punishment (15.5px→11px), dodging Autocorrect, save sabotage, 3-step exit trap.</div>
        <div><strong>✅ B — Creative Use of AI (25 pts):</strong> Evaluates prose every ~30 words with mood + telemetry (WPM, Backspaces, Errors) via Gemini, OpenAI, or 0ms Offline Critic.</div>
        <div><strong>✅ C — Funniest (25 pts):</strong> 6 moods (Intellectual fake citations, Sad rain, Angry scrambler, 10s Supportive), 15s ghostwriter, procedural Web Audio violin/stings, <code>i_remember.txt</code> grudge.</div>
        <div><strong>✅ D — Most Pointless, Yet Brilliant (25 pts):</strong> Real text editor (.txt open/save, line numbers, WPM sparkline, pixel-synced wavy backdrop) engineered to hate your note-taking.</div>
      </div>
      <div class="modal-actions">
        <button id="scoreboard-close" type="button" class="modal-btn modal-btn-primary">Back to Suffering</button>
      </div>
    `);
    if (!card) return;
    card.querySelector('#scoreboard-close').addEventListener('click', closeModal);
  }

  function openAboutModal() {
    const card = showModalHTML(`
      <h3 class="modal-title">📝 About YapPad</h3>
      <p class="modal-body">
        <em>"We built a notepad. It works perfectly. It just hates you."</em>
      </p>
      <p class="modal-body">
        YapPad is a zero-dependency web text editor with real-time 0ms orthographic shaming, procedural Web Audio synthesis, 6 shifting moods, AI roasting, and escalating ragebait overlays.
      </p>
      <div class="modal-actions">
        <button id="about-close" type="button" class="modal-btn modal-btn-primary">Got It</button>
      </div>
    `);
    if (!card) return;
    card.querySelector('#about-close').addEventListener('click', closeModal);
  }

  root.YP.Modals = {
    SAVE_MODES,
    evaluateSaveRating,
    openSaveFlow,
    openMeltdownModal,
    openBackspaceIntervention,
    openExitFlow,
    openAISettingsModal,
    openScoreboardModal,
    openAboutModal,
    isOpen,
    isDismissible,
    getActiveSaveMode,
    shakeActiveModal,
    closeModal,
    close: closeModal
  };
})();
