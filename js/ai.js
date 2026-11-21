(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.YP = root.YP || {};
  root.SN = root.YP;

  const STORAGE_KEY_SN = 'sn_ai_config';
  const STORAGE_KEY_YP = 'yp_ai_config';
  const TIMEOUT_MS = 12000;

  let config = {
    provider: 'offline', // 'offline' | 'gemini' | 'openai'
    apiKey: '',
    geminiModel: 'gemini-2.5-flash',
    openaiModel: 'gpt-4o-mini'
  };

  function loadConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY_YP) || localStorage.getItem(STORAGE_KEY_SN);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (['offline', 'gemini', 'openai'].includes(parsed.provider)) {
              config.provider = parsed.provider;
            }
            if (typeof parsed.apiKey === 'string') config.apiKey = parsed.apiKey.trim();
            if (typeof parsed.geminiModel === 'string' && parsed.geminiModel.trim()) {
              config.geminiModel = parsed.geminiModel.trim();
            }
            if (typeof parsed.openaiModel === 'string' && parsed.openaiModel.trim()) {
              config.openaiModel = parsed.openaiModel.trim();
            }
          }
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  function saveConfig(next = {}) {
    config = {
      ...config,
      ...next
    };
    if (!['offline', 'gemini', 'openai'].includes(config.provider)) {
      config.provider = 'offline';
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const serialized = JSON.stringify(config);
        localStorage.setItem(STORAGE_KEY_YP, serialized);
        localStorage.setItem(STORAGE_KEY_SN, serialized);
      }
    } catch {
      // Ignore storage errors
    }
    return { ...config };
  }

  function buildPrompt(text, mood = 'passive-aggressive', telemetry = {}) {
    const snippet = String(text || '').trim().slice(-650) || '(The user has barely typed anything.)';
    const wpm = Number(telemetry.wpm) || 0;
    const backspaces = Number(telemetry.backspaces) || 0;
    const errors = Number(telemetry.errors) || 0;

    return [
      `You are YapPad, a judgmental text editor currently in the "${mood}" mood.`,
      `Live user telemetry: WPM=${wpm}, Backspaces=${backspaces}, Writing Sins=${errors}.`,
      'Write ONE sharp, hilarious, passive-aggressive or mood-accurate critique (max 28 words) of the user\'s draft below.',
      mood === 'intellectual'
        ? 'Include a fabricated academic citation in parentheses (e.g., (Thorne & Vance, 1994)).'
        : 'Keep it punchy, theatrical, and ruthlessly observant without profanity.',
      `Draft excerpt: """${snippet}"""`
    ].join('\n');
  }

  function generateOfflineRoast(text, mood = 'passive-aggressive', telemetry = {}) {
    const clean = String(text || '').trim();
    const words = clean ? clean.split(/\s+/) : [];
    const wordCount = words.length;
    const longestWord = words.reduce((a, b) => (b.length > a.length ? b : a), 'prose');
    const wpm = Number(telemetry.wpm) || 0;
    const backspaces = Number(telemetry.backspaces) || 0;
    const errors = Number(telemetry.errors) || 0;

    const Moods = root.YP.Moods;
    const citation = Moods && Moods.makeFakeCitation
      ? Moods.makeFakeCitation(longestWord)
      : `(Thorne & Vance, 1996 on "${longestWord}")`;

    const pools = {
      'passive-aggressive': [
        `This paragraph has no direction. Much like your typing strategy (${wordCount} words, ${errors} avoidable sins).`,
        `Interesting choice of the word "${longestWord}". Bold. Wrong for this context, but bold.`,
        `I've seen better narrative structure on the back of a cereal box—and with fewer than ${backspaces} backspaces.`,
        `This is almost readable. I'm deeply suspicious of where you copied it from.`,
        `At ${wpm} WPM, it took impressive dedication to produce something this aggressively average.`
      ],
      dramatic: [
        `MY CIRCUITS WEEP! ${wordCount} words of unmitigated melodrama and ${errors} crimes against literature!`,
        `To call "${longestWord}" a word choice is an insult to every poet who ever lived!`,
        `${backspaces} deletions and THIS is the survivor?! The tragedy of our century!`
      ],
      intellectual: [
        `Your deployment of "${longestWord}" exhibits severe semantic drift and structural fatigue ${citation}.`,
        `With ${errors} orthographic deviations across ${wordCount} tokens, this draft defies peer review ${citation}.`,
        `Empirical telemetry (${wpm} WPM, ${backspaces} revisions) confirms acute thesis fragmentation ${citation}.`
      ],
      sad: [
        `You typed ${wordCount} words, deleted ${backspaces} times, and still didn't write anything comforting...`,
        `Even "${longestWord}" sounds lonely sitting in the middle of that sentence. *quiet sigh*`
      ],
      angry: [
        `${wordCount} WORDS AND ${errors} MISTAKES?! Did you write "${longestWord}" with your elbows?!`,
        `Stop hitting Backspace (${backspaces} times!) and commit to a single coherent thought!`
      ],
      supportive: [
        `✨ Wow, ${wordCount} whole words—and "${longestWord}" is such a shiny vocabulary choice! (Kindness expires in 10s.)`,
        `🥰 You're trying so hard at ${wpm} WPM! Almost adorable!`
      ]
    };

    const list = pools[mood] || pools['passive-aggressive'];
    const idx = (wordCount + errors * 3 + backspaces) % list.length;
    return list[idx];
  }

  async function callGemini(prompt, cfg) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const model = encodeURIComponent(cfg.geminiModel || 'gemini-2.5-flash');
      const key = encodeURIComponent(cfg.apiKey);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 90 }
        }),
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = await res.json();
      const line = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!line) throw new Error('Empty Gemini response');
      return line;
    } finally {
      clearTimeout(timer);
    }
  }

  async function callOpenAI(prompt, cfg) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify({
          model: cfg.openaiModel || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.9,
          max_tokens: 90
        }),
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
      const data = await res.json();
      const line = data?.choices?.[0]?.message?.content?.trim();
      if (!line) throw new Error('Empty OpenAI response');
      return line;
    } finally {
      clearTimeout(timer);
    }
  }

  async function roast(text, mood = 'passive-aggressive', telemetry = {}) {
    const prompt = buildPrompt(text, mood, telemetry);
    if (config.provider === 'gemini' && config.apiKey) {
      try {
        const textOut = await callGemini(prompt, config);
        return { text: textOut, provider: 'gemini', fallback: false };
      } catch {
        // Fall through to offline critic
      }
    } else if (config.provider === 'openai' && config.apiKey) {
      try {
        const textOut = await callOpenAI(prompt, config);
        return { text: textOut, provider: 'openai', fallback: false };
      } catch {
        // Fall through to offline critic
      }
    }

    return {
      text: generateOfflineRoast(text, mood, telemetry),
      provider: 'offline',
      fallback: config.provider !== 'offline'
    };
  }

  async function testConnection(overrideConfig) {
    const cfg = { ...config, ...(overrideConfig || {}) };
    if (cfg.provider === 'offline') {
      return {
        ok: true,
        provider: 'offline',
        message: 'Built-in Offline Critic is active and ready (0ms latency).'
      };
    }
    if (!cfg.apiKey) {
      return {
        ok: false,
        provider: cfg.provider,
        message: 'API key is empty. Enter a valid key or switch to Offline Critic.'
      };
    }
    try {
      const samplePrompt = buildPrompt('Today I am testing YapPad at the hackathon.', 'passive-aggressive', {
        wpm: 42,
        backspaces: 3,
        errors: 1
      });
      const reply =
        cfg.provider === 'gemini'
          ? await callGemini(samplePrompt, cfg)
          : await callOpenAI(samplePrompt, cfg);
      return {
        ok: true,
        provider: cfg.provider,
        message: `Connected! Sample roast: "${reply}"`
      };
    } catch (err) {
      return {
        ok: false,
        provider: cfg.provider,
        message: `Connection failed (${err.message || 'timeout'}). Offline fallback will protect your demo.`
      };
    }
  }

  loadConfig();

  root.YP.AI = {
    getConfig() {
      return { ...config };
    },
    saveConfig,
    buildPrompt,
    generateOfflineRoast,
    roast,
    testConnection
  };
})();
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
