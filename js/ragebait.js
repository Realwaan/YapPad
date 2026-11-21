/**
 * YapPad Ragebait overlay engine (Ticket 05 implements center ragebait intervention
 * for every 5th Backspace; Ticket 12 expands with corner stalkers and shrinking cards).
 * Attached to window.YP (aliased as window.SN) for classic script & file:// support.
 */
(function (global) {
  "use strict";

  const YP = (global.YP = global.YP || global.SN || {});
  global.SN = YP;

  const noop = function () {};
  let activeCenterEl = null;

  function getLayer() {
    if (typeof document === "undefined") return null;
    return document.getElementById("ragebait-layer");
  }

  function dismissCenterRagebait() {
    if (activeCenterEl && activeCenterEl.parentNode) {
      activeCenterEl.parentNode.removeChild(activeCenterEl);
    }
    activeCenterEl = null;
    if (typeof document !== "undefined") {
      const ta = document.getElementById("editor-textarea");
      if (ta && typeof ta.focus === "function") {
        ta.focus();
      }
    }
  }

  /**
   * Show a dead-center ragebait intervention popup inside #ragebait-layer.
   * Plays playRageBuzzer(), features a runaway helper button and a once-dodging close X.
   */
  function showCenterRagebait(issue) {
    const layer = getLayer();
    if (!layer) return null;

    if (YP.Audio && typeof YP.Audio.playRageBuzzer === "function") {
      YP.Audio.playRageBuzzer();
    }

    dismissCenterRagebait();

    const info = issue || {};
    const title = info.title || "🚨 BACKSPACE INTERVENTION";
    const countLabel =
      typeof info.count === "number"
        ? "Deletion #" + info.count
        : info.badge || "Self-Doubt Detected";
    const message =
      info.message ||
      "Deleting again? This is becoming a pattern. Maybe commit to a sentence for once.";
    const dismissLabel = info.dismissLabel || "I admit I'm indecisive";
    const dodgeLabel = info.dodgeLabel || "✨ Fix My Confidence";

    const card = document.createElement("div");
    card.id = "ragebait-center-popup";
    card.className = "ragebait-center-card";
    card.setAttribute("role", "alertdialog");
    card.setAttribute("aria-label", title);

    const header = document.createElement("div");
    header.className = "ragebait-center-header";

    const titleEl = document.createElement("span");
    titleEl.className = "ragebait-center-title";
    titleEl.textContent = title;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ragebait-close-btn";
    closeBtn.setAttribute("aria-label", "Dismiss intervention");
    closeBtn.textContent = "✕";

    let closeDodged = false;
    closeBtn.addEventListener("mouseenter", function () {
      if (closeDodged) return;
      closeDodged = true;
      closeBtn.style.transform = "translateX(-28px)";
    });
    closeBtn.addEventListener("click", dismissCenterRagebait);

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "ragebait-center-body";

    const badge = document.createElement("span");
    badge.className = "ragebait-count-badge";
    badge.textContent = countLabel;

    const msgEl = document.createElement("p");
    msgEl.className = "ragebait-center-message";
    msgEl.textContent = message;

    body.appendChild(badge);
    body.appendChild(msgEl);

    const actions = document.createElement("div");
    actions.className = "ragebait-center-actions";

    const runawayBtn = document.createElement("button");
    runawayBtn.type = "button";
    runawayBtn.className = "ragebait-btn ragebait-btn-runaway";
    runawayBtn.textContent = dodgeLabel;

    let runawaySide = 1;
    const dodgeRunaway = function () {
      runawaySide = -runawaySide;
      runawayBtn.style.transform = "translateX(" + runawaySide * 46 + "px)";
    };
    runawayBtn.addEventListener("mouseenter", dodgeRunaway);
    runawayBtn.addEventListener("click", function (event) {
      event.preventDefault();
      dodgeRunaway();
    });

    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "ragebait-btn ragebait-btn-dismiss";
    dismissBtn.textContent = dismissLabel;
    dismissBtn.addEventListener("click", dismissCenterRagebait);

    actions.appendChild(runawayBtn);
    actions.appendChild(dismissBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(actions);

    layer.appendChild(card);
    activeCenterEl = card;
    return card;
  }

  function clearAll() {
    dismissCenterRagebait();
    const layer = getLayer();
    if (layer) layer.innerHTML = "";
  }

  YP.Ragebait = {
    onMistake: function (issue) {
      return showCenterRagebait(issue);
    },
    showCenterRagebait: showCenterRagebait,
    dismissCenterRagebait: dismissCenterRagebait,
    spawnCornerStalker: noop,
    spawnShrinkingError: noop,
    unleashAll: noop,
    clearAll: clearAll,
  };
})(typeof window !== "undefined" ? window : globalThis);
