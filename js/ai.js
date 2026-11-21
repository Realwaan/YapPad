/**
 * YapPad AI Brain module stub (Gemini, OpenAI, and offline critic implemented in Ticket 08).
 * Attached to window.YP (aliased as window.SN) for classic script & file:// support.
 */
(function (global) {
  "use strict";

  const YP = (global.YP = global.YP || global.SN || {});
  global.SN = YP;

  YP.AI = {
    config: {
      provider: "offline",
      model: "gemini-2.5-flash",
    },

    generateOfflineRoast: function () {
      return "AI Brain is standing by. Keep typing.";
    },

    requestRoast: function () {
      return Promise.resolve(this.generateOfflineRoast());
    },

    testConnection: function () {
      return Promise.resolve({ ok: true, provider: this.config.provider });
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
