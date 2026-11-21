/**
 * YapPad Audio module stub (implemented with Web Audio API synthesis in Ticket 10).
 * Attached to window.YP (aliased as window.SN) for classic script & file:// support.
 */
(function (global) {
  "use strict";

  const YP = (global.YP = global.YP || global.SN || {});
  global.SN = YP;

  const noop = function () {};

  const AudioStub = {
    enabled: true,
    volume: 0.5,

    isMuted: function () {
      return !this.enabled;
    },

    setMuted: function (muted) {
      this.enabled = !muted;
      return this.enabled;
    },

    toggleMute: function () {
      this.enabled = !this.enabled;
      return !this.enabled;
    },

    playSigh: noop,
    playDisappointmentDing: noop,
    playPanicPip: noop,
    playGuiltPop: noop,
    playOrchestralSting: noop,
    playSuspenseMusic: noop,
    playSadViolin: noop,
    playAngryBuzz: noop,
    playSupportiveChime: noop,
    playRoastPop: noop,
    playRageBuzzer: noop,
    playCornerZip: noop,
    playShrinkSqueak: noop,
  };

  YP.Audio = AudioStub;
})(typeof window !== "undefined" ? window : globalThis);
