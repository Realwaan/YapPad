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
