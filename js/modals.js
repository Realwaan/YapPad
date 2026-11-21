/**
 * YapPad Modals controller (Ticket 05 adds openBackspaceIntervention and openMeltdownModal;
 * expanded in Tickets 02, 08, 09, 11, and 13).
 * Manages the shared #modal-overlay container without external dependencies.
 */
(function (global) {
  "use strict";

  const YP = (global.YP = global.YP || global.SN || {});
  global.SN = YP;

  let activeDismiss = null;
  let currentDismissible = true;
  let meltdownTimerId = null;

  function getEls() {
    if (typeof document === "undefined") return null;
    const overlay = document.getElementById("modal-overlay");
    if (!overlay) return null;
    return {
      overlay: overlay,
      card: document.getElementById("modal-card"),
      title: document.getElementById("modal-title"),
      body: document.getElementById("modal-body"),
      actions: document.getElementById("modal-actions"),
      closeBtn: document.getElementById("modal-close"),
    };
  }

  function clearMeltdownTimer() {
    if (meltdownTimerId !== null) {
      global.clearInterval(meltdownTimerId);
      meltdownTimerId = null;
    }
  }

  function close(force) {
    if (!force && !currentDismissible) return false;
    const els = getEls();
    if (!els) return false;

    clearMeltdownTimer();
    currentDismissible = true;
    els.overlay.hidden = true;
    els.body.innerHTML = "";
    els.actions.innerHTML = "";
    if (els.closeBtn) {
      els.closeBtn.disabled = false;
      els.closeBtn.hidden = false;
    }

    const cb = activeDismiss;
    activeDismiss = null;
    if (typeof cb === "function") cb();

    const ta = document.getElementById("editor-textarea");
    if (ta && typeof ta.focus === "function") {
      ta.focus();
    }
    return true;
  }

  function renderButtons(actionsEl, buttons) {
    if (!actionsEl) return;
    actionsEl.innerHTML = "";
    const list =
      Array.isArray(buttons) && buttons.length
        ? buttons
        : [{ label: "OK", primary: true, onClick: function () { close(true); } }];

    list.forEach(function (btnSpec) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = btnSpec.primary
        ? "modal-btn modal-btn-primary"
        : btnSpec.danger
          ? "modal-btn modal-btn-danger"
          : "modal-btn";
      if (btnSpec.id) btn.id = btnSpec.id;
      btn.textContent = btnSpec.label || "OK";
      if (btnSpec.disabled) btn.disabled = true;
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        if (typeof btnSpec.onClick === "function") {
          const keepOpen = btnSpec.onClick(btn) === false;
          if (!keepOpen) close(true);
        } else {
          close(true);
        }
      });
      actionsEl.appendChild(btn);
    });
  }

  function setButtons(buttons) {
    const els = getEls();
    if (!els) return;
    renderButtons(els.actions, buttons);
  }

  function open(options) {
    const els = getEls();
    if (!els) return null;

    clearMeltdownTimer();
    const opts = options || {};
    currentDismissible = opts.dismissible !== false;

    if (els.title) {
      els.title.textContent = opts.title || "YapPad";
    }
    if (els.closeBtn) {
      els.closeBtn.disabled = !currentDismissible;
      els.closeBtn.hidden = !currentDismissible;
    }

    els.body.innerHTML = "";
    if (typeof opts.bodyNode === "object" && opts.bodyNode) {
      els.body.appendChild(opts.bodyNode);
    } else {
      const p = document.createElement("p");
      p.style.margin = "0";
      p.textContent = opts.body || "";
      els.body.appendChild(p);
    }

    renderButtons(els.actions, opts.buttons);

    activeDismiss = typeof opts.onClose === "function" ? opts.onClose : null;
    els.overlay.hidden = false;
    return els.card || els.overlay;
  }

  function isOpen() {
    const els = getEls();
    return Boolean(els && !els.overlay.hidden);
  }

  function openAboutModal() {
    open({
      title: "About YapPad",
      body: "YapPad — a zero-dependency browser notepad that watches how and what you write. Works over http://127.0.0.1:3456 and directly via file://.",
      dismissible: true,
      buttons: [{ label: "Understood", primary: true }],
    });
  }

  /**
   * 5th-Backspace intervention modal (can be invoked directly or as fallback for YP.Ragebait.showCenterRagebait).
   */
  function openBackspaceIntervention(backspaceCount) {
    const count = Math.max(1, Number(backspaceCount) || 5);
    if (YP.Audio && typeof YP.Audio.playRageBuzzer === "function") {
      YP.Audio.playRageBuzzer();
    }

    const wrap = document.createElement("div");
    wrap.className = "intervention-body";

    const badge = document.createElement("div");
    badge.className = "intervention-badge";
    badge.textContent = "🚨 BACKSPACE INTERVENTION #" + count;

    const copy = document.createElement("p");
    copy.className = "intervention-copy";
    copy.textContent =
      "That's " +
      count +
      " deletions. Deleting again? This is becoming a pattern. Have you considered typing what you actually mean?";

    wrap.appendChild(badge);
    wrap.appendChild(copy);

    return open({
      title: "Self-Doubt Intervention",
      bodyNode: wrap,
      dismissible: true,
      buttons: [
        {
          label: "I admit I have commitment issues",
          primary: true,
        },
      ],
    });
  }

  /**
   * Mass-delete emotional meltdown modal with animated "YapPad is processing its emotions..." progress bar.
   */
  function openMeltdownModal(options) {
    const opts = options || {};
    const deletedChars = Math.max(0, Number(opts.deletedChars) || 0);
    const durationMs = Math.max(300, Number(opts.durationMs) || 2800);

    if (YP.Audio && typeof YP.Audio.playOrchestralSting === "function") {
      YP.Audio.playOrchestralSting();
    }

    if (YP.App && typeof YP.App.addCommentary === "function") {
      YP.App.addCommentary(
        "...You selected everything. And deleted it. I need a moment.",
        { tag: "💥 Meltdown" }
      );
      YP.App.setStatus("...You selected everything. And deleted it. I need a moment.");
    }

    const wrap = document.createElement("div");
    wrap.className = "meltdown-body";
    wrap.id = "meltdown-modal-body";

    const headline = document.createElement("p");
    headline.className = "meltdown-quote";
    headline.textContent =
      "...You selected everything. And deleted it. I need a moment.";

    const sub = document.createElement("p");
    sub.className = "meltdown-sub";
    sub.textContent =
      deletedChars > 0
        ? deletedChars +
          " innocent characters, erased in cold blood. Not even a goodbye."
        : "Everything we built together—gone in a single keystroke.";

    const statusRow = document.createElement("div");
    statusRow.className = "meltdown-status-row";

    const phaseLabel = document.createElement("span");
    phaseLabel.id = "meltdown-phase";
    phaseLabel.className = "meltdown-phase";
    phaseLabel.textContent = "YapPad is processing its emotions...";

    const pctLabel = document.createElement("span");
    pctLabel.id = "meltdown-pct";
    pctLabel.className = "meltdown-pct";
    pctLabel.textContent = "0%";

    statusRow.appendChild(phaseLabel);
    statusRow.appendChild(pctLabel);

    const track = document.createElement("div");
    track.className = "meltdown-progress-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", "YapPad is processing its emotions");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", "0");

    const fill = document.createElement("div");
    fill.id = "meltdown-progress-fill";
    fill.className = "meltdown-progress-fill";
    fill.style.width = "0%";
    track.appendChild(fill);

    wrap.appendChild(headline);
    wrap.appendChild(sub);
    wrap.appendChild(statusRow);
    wrap.appendChild(track);

    const card = open({
      title: "💔 Emotional Meltdown",
      bodyNode: wrap,
      dismissible: false,
      buttons: [
        {
          id: "btn-meltdown-continue",
          label: "Processing emotions…",
          primary: true,
          disabled: true,
        },
      ],
      onClose: function () {
        clearMeltdownTimer();
        if (YP.App && typeof YP.App.setStatus === "function") {
          YP.App.setStatus("I'm fine. Totally fine. Just don't do that again.");
        }
      },
    });

    const startTime = Date.now();
    const phases = [
      { at: 0, text: "YapPad is processing its emotions..." },
      { at: 30, text: "Stage 1/3: Denial (checking for backups)..." },
      { at: 60, text: "Stage 2/3: Grief (holding a brief memorial)..." },
      { at: 85, text: "Stage 3/3: Passive-aggressive acceptance..." },
      { at: 100, text: "Done. I'm composed. Mostly." },
    ];

    const stepMs = 50;
    meltdownTimerId = global.setInterval(function () {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));

      fill.style.width = pct + "%";
      track.setAttribute("aria-valuenow", String(pct));
      pctLabel.textContent = pct + "%";

      for (let i = phases.length - 1; i >= 0; i -= 1) {
        if (pct >= phases[i].at) {
          phaseLabel.textContent = phases[i].text;
          break;
        }
      }

      if (pct >= 100) {
        clearMeltdownTimer();
        currentDismissible = true;
        const els = getEls();
        if (els && els.closeBtn) {
          els.closeBtn.disabled = false;
          els.closeBtn.hidden = false;
        }
        const continueBtn = document.getElementById("btn-meltdown-continue");
        if (continueBtn) {
          continueBtn.disabled = false;
          continueBtn.textContent = "I'm Sorry, Continue";
          continueBtn.focus();
        }
      }
    }, stepMs);

    return card;
  }

  function bindShellListeners() {
    const els = getEls();
    if (!els) return;
    if (els.closeBtn) {
      els.closeBtn.addEventListener("click", function () {
        close(false);
      });
    }
    els.overlay.addEventListener("click", function (event) {
      if (event.target === els.overlay) {
        close(false);
      }
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindShellListeners);
    } else {
      bindShellListeners();
    }
  }

  YP.Modals = {
    open: open,
    close: close,
    isOpen: isOpen,
    setButtons: setButtons,
    openAboutModal: openAboutModal,
    openBackspaceIntervention: openBackspaceIntervention,
    openMeltdownModal: openMeltdownModal,
  };
})(typeof window !== "undefined" ? window : globalThis);
