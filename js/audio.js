/**
 * YapPad Audio module (expanded with all 13 Web Audio cues & persistence in Ticket 10).
 * Implements synthesized playSigh and playPanicPip for Ticket 03 with safe headless/muted no-ops.
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

  function playSigh() {
    const ctx = getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const duration = 0.72;
      const vol = Math.max(0, Math.min(1, AudioEngine.volume)) * 0.16;

      // Soft descending airy breath (filtered noise)
      const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(920, now);
      filter.frequency.exponentialRampToValueAtTime(340, now + duration);
      filter.Q.value = 1.8;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + duration);

      // Gentle falling vocal sigh tone underneath
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(310, now);
      osc.frequency.exponentialRampToValueAtTime(175, now + duration);
      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.linearRampToValueAtTime(vol * 0.45, now + 0.1);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Silent no-op when audio device/context is unavailable
    }
  }

  function playPanicPip() {
    const ctx = getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const vol = Math.max(0, Math.min(1, AudioEngine.volume)) * 0.18;
      const pips = [
        { offset: 0, freq: 880 },
        { offset: 0.085, freq: 1175 },
      ];

      pips.forEach(function (pip) {
        const start = now + pip.offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(pip.freq, start);
        osc.frequency.exponentialRampToValueAtTime(pip.freq * 1.12, start + 0.065);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(vol, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.075);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.08);
      });
    } catch {
      // Silent no-op when audio device/context is unavailable
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

    playSigh: playSigh,
    playDisappointmentDing: noop,
    playPanicPip: playPanicPip,
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

  YP.Audio = AudioEngine;
})(typeof window !== "undefined" ? window : globalThis);
