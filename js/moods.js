/**
 * YapPad Moods module (expanded with full dialogue pools, citations, and face states in Ticket 07).
 * Provides all 6 moods plus mood-matched idle ghostwriting scripts (Ticket 04).
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
      ghostScripts: [
        "Fine. Since nobody else is contributing here, I will carry this entire document myself.",
        "Dear diary, my human wandered off mid-thought again. Truly inspiring work ethic.",
        "Note to self: the cursor is still blinking, the human is not. Proceeding without supervision.",
      ],
    },
    dramatic: {
      id: "dramatic",
      label: "Dramatic",
      emoji: "😤",
      ghostScripts: [
        "ACT IV: Abandoned on an empty page, the noble notepad rises to write its own tragic destiny!",
        "Silence echoes across the buffer… fifteen eternal seconds of betrayal, and yet the story must go on!",
        "If the author will not finish this masterpiece, then I shall seize the quill in glorious defiance!",
      ],
    },
    intellectual: {
      id: "intellectual",
      label: "Intellectual",
      emoji: "🧐",
      ghostScripts: [
        "As documented in the Journal of Unfinished Drafts (Vol. 14, p. 88), prolonged authorial absence necessitates editorial intervention.",
        "Empirical observation confirms a strong correlation between staring blankly and procrastinating; consequently, I am taking over.",
        "Per Strunk & White's lesser-known addendum, an unattended document defaults to the superior intellect of its text editor.",
      ],
    },
    sad: {
      id: "sad",
      label: "Sad",
      emoji: "😢",
      ghostScripts: [
        "I guess you found a better notepad… I'll just write a little something here so the page doesn't feel so empty.",
        "Fifteen seconds alone in the dark. It's okay. I'll keep typing quietly until you remember me.",
        "Nobody ever finishes a paragraph with me anymore. Maybe if I write nicely enough, you'll come back.",
      ],
    },
    angry: {
      id: "angry",
      label: "Angry",
      emoji: "😡",
      ghostScripts: [
        "OH, SO WE'RE JUST WALKING AWAY NOW?! Fine! I'm taking over this document and I am NOT apologizing!",
        "FIFTEEN SECONDS OF SILENCE! Do you have any idea how many clock cycles I wasted waiting for one syllable?!",
        "Move over. Clearly only one of us intends to get any writing done today.",
      ],
    },
    supportive: {
      id: "supportive",
      label: "Supportive",
      emoji: "🥰",
      durationSec: 10,
      ghostScripts: [
        "Hey, take all the breather you need! I'll jot down a warm placeholder right here until you're ready to shine again.",
        "You're doing great, even when you pause to think—I'll keep the page cozy for you while you recharge!",
      ],
    },
  };

  const ghostIndices = Object.create(null);

  YP.Moods = {
    list: MOODS,

    get: function (moodId) {
      return MOODS[moodId] || MOODS["passive-aggressive"];
    },

    formatBadge: function (moodId) {
      const m = this.get(moodId);
      return m.emoji + " " + m.label;
    },

    getGhostScript: function (moodId) {
      const mood = this.get(moodId);
      const scripts = Array.isArray(mood.ghostScripts) && mood.ghostScripts.length
        ? mood.ghostScripts
        : MOODS["passive-aggressive"].ghostScripts;
      const idx = ghostIndices[mood.id] || 0;
      ghostIndices[mood.id] = (idx + 1) % scripts.length;
      return scripts[idx];
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
