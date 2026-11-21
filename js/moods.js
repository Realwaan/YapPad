/**
 * YapPad Moods module stub (full dialogue pools, fake citations, and face states in Ticket 07).
 * Attached to window.YP (aliased as window.SN) for classic script & file:// support.
 */
(function (global) {
  "use strict";

  const YP = (global.YP = global.YP || global.SN || {});
  global.SN = YP;

  const MOODS = {
    "passive-aggressive": {
      id: "passive-aggressive",
      label: "Passive-Aggressive",
      emoji: "😒",
    },
    dramatic: {
      id: "dramatic",
      label: "Dramatic",
      emoji: "😤",
    },
    intellectual: {
      id: "intellectual",
      label: "Intellectual",
      emoji: "🧐",
    },
    sad: {
      id: "sad",
      label: "Sad",
      emoji: "😢",
    },
    angry: {
      id: "angry",
      label: "Angry",
      emoji: "😡",
    },
    supportive: {
      id: "supportive",
      label: "Supportive",
      emoji: "🥰",
      durationSec: 10,
    },
  };

  YP.Moods = {
    list: MOODS,

    get: function (moodId) {
      return MOODS[moodId] || MOODS["passive-aggressive"];
    },

    formatBadge: function (moodId) {
      const m = this.get(moodId);
      return m.emoji + " " + m.label;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
