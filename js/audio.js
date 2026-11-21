(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.YP = root.YP || {};
  root.SN = root.YP;

  const STORAGE_KEY_SN = 'sn_audio_config';
  const STORAGE_KEY_YP = 'yp_audio_config';

  let ctx = null;
  let config = {
    enabled: true,
    volume: 0.45
  };

  function loadConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY_YP) || localStorage.getItem(STORAGE_KEY_SN);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.enabled === 'boolean') config.enabled = parsed.enabled;
          if (typeof parsed.volume === 'number') config.volume = Math.max(0, Math.min(1, parsed.volume));
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  function saveConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        const serialized = JSON.stringify(config);
        localStorage.setItem(STORAGE_KEY_YP, serialized);
        localStorage.setItem(STORAGE_KEY_SN, serialized);
      }
    } catch {
      // Ignore storage errors
    }
  }

  function getContext() {
    if (!config.enabled) return null;
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      if (!ctx) {
        ctx = new AudioCtx();
      }
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return ctx;
    } catch {
      return null;
    }
  }

  function playToneSequence(notes) {
    const audioCtx = getContext();
    if (!audioCtx) return false;
    const now = audioCtx.currentTime;
    notes.forEach((n) => {
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = n.type || 'sine';
        const start = now + (n.delay || 0);
        const dur = n.duration || 0.18;
        osc.frequency.setValueAtTime(n.freq || 440, start);
        if (n.endFreq) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, n.endFreq), start + dur);
        }
        const peak = Math.max(0.001, (n.gain || 0.25) * config.volume);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(peak, start + Math.min(0.03, dur * 0.25));
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      } catch {
        // Ignore oscillator error
      }
    });
    return true;
  }

  loadConfig();

  const AudioModule = {
    getConfig() {
      return { ...config };
    },
    setEnabled(enabled) {
      config.enabled = Boolean(enabled);
      saveConfig();
      return config.enabled;
    },
    setVolume(vol) {
      config.volume = Math.max(0, Math.min(1, Number(vol) || 0));
      saveConfig();
      return config.volume;
    },
    toggleMute() {
      config.enabled = !config.enabled;
      saveConfig();
      return config.enabled;
    },
    playSigh() {
      return playToneSequence([
        { type: 'triangle', freq: 310, endFreq: 175, duration: 0.45, gain: 0.28 },
        { type: 'sine', freq: 240, endFreq: 130, delay: 0.08, duration: 0.5, gain: 0.2 }
      ]);
    },
    playDisappointmentDing() {
      return playToneSequence([
        { type: 'sine', freq: 740, endFreq: 710, duration: 0.16, gain: 0.25 },
        { type: 'triangle', freq: 520, endFreq: 460, delay: 0.14, duration: 0.28, gain: 0.28 }
      ]);
    },
    playPanicPip() {
      return playToneSequence([
        { type: 'square', freq: 880, endFreq: 960, duration: 0.07, gain: 0.18 },
        { type: 'square', freq: 1040, endFreq: 1180, delay: 0.08, duration: 0.08, gain: 0.2 },
        { type: 'square', freq: 1240, endFreq: 980, delay: 0.17, duration: 0.09, gain: 0.18 }
      ]);
    },
    playGuiltPop() {
      return playToneSequence([
        { type: 'sine', freq: 420, endFreq: 260, duration: 0.12, gain: 0.24 }
      ]);
    },
    playOrchestralSting() {
      return playToneSequence([
        { type: 'sawtooth', freq: 146.8, endFreq: 138, duration: 0.7, gain: 0.26 },
        { type: 'sawtooth', freq: 220, endFreq: 207.6, duration: 0.7, gain: 0.22 },
        { type: 'sawtooth', freq: 311.1, endFreq: 293.6, duration: 0.75, gain: 0.24 }
      ]);
    },
    playSuspenseMusic() {
      return playToneSequence([
        { type: 'triangle', freq: 196, duration: 0.35, delay: 0.0, gain: 0.2 },
        { type: 'triangle', freq: 207.6, duration: 0.35, delay: 0.4, gain: 0.22 },
        { type: 'triangle', freq: 196, duration: 0.35, delay: 0.8, gain: 0.22 },
        { type: 'triangle', freq: 233.1, duration: 0.45, delay: 1.2, gain: 0.25 }
      ]);
    },
    playSadViolin() {
      return playToneSequence([
        { type: 'sawtooth', freq: 440, endFreq: 415.3, duration: 0.45, delay: 0.0, gain: 0.16 },
        { type: 'sawtooth', freq: 392, endFreq: 349.2, duration: 0.55, delay: 0.42, gain: 0.18 },
        { type: 'sawtooth', freq: 329.6, endFreq: 293.7, duration: 0.75, delay: 0.95, gain: 0.2 }
      ]);
    },
    playAngryBuzz() {
      return playToneSequence([
        { type: 'sawtooth', freq: 130, endFreq: 98, duration: 0.22, gain: 0.3 },
        { type: 'square', freq: 165, endFreq: 110, delay: 0.05, duration: 0.22, gain: 0.24 }
      ]);
    },
    playSupportiveChime() {
      return playToneSequence([
        { type: 'sine', freq: 523.25, duration: 0.16, delay: 0.0, gain: 0.2 },
        { type: 'sine', freq: 659.25, duration: 0.18, delay: 0.1, gain: 0.22 },
        { type: 'sine', freq: 783.99, duration: 0.28, delay: 0.2, gain: 0.24 }
      ]);
    },
    playRoastPop() {
      return playToneSequence([
        { type: 'triangle', freq: 360, endFreq: 580, duration: 0.11, gain: 0.22 },
        { type: 'sine', freq: 580, endFreq: 440, delay: 0.1, duration: 0.14, gain: 0.2 }
      ]);
    },
    playRageBuzzer() {
      return playToneSequence([
        { type: 'sawtooth', freq: 155, endFreq: 140, duration: 0.16, delay: 0.0, gain: 0.28 },
        { type: 'square', freq: 118, endFreq: 105, duration: 0.22, delay: 0.14, gain: 0.3 }
      ]);
    },
    playCornerZip() {
      return playToneSequence([
        { type: 'sine', freq: 480, endFreq: 960, duration: 0.09, gain: 0.17 }
      ]);
    },
    playShrinkSqueak() {
      return playToneSequence([
        { type: 'triangle', freq: 820, endFreq: 1320, duration: 0.08, gain: 0.16 }
      ]);
    }
  };

  root.YP.Audio = AudioModule;
})();
