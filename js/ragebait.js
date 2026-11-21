(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.YP = root.YP || {};
  root.SN = root.YP;

  const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
  const SHRINK_STEPS = [1.0, 0.84, 0.70, 0.56, 0.44, 0.34, 0.26];

  let mistakeTotal = 0;
  let centerCardEl = null;
  const cornerStalkers = [];
  const shrinkingCards = [];

  function getLayer() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('ragebait-layer');
  }

  function escapeHTML(str) {
    const Grammar = root.YP.Grammar;
    if (Grammar && typeof Grammar.escapeHTML === 'function') {
      return Grammar.escapeHTML(str);
    }
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function showCenterRagebait(issue = {}) {
    const layer = getLayer();
    const Audio = root.YP.Audio;
    if (Audio) Audio.playRageBuzzer();

    mistakeTotal += 1;
    if (!layer) return null;

    if (centerCardEl && centerCardEl.parentNode) {
      centerCardEl.remove();
      centerCardEl = null;
    }

    const token = escapeHTML(issue.token || 'keystroke');
    const msg = escapeHTML(
      issue.message || `Seriously? "${issue.token || 'That'}" is what you decided to type?`
    );

    const card = document.createElement('div');
    card.className = 'center-ragebait-card';
    card.innerHTML = `
      <div class="ragebait-header">
        <span class="ragebait-title">🚨 WRITING VIOLATION #${mistakeTotal}: "${token}"</span>
        <button type="button" class="ragebait-close-x" title="Close">✕</button>
      </div>
      <div class="ragebait-body">${msg}</div>
      <div class="ragebait-actions">
        <button type="button" class="ragebait-btn ragebait-fix-btn">✨ Fix It For Me</button>
        <button type="button" class="ragebait-btn ragebait-btn-primary ragebait-dismiss-btn">
          I Accept My Mediocrity
        </button>
      </div>
    `;

    const closeX = card.querySelector('.ragebait-close-x');
    const fixBtn = card.querySelector('.ragebait-fix-btn');
    const dismissBtn = card.querySelector('.ragebait-dismiss-btn');

    let xDodged = false;
    closeX.addEventListener('mouseenter', () => {
      if (!xDodged) {
        xDodged = true;
        closeX.style.transform = 'translateX(-28px)';
        if (Audio) Audio.playCornerZip();
      }
    });
    closeX.addEventListener('click', () => {
      card.remove();
      if (centerCardEl === card) centerCardEl = null;
    });

    let fixFlip = 1;
    const dodgeFix = () => {
      fixFlip = fixFlip === 1 ? -1 : 1;
      fixBtn.style.transform = `translateX(${-46 * fixFlip}px)`;
      fixBtn.textContent = '✨ Nope, Learn Yourself';
      if (Audio) Audio.playCornerZip();
    };
    fixBtn.addEventListener('mouseenter', dodgeFix);
    fixBtn.addEventListener('click', dodgeFix);

    dismissBtn.addEventListener('click', () => {
      card.remove();
      if (centerCardEl === card) centerCardEl = null;
    });

    layer.appendChild(card);
    centerCardEl = card;
    return card;
  }

  function spawnCornerStalker(issue = {}) {
    const layer = getLayer();
    const Audio = root.YP.Audio;
    if (!layer) return null;

    while (cornerStalkers.length >= 2) {
      const oldest = cornerStalkers.shift();
      if (oldest) {
        clearInterval(oldest.timer);
        if (oldest.el && oldest.el.parentNode) oldest.el.remove();
      }
    }

    let cornerIndex = cornerStalkers.length % CORNERS.length;
    let dodgesLeft = 3;

    const card = document.createElement('div');
    card.className = 'corner-stalker-card';
    card.setAttribute('data-corner', CORNERS[cornerIndex]);

    const token = escapeHTML(issue.token || 'syntax');
    const msg = escapeHTML(issue.message || `I'm going to hop corners until you fix "${issue.token || 'that'}".`);

    card.innerHTML = `
      <div class="ragebait-header">
        <span class="ragebait-title">👀 Corner Stalker: "${token}"</span>
        <button type="button" class="ragebait-close-x" title="Try to close (${dodgesLeft} dodges left)">✕</button>
      </div>
      <div class="ragebait-body" style="margin-bottom:0;font-size:11.5px;">${msg}</div>
    `;

    const hopCorner = () => {
      cornerIndex = (cornerIndex + 1) % CORNERS.length;
      card.setAttribute('data-corner', CORNERS[cornerIndex]);
      if (Audio) Audio.playCornerZip();
    };

    const timer = setInterval(hopCorner, 1650);
    const entry = { el: card, timer };
    cornerStalkers.push(entry);

    const closeBtn = card.querySelector('.ragebait-close-x');
    closeBtn.addEventListener('mouseenter', () => {
      if (dodgesLeft > 0) {
        dodgesLeft -= 1;
        closeBtn.title = dodgesLeft > 0 ? `Too slow! (${dodgesLeft} dodges left)` : 'Fine, click me';
        hopCorner();
      }
    });

    closeBtn.addEventListener('click', () => {
      if (dodgesLeft > 0) {
        dodgesLeft -= 1;
        hopCorner();
        return;
      }
      clearInterval(timer);
      card.remove();
      const idx = cornerStalkers.indexOf(entry);
      if (idx !== -1) cornerStalkers.splice(idx, 1);
    });

    layer.appendChild(card);
    return card;
  }

  function spawnShrinkingError(issue = {}) {
    const layer = getLayer();
    const Audio = root.YP.Audio;
    if (!layer) return null;

    while (shrinkingCards.length >= 3) {
      const oldest = shrinkingCards.shift();
      if (oldest) {
        clearTimeout(oldest.initialTimer);
        clearInterval(oldest.intervalTimer);
        if (oldest.el && oldest.el.parentNode) oldest.el.remove();
      }
    }

    let stepIndex = 0;
    const card = document.createElement('div');
    card.className = 'shrinking-error-card';

    const slot = shrinkingCards.length;
    card.style.top = `${128 + slot * 78}px`;
    card.style.right = `${285 + (slot % 2) * 34}px`;
    card.style.transform = `scale(${SHRINK_STEPS[0]})`;

    const token = escapeHTML(issue.token || 'typo');
    card.innerHTML = `
      <div class="ragebait-header" style="margin-bottom:4px;padding-bottom:4px;">
        <span class="ragebait-title" style="font-size:11.5px;">🔍 Shrinking Sin (<span class="shrink-pct">100%</span>)</span>
        <button type="button" class="ragebait-close-x" style="width:20px;height:20px;font-size:11px;">✕</button>
      </div>
      <div style="font-size:11px;line-height:1.35;">"${token}" is still wrong, just smaller.</div>
    `;

    const pctEl = card.querySelector('.shrink-pct');
    const stepShrink = () => {
      if (stepIndex < SHRINK_STEPS.length - 1) {
        stepIndex += 1;
        const scale = SHRINK_STEPS[stepIndex];
        card.style.transform = `scale(${scale})`;
        if (pctEl) pctEl.textContent = `${Math.round(scale * 100)}%`;
        if (Audio) Audio.playShrinkSqueak();
      }
    };

    const initialTimer = setTimeout(stepShrink, 550);
    const intervalTimer = setInterval(stepShrink, 1350);
    const entry = { el: card, initialTimer, intervalTimer };
    shrinkingCards.push(entry);

    card.addEventListener('mouseenter', stepShrink);
    card.querySelector('.ragebait-close-x').addEventListener('click', () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      card.remove();
      const idx = shrinkingCards.indexOf(entry);
      if (idx !== -1) shrinkingCards.splice(idx, 1);
    });

    layer.appendChild(card);
    return card;
  }

  function onMistake(issue = {}) {
    showCenterRagebait(issue);
    spawnCornerStalker(issue);
    spawnShrinkingError(issue);
  }

  function unleashAll(issues = []) {
    const sample = issues[0] || {
      token: 'teh',
      message: '"teh" is not a word. I checked. Twice.'
    };
    showCenterRagebait(sample);
    spawnCornerStalker(issues[1] || sample);
    spawnShrinkingError(issues[2] || sample);
  }

  function clearAll() {
    if (centerCardEl && centerCardEl.parentNode) {
      centerCardEl.remove();
    }
    centerCardEl = null;

    while (cornerStalkers.length > 0) {
      const item = cornerStalkers.pop();
      clearInterval(item.timer);
      if (item.el && item.el.parentNode) item.el.remove();
    }

    while (shrinkingCards.length > 0) {
      const item = shrinkingCards.pop();
      clearTimeout(item.initialTimer);
      clearInterval(item.intervalTimer);
      if (item.el && item.el.parentNode) item.el.remove();
    }
  }

  root.YP.Ragebait = {
    SHRINK_STEPS,
    CORNERS,
    showCenterRagebait,
    spawnCornerStalker,
    spawnShrinkingError,
    onMistake,
    unleashAll,
    clearAll
  };
})();
/**
 * YapPad Ragebait overlay engine stub (implemented in Ticket 12).
 * Attached to window.YP (aliased as window.SN) for classic script & file:// support.
 */
(function (global) {
  "use strict";

  const YP = (global.YP = global.YP || global.SN || {});
  global.SN = YP;

  const noop = function () {};

  YP.Ragebait = {
    onMistake: noop,
    showCenterRagebait: noop,
    spawnCornerStalker: noop,
    spawnShrinkingError: noop,
    unleashAll: noop,
    clearAll: function () {
      if (typeof document === "undefined") return;
      const layer = document.getElementById("ragebait-layer");
      if (layer) layer.innerHTML = "";
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
