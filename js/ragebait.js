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

  const DEFAULT_CENTER_DODGES = 3;
  const CENTER_DODGE_COOLDOWN_MS = 160;

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
    let cardDodgesLeft =
      typeof issue.dodges === 'number' && Number.isFinite(issue.dodges)
        ? Math.max(0, Math.floor(issue.dodges))
        : DEFAULT_CENTER_DODGES;
    let dodgeCount = 0;
    let lastDodgeAt = 0;
    let positioned = false;

    const card = document.createElement('div');
    card.className = 'center-ragebait-card';
    card.setAttribute('data-dodges-left', String(cardDodgesLeft));
    card.setAttribute('data-dodge-count', '0');
    card.innerHTML = `
      <div class="ragebait-header">
        <span class="ragebait-title">🚨 WRITING VIOLATION #${mistakeTotal}: "${token}"</span>
        <button type="button" class="ragebait-close-x" title="${
          cardDodgesLeft > 0 ? `Try to close (${cardDodgesLeft} dodges left)` : 'Close'
        }">✕</button>
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

    const pickNextSpot = (evt, curLeft, curTop, cardW, cardH, layerRect) => {
      const layerW = layerRect.width || 862;
      const layerH = layerRect.height || 694;
      const padX = 14;
      const minTop = 108;
      const padBottom = 40;
      const minLeft = padX;
      const maxLeft = Math.max(minLeft, layerW - cardW - padX);
      const maxTop = Math.max(minTop, layerH - cardH - padBottom);
      const midTop = (minTop + maxTop) / 2;

      const candidates = [
        { x: minLeft, y: minTop },
        { x: maxLeft, y: minTop },
        { x: minLeft, y: maxTop },
        { x: maxLeft, y: maxTop },
        { x: minLeft, y: midTop },
        { x: maxLeft, y: midTop }
      ];

      const hasPointer =
        evt && typeof evt.clientX === 'number' && typeof evt.clientY === 'number' && (evt.clientX !== 0 || evt.clientY !== 0);
      const ptrX = hasPointer ? evt.clientX - layerRect.left : curLeft + cardW / 2;
      const ptrY = hasPointer ? evt.clientY - layerRect.top : curTop + cardH / 2;

      const scored = candidates.map((pos) => {
        const moveDist = Math.hypot(pos.x - curLeft, pos.y - curTop);
        const ptrCenterDist = Math.hypot(pos.x + cardW / 2 - ptrX, pos.y + cardH / 2 - ptrY);
        const containsPointer =
          ptrX >= pos.x - 10 &&
          ptrX <= pos.x + cardW + 10 &&
          ptrY >= pos.y - 10 &&
          ptrY <= pos.y + cardH + 10;
        const score = moveDist * 0.7 + ptrCenterDist - (containsPointer ? 1000 : 0);
        return { ...pos, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const topChoices = scored.slice(0, Math.min(2, scored.length));
      return topChoices[Math.floor(Math.random() * topChoices.length)] || scored[0];
    };

    const dodgeCard = (evt) => {
      const now = Date.now();
      const inFlight = now - lastDodgeAt < CENTER_DODGE_COOLDOWN_MS;
      if (cardDodgesLeft <= 0) return false;
      if (inFlight) return true;

      const layerRect = layer.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const cardW = cardRect.width || 360;
      const cardH = cardRect.height || 140;
      const curLeft = cardRect.width > 0 ? cardRect.left - layerRect.left : ((layerRect.width || 862) - cardW) / 2;
      const curTop = cardRect.height > 0 ? cardRect.top - layerRect.top : ((layerRect.height || 694) - cardH) / 2;

      if (!positioned) {
        card.style.left = `${Math.round(curLeft)}px`;
        card.style.top = `${Math.round(curTop)}px`;
        card.classList.add('is-dodging');
        void card.offsetWidth;
        positioned = true;
      }

      const next = pickNextSpot(evt, curLeft, curTop, cardW, cardH, layerRect);
      cardDodgesLeft -= 1;
      dodgeCount += 1;
      lastDodgeAt = now;

      card.style.left = `${Math.round(next.x)}px`;
      card.style.top = `${Math.round(next.y)}px`;
      card.setAttribute('data-dodges-left', String(cardDodgesLeft));
      card.setAttribute('data-dodge-count', String(dodgeCount));

      if (cardDodgesLeft > 0) {
        dismissBtn.textContent =
          cardDodgesLeft === 2
            ? 'Too Slow! (2 dodges left)'
            : cardDodgesLeft === 1
            ? 'Almost! (1 dodge left)'
            : `Catch Me! (${cardDodgesLeft} dodges left)`;
        closeX.title = `Too slow! (${cardDodgesLeft} dodge${cardDodgesLeft === 1 ? '' : 's'} left)`;
      } else {
        dismissBtn.textContent = 'Fine. I Accept My Mediocrity';
        closeX.title = 'Fine, try clicking me now';
      }

      if (Audio) Audio.playCornerZip();
      return true;
    };

    card.addEventListener('mouseenter', (e) => {
      if (cardDodgesLeft > 0) dodgeCard(e);
    });
    card.addEventListener('mousemove', (e) => {
      if (cardDodgesLeft > 0) dodgeCard(e);
    });
    card.addEventListener('mousedown', (e) => {
      if (cardDodgesLeft > 0 || Date.now() - lastDodgeAt < CENTER_DODGE_COOLDOWN_MS) {
        e.preventDefault();
        dodgeCard(e);
      }
    });

    let xDodged = false;
    closeX.addEventListener('mouseenter', (e) => {
      if (cardDodgesLeft > 0) {
        dodgeCard(e);
        return;
      }
      if (!xDodged) {
        xDodged = true;
        closeX.style.transform = 'translateX(-28px)';
        if (Audio) Audio.playCornerZip();
      }
    });
    closeX.addEventListener('click', (e) => {
      if (cardDodgesLeft > 0 || Date.now() - lastDodgeAt < CENTER_DODGE_COOLDOWN_MS) {
        e.preventDefault();
        dodgeCard(e);
        return;
      }
      card.remove();
      if (centerCardEl === card) centerCardEl = null;
    });

    let fixFlip = -1;
    const dodgeFix = () => {
      fixFlip = fixFlip === 1 ? -1 : 1;
      fixBtn.style.transform = `translateX(${-46 * fixFlip}px)`;
      fixBtn.textContent = '✨ Nope, Learn Yourself';
      if (Audio) Audio.playCornerZip();
    };
    fixBtn.addEventListener('mouseenter', dodgeFix);
    fixBtn.addEventListener('click', dodgeFix);

    dismissBtn.addEventListener('mouseenter', (e) => {
      if (cardDodgesLeft > 0) dodgeCard(e);
    });
    dismissBtn.addEventListener('mousedown', (e) => {
      if (cardDodgesLeft > 0 || Date.now() - lastDodgeAt < CENTER_DODGE_COOLDOWN_MS) {
        e.preventDefault();
        dodgeCard(e);
      }
    });
    dismissBtn.addEventListener('click', (e) => {
      if (cardDodgesLeft > 0 || Date.now() - lastDodgeAt < CENTER_DODGE_COOLDOWN_MS) {
        e.preventDefault();
        dodgeCard(e);
        return;
      }
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
    card.setAttribute('data-dodges-left', String(dodgesLeft));

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
        card.setAttribute('data-dodges-left', String(dodgesLeft));
        closeBtn.title = dodgesLeft > 0 ? `Too slow! (${dodgesLeft} dodges left)` : 'Fine, click me';
        hopCorner();
      }
    });

    closeBtn.addEventListener('click', () => {
      if (dodgesLeft > 0) {
        dodgesLeft -= 1;
        card.setAttribute('data-dodges-left', String(dodgesLeft));
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
    card.style.top = `${202 + slot * 74}px`;
    card.style.right = `${285 + (slot % 2) * 34}px`;
    card.style.transform = `scale(${SHRINK_STEPS[0]})`;
    card.setAttribute('data-scale', String(SHRINK_STEPS[0]));

    const token = escapeHTML(issue.token || 'typo');
    card.innerHTML = `
      <div class="ragebait-header" style="margin-bottom:4px;padding-bottom:4px;">
        <span class="ragebait-title" style="font-size:11.5px;">🔍 Shrinking Sin (<span class="shrink-pct">100%</span>)</span>
        <button type="button" class="ragebait-close-x" style="width:20px;height:20px;font-size:11px;">✕</button>
      </div>
      <div style="font-size:11px;line-height:1.35;">"${token}" is still wrong, just smaller.</div>
    `;

    const pctEl = card.querySelector('.shrink-pct');
    let intervalTimer = null;
    const stepShrink = () => {
      if (stepIndex < SHRINK_STEPS.length - 1) {
        stepIndex += 1;
        const scale = SHRINK_STEPS[stepIndex];
        card.style.transform = `scale(${scale})`;
        card.setAttribute('data-scale', String(scale));
        if (pctEl) pctEl.textContent = `${Math.round(scale * 100)}%`;
        if (Audio) Audio.playShrinkSqueak();
        if (stepIndex >= SHRINK_STEPS.length - 1 && intervalTimer !== null) {
          clearInterval(intervalTimer);
          intervalTimer = null;
        }
      }
    };

    const initialTimer = setTimeout(stepShrink, 550);
    intervalTimer = setInterval(stepShrink, 1350);
    const entry = { el: card, initialTimer, intervalTimer };
    shrinkingCards.push(entry);

    card.addEventListener('mouseenter', stepShrink);
    card.querySelector('.ragebait-close-x').addEventListener('click', () => {
      clearTimeout(initialTimer);
      if (intervalTimer !== null) {
        clearInterval(intervalTimer);
        intervalTimer = null;
      }
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
    DEFAULT_CENTER_DODGES,
    showCenterRagebait,
    spawnCornerStalker,
    spawnShrinkingError,
    onMistake,
    unleashAll,
    clearAll
  };
})();
