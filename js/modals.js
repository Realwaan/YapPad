/**
 * YapPad Modals shell (expanded in Tickets 02, 05, 08, 09, 11, and 13).
 * Manages the shared #modal-overlay container without external dependencies.
 */
(function (global) {
  "use strict";

  const YP = (global.YP = global.YP || global.SN || {});
  global.SN = YP;

  let activeDismiss = null;

  function getEls() {
    if (typeof document === "undefined") return null;
    const overlay = document.getElementById("modal-overlay");
    if (!overlay) return null;
    return {
      overlay: overlay,
      title: document.getElementById("modal-title"),
      body: document.getElementById("modal-body"),
      actions: document.getElementById("modal-actions"),
      closeBtn: document.getElementById("modal-close"),
    };
  }

  function close() {
    const els = getEls();
    if (!els) return;
    els.overlay.hidden = true;
    els.body.innerHTML = "";
    els.actions.innerHTML = "";
    const cb = activeDismiss;
    activeDismiss = null;
    if (typeof cb === "function") cb();
  }

  function open(options) {
    const els = getEls();
    if (!els) return;

    const opts = options || {};
    if (els.title) {
      els.title.textContent = opts.title || "YapPad";
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

    els.actions.innerHTML = "";
    const buttons = Array.isArray(opts.buttons) && opts.buttons.length
      ? opts.buttons
      : [{ label: "OK", primary: true, onClick: close }];

    buttons.forEach(function (btnSpec) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = btnSpec.primary ? "modal-btn modal-btn-primary" : "modal-btn";
      btn.textContent = btnSpec.label || "OK";
      btn.addEventListener("click", function () {
        if (typeof btnSpec.onClick === "function") {
          const keepOpen = btnSpec.onClick() === false;
          if (!keepOpen) close();
        } else {
          close();
        }
      });
      els.actions.appendChild(btn);
    });

    activeDismiss = typeof opts.onClose === "function" ? opts.onClose : null;
    els.overlay.hidden = false;
  }

  function isOpen() {
    const els = getEls();
    return Boolean(els && !els.overlay.hidden);
  }

  function openAboutModal() {
    open({
      title: "About YapPad",
      body: "YapPad — a zero-dependency browser notepad that watches how and what you write. Works over http://127.0.0.1:3456 and directly via file://.",
      buttons: [{ label: "Understood", primary: true }],
    });
  }

  function bindShellListeners() {
    const els = getEls();
    if (!els) return;
    if (els.closeBtn) {
      els.closeBtn.addEventListener("click", close);
    }
    els.overlay.addEventListener("click", function (event) {
      if (event.target === els.overlay) {
        close();
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
    openAboutModal: openAboutModal,
  };
})(typeof window !== "undefined" ? window : globalThis);
