/**
 * YapPad Audio module (expanded with all 13 Web Audio cues & persistence in Ticket 10).
 * Implements synthesized playGuiltPop, playRageBuzzer, and playOrchestralSting for Ticket 05
 * with silent no-ops when muted or when AudioContext is unavailable.
 */
(function (global) {
  "use strict";

  const YP = (global.YP = global.YP || global.SN || {});
  global.SN = YP;

  const noop = function () {};
  let audioCtx = null;

  function getContext() {
    if (!AudioEngine.enabled) return null;
    const Ctor =
      typeof global.AudioContext === "function"
        ? global.AudioContext
        : typeof global.webkitAudioContext === "function"
          ? global.webkitAudioContext
          : null;
    if (!Ctor) return null;
    try {
      if (!audioCtx) {
        audioCtx = new Ctor();
      }
      if (audioCtx.state === "suspended" && typeof audioCtx.resume === "function") {
        const maybePromise = audioCtx.resume();
        if (maybePromise && typeof maybePromise.catch === "function") {
          maybePromise.catch(noop);
        }
      }
      return audioCtx;
    } catch {
      return null;
    }
  }

  function playGuiltPop() {
    const ctx = getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const vol = Math.max(0, Math.min(1, AudioEngine.volume)) * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(430, now);
      osc.frequency.exponentialRampToValueAtTime(215, now + 0.11);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Silent no-op when audio context is unavailable
    }
  }

  function playRageBuzzer() {
    const ctx = getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const vol = Math.max(0, Math.min(1, AudioEngine.volume)) * 0.14;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1100, now);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(vol, now + 0.015);
      masterGain.gain.setValueAtTime(vol, now + 0.18);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      [142, 151].forEach(function (freq) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + 0.29);
      });
    } catch {
      // Silent no-op when audio context is unavailable
    }
  }

  function playOrchestralSting() {
    const ctx = getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const vol = Math.max(0, Math.min(1, AudioEngine.volume)) * 0.13;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.exponentialRampToValueAtTime(520, now + 0.95);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(vol, now + 0.03);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.96);

      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Dramatic diminished orchestral chord (D3, Ab3, D4, F4)
      const freqs = [146.83, 207.65, 293.66, 349.23];
      freqs.forEach(function (freq, idx) {
        const osc = ctx.createOscillator();
        osc.type = idx % 2 === 0 ? "sawtooth" : "triangle";
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 0.985, now + 0.95);
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + 0.98);
      });
    } catch {
      // Silent no-op when audio context is unavailable
    }
  }

  const AudioEngine = {
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
    playGuiltPop: playGuiltPop,
    playOrchestralSting: playOrchestralSting,
    playSuspenseMusic: noop,
    playSadViolin: noop,
    playAngryBuzz: noop,
    playSupportiveChime: noop,
    playRoastPop: noop,
    playRageBuzzer: playRageBuzzer,
    playCornerZip: noop,
    playShrinkSqueak: noop,
  };

  YP.Audio = AudioEngine;
})(typeof window !== "undefined" ? window : globalThis);
