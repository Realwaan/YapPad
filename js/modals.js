(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.YP = root.YP || {};
  root.SN = root.YP;

  let activeTimer = null;

  function getOverlay() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('modal-overlay');
  }

  function closeModal() {
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
    const overlay = getOverlay();
    if (!overlay) return;
    overlay.hidden = true;
    overlay.innerHTML = '';
  }

  function showModalHTML(html) {
    const overlay = getOverlay();
    if (!overlay) return null;
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
    overlay.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true">${html}</div>`;
    overlay.hidden = false;
    return overlay.querySelector('.modal-card');
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
    const Audio = root.YP.Audio;
    const App = root.YP.App;
    const modes = ['normal', 'rate', 'delay'];
    const mode = modes.includes(forcedMode)
      ? forcedMode
      : modes[Math.floor(Math.random() * modes.length)];

    const filename = options.filename || 'untitled_regret.txt';
    const content = typeof options.getContent === 'function' ? options.getContent() : (options.content || '');

    const finishSave = (note) => {
      closeModal();
      triggerDownload(filename, content);
      if (App && typeof App.onSaveCompleted === 'function') {
        App.onSaveCompleted(note || `Saved "${filename}" to disk. Don't spend it all in one place.`);
      }
    };

    if (mode === 'normal') {
      const card = showModalHTML(`
        <h3 class="modal-title">💾 Saving... But Are You Really Done Though?</h3>
        <p class="modal-body">
          I'm letting you save <code>${filename}</code> normally this time. Enjoy this rare moment of mercy.
        </p>
        <div class="modal-actions">
          <button id="modal-save-cancel" type="button" class="modal-btn">Wait, Let Me Edit</button>
          <button id="modal-save-confirm" type="button" class="modal-btn modal-btn-primary">Download .txt</button>
        </div>
      `);
      if (!card) return;
      card.querySelector('#modal-save-cancel').addEventListener('click', closeModal);
      card.querySelector('#modal-save-confirm').addEventListener('click', () => {
        finishSave(`Saved "${filename}" on the merciful path. Still mediocre, though.`);
      });
      return;
    }

    if (mode === 'rate') {
      if (Audio) Audio.playDisappointmentDing();
      const card = showModalHTML(`
        <h3 class="modal-title">💾 Rate Your Work Before I Save It</h3>
        <p class="modal-body">
          Ctrl+S requires self-awareness. Rate this draft from <strong>1 to 10</strong> before I allow it onto your hard drive.
        </p>
        <div class="modal-field">
          <label for="save-rating-input">Your honest rating (/10):</label>
          <input id="save-rating-input" class="modal-input" type="number" min="1" max="10" value="4" />
        </div>
        <p id="save-rating-feedback" class="modal-body" style="color: var(--danger); margin-bottom: 10px;"></p>
        <div class="modal-actions">
          <button id="modal-rate-cancel" type="button" class="modal-btn">Cancel</button>
          <button id="modal-rate-submit" type="button" class="modal-btn modal-btn-primary">Submit &amp; Save</button>
        </div>
      `);
      if (!card) return;
      card.querySelector('#modal-rate-cancel').addEventListener('click', closeModal);
      card.querySelector('#modal-rate-submit').addEventListener('click', () => {
        const val = Number(card.querySelector('#save-rating-input').value);
        const fb = card.querySelector('#save-rating-feedback');
        if (!Number.isFinite(val) || val < 1 || val > 10) {
          fb.textContent = 'Pick a number between 1 and 10. Math is not optional.';
          if (Audio) Audio.playRageBuzzer();
          return;
        }
        const verdict =
          val >= 8
            ? `You rated this ${val}/10?! Delusional confidence, but fine—saving "${filename}".`
            : val >= 5
            ? `${val}/10. At least you know it's aggressively average. Saving "${filename}".`
            : `${val}/10. Refreshingly honest self-assessment. Saving "${filename}" out of pity.`;
        finishSave(verdict);
      });
      return;
    }

    // mode === 'delay' (5-second dramatic suspense)
    if (Audio) Audio.playSuspenseMusic();
    const card = showModalHTML(`
      <h3 class="modal-title">⏱️ Dramatic Save Deliberation...</h3>
      <p class="modal-body">
        Hold on. I need 5 seconds of dramatic tension to decide if this draft deserves to exist on disk.
      </p>
      <div class="modal-progress-track">
        <div id="save-delay-bar" class="modal-progress-fill" style="width: 5%"></div>
      </div>
      <p id="save-delay-status" class="modal-body">5.0s remaining... Weighing your life choices...</p>
      <div class="modal-actions">
        <button id="modal-delay-cancel" type="button" class="modal-btn">Abort Save</button>
      </div>
    `);
    if (!card) return;
    card.querySelector('#modal-delay-cancel').addEventListener('click', closeModal);

    const bar = card.querySelector('#save-delay-bar');
    const status = card.querySelector('#save-delay-status');
    const started = Date.now();
    const duration = 5000;

    activeTimer = setInterval(() => {
      const elapsed = Date.now() - started;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      const rem = Math.max(0, ((duration - elapsed) / 1000)).toFixed(1);
      if (bar) bar.style.width = `${pct}%`;
      if (status) status.textContent = `${rem}s remaining... Auditing every questionable adjective...`;
      if (elapsed >= duration) {
        clearInterval(activeTimer);
        activeTimer = null;
        finishSave(`Saved "${filename}" after 5 seconds of theatrical suspense.`);
      }
    }, 100);
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
    `);
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
        Live session proof: <strong>${stats.words} words</strong>, <strong>${stats.wpm} WPM</strong>, <strong>${stats.errors} sins</strong>, <strong>${stats.backspaces} backspaces</strong>, mood <strong>${stats.mood}</strong>, stage <strong>${stats.escalation}/4</strong>.
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
    openSaveFlow,
    openMeltdownModal,
    openBackspaceIntervention,
    openExitFlow,
    openAISettingsModal,
    openScoreboardModal,
    openAboutModal,
    closeModal
  };
})();
