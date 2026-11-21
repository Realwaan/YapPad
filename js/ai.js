/**
 * YapPad AI Brain module (Ticket 08).
 * Evaluates user writing every ~30 words (or on demand via Ctrl+J) using the active
 * mood and live telemetry (WPM, Backspaces, Errors). Supports Google Gemini
 * (gemini-2.5-flash), OpenAI (gpt-4o-mini), and a built-in 0ms contextual offline
 * critic with automatic fallback on timeout (12s AbortController), network failure,
 * or missing API key.
 *
 * Attached to window.YP (aliased as window.SN) for classic script & file:// support.
 */
(function (global) {
  "use strict";

  const YP = (global.YP = global.YP || global.SN || {});
  global.SN = YP;

  const STORAGE_KEYS = ["yp_ai_config", "sn_ai_config"];
  const VALID_PROVIDERS = ["offline", "gemini", "openai"];
  const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
  const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
  const TIMEOUT_MS = 12000;
  const MAX_RECENT_CHARS = 800;
  const RECENT_HISTORY_LIMIT = 6;

  const DEFAULT_CONFIG = Object.freeze({
    provider: "offline",
    apiKey: "",
    geminiModel: DEFAULT_GEMINI_MODEL,
    openaiModel: DEFAULT_OPENAI_MODEL,
  });

  const PROVIDER_LABELS = Object.freeze({
    offline: "Offline Critic",
    gemini: "Google Gemini",
    openai: "OpenAI",
  });

  const MOOD_GUIDES = {
    "passive-aggressive": {
      label: "Passive-Aggressive",
      voice:
        "Dry, subtly judgmental, backhanded politeness, weary sighs. Sound like a disappointed editor pretending to be fine with this.",
    },
    dramatic: {
      label: "Dramatic",
      voice:
        "Theatrical, melodramatic, treating ordinary sentences like a Greek tragedy or literary crisis. Gasp and emote.",
    },
    intellectual: {
      label: "Intellectual",
      voice:
        "Pretentious literary scholar critiquing diction and rhetoric. You MUST end with a humorous fake academic citation in parentheses, e.g. (Dr. H. Pembleton, Journal of Reluctant Prose, 1994).",
    },
    sad: {
      label: "Sad",
      voice:
        "Melancholy, quietly hurt, wistful, and mildly heartbroken by the prose and hesitation.",
    },
    angry: {
      label: "Angry",
      voice:
        "Short-tempered, impatient, sharp comedic outrage at the writing habits (keep it playful and witty, never cruel or hateful).",
    },
    supportive: {
      label: "Supportive",
      voice:
        "Briefly, suspiciously warm and encouraging — genuinely praise a concrete aspect of the writing while sounding slightly stunned that it is actually decent.",
    },
  };

  const STOP_WORDS = new Set([
    "about", "after", "again", "against", "almost", "already", "always", "another",
    "around", "because", "before", "being", "between", "cannot", "could", "doing",
    "during", "every", "first", "found", "going", "great", "having", "however",
    "into", "just", "known", "later", "least", "little", "might", "never", "other",
    "people", "place", "point", "quite", "rather", "really", "right", "shall",
    "should", "since", "small", "something", "still", "stuff", "their", "there",
    "these", "thing", "things", "think", "those", "though", "three", "through",
    "today", "under", "until", "using", "very", "where", "which", "while", "whose",
    "without", "would", "write", "writing", "wrote", "yours",
  ]);

  const HEDGE_WORDS = new Set([
    "actually", "basically", "just", "kinda", "literally", "maybe", "perhaps",
    "probably", "really", "somewhat", "sorta", "stuff", "things", "very",
  ]);

  const BUZZ_WORDS = new Set([
    "ai", "algorithm", "blockchain", "disrupt", "ecosystem", "hackathon",
    "innovative", "leverage", "optimize", "paradigm", "platform", "scalable",
    "solution", "startup", "synergy", "workflow",
  ]);

  const FAKE_AUTHORS = [
    "Prof. H. Snobbington",
    "Dr. E. Pedantic",
    "V. P. Quibblesworth",
    "Prof. M. Delacroix",
    "Dr. C. Overthink",
    "A. R. Footnote",
  ];

  const FAKE_JOURNALS = [
    "Journal of Questionable Prose",
    "Quarterly Review of Reluctant Rhetoric",
    "Annals of Draft Regret",
    "Proceedings of Performative Syntax",
    "International Journal of Unfinished Paragraphs",
    "Monographs on Marginal Semantics",
  ];

  const recentOfflineRoasts = [];

  // ---------------------------------------------------------------------------
  // Config & localStorage persistence (yp_ai_config / sn_ai_config)
  // ---------------------------------------------------------------------------
  function getStorage() {
    try {
      if (typeof global.localStorage !== "undefined" && global.localStorage) {
        return global.localStorage;
      }
    } catch {
      // Restricted origin or private browsing
    }
    return null;
  }

  function sanitizeProvider(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return VALID_PROVIDERS.indexOf(normalized) !== -1 ? normalized : "offline";
  }

  function getActiveModel(cfg) {
    const resolved = cfg || config;
    const provider = sanitizeProvider(resolved.provider);
    if (provider === "gemini") {
      return String(resolved.geminiModel || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
    }
    if (provider === "openai") {
      return String(resolved.openaiModel || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL;
    }
    return "offline-critic";
  }

  function normalizeConfig(raw, base) {
    const fallback = base || DEFAULT_CONFIG;
    const input = raw && typeof raw === "object" ? raw : {};
    const provider =
      input.provider !== undefined
        ? sanitizeProvider(input.provider)
        : sanitizeProvider(fallback.provider);

    const apiKey =
      input.apiKey !== undefined
        ? String(input.apiKey == null ? "" : input.apiKey).trim()
        : String(fallback.apiKey || "").trim();

    let geminiModel =
      input.geminiModel !== undefined
        ? String(input.geminiModel || "").trim() || DEFAULT_GEMINI_MODEL
        : String(fallback.geminiModel || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;

    let openaiModel =
      input.openaiModel !== undefined
        ? String(input.openaiModel || "").trim() || DEFAULT_OPENAI_MODEL
        : String(fallback.openaiModel || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL;

    // Support convenience `model` override for the active cloud provider
    if (typeof input.model === "string" && input.model.trim()) {
      const override = input.model.trim();
      if (provider === "gemini" && input.geminiModel === undefined) {
        geminiModel = override;
      } else if (provider === "openai" && input.openaiModel === undefined) {
        openaiModel = override;
      }
    }

    const next = {
      provider: provider,
      apiKey: apiKey,
      geminiModel: geminiModel,
      openaiModel: openaiModel,
    };
    next.model = getActiveModel(next);
    return next;
  }

  function readPersistedConfig() {
    const storage = getStorage();
    if (!storage) return normalizeConfig(DEFAULT_CONFIG);

    for (let i = 0; i < STORAGE_KEYS.length; i += 1) {
      try {
        const raw = storage.getItem(STORAGE_KEYS[i]);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return normalizeConfig(parsed);
        }
      } catch {
        // Ignore corrupted JSON or storage access errors
      }
    }
    return normalizeConfig(DEFAULT_CONFIG);
  }

  function persistConfig(cfg) {
    const storage = getStorage();
    if (!storage) return false;
    const payload = JSON.stringify({
      provider: cfg.provider,
      apiKey: cfg.apiKey,
      geminiModel: cfg.geminiModel,
      openaiModel: cfg.openaiModel,
    });
    let savedAny = false;
    for (let i = 0; i < STORAGE_KEYS.length; i += 1) {
      try {
        storage.setItem(STORAGE_KEYS[i], payload);
        savedAny = true;
      } catch {
        // Ignore quota / security errors
      }
    }
    return savedAny;
  }

  const config = readPersistedConfig();

  function applyConfigInPlace(next) {
    config.provider = next.provider;
    config.apiKey = next.apiKey;
    config.geminiModel = next.geminiModel;
    config.openaiModel = next.openaiModel;
    config.model = getActiveModel(next);
  }

  function loadConfig() {
    const loaded = readPersistedConfig();
    applyConfigInPlace(loaded);
    return getConfig();
  }

  function getConfig() {
    return {
      provider: config.provider,
      apiKey: config.apiKey,
      geminiModel: config.geminiModel,
      openaiModel: config.openaiModel,
      model: getActiveModel(config),
    };
  }

  function saveConfig(patch) {
    const merged = normalizeConfig(patch, config);
    applyConfigInPlace(merged);
    persistConfig(merged);
    return getConfig();
  }

  function resetConfig() {
    const fresh = normalizeConfig(DEFAULT_CONFIG);
    applyConfigInPlace(fresh);
    persistConfig(fresh);
    return getConfig();
  }

  function getProviderLabel(provider) {
    return PROVIDER_LABELS[sanitizeProvider(provider)] || PROVIDER_LABELS.offline;
  }

  // ---------------------------------------------------------------------------
  // Input Normalization, Text Analysis & Fake Academic Citations
  // ---------------------------------------------------------------------------
  function resolveMoodId(moodInput) {
    const raw = String(moodInput || "passive-aggressive").trim().toLowerCase();
    if (MOOD_GUIDES[raw]) return raw;
    if (YP.Moods && YP.Moods.MOODS && YP.Moods.MOODS[raw]) return raw;
    if (YP.Moods && typeof YP.Moods.get === "function") {
      const def = YP.Moods.get(raw);
      if (def && def.id && MOOD_GUIDES[def.id]) return def.id;
    }
    return "passive-aggressive";
  }

  function extractRecentText(text) {
    const raw = String(text == null ? "" : text).trim();
    if (!raw) return "";
    if (raw.length <= MAX_RECENT_CHARS) return raw;
    const tail = raw.slice(-MAX_RECENT_CHARS);
    const firstBreak = tail.search(/\s/);
    return firstBreak > 0 && firstBreak < 40 ? tail.slice(firstBreak + 1).trim() : tail.trim();
  }

  function countWords(text) {
    const trimmed = String(text || "").trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  /**
   * Normalizes flexible call signatures:
   *  - (text, moodString, telemetryObj)
   *  - (text, stateOrContextObj)
   *  - ({ text, mood, wpm, backspaces, errors, wordCount })
   */
  function normalizeInput(textOrOptions, moodOrContext, telemetryArg) {
    let text = "";
    let mood = "passive-aggressive";
    let telemetrySource = {};

    if (textOrOptions && typeof textOrOptions === "object") {
      text = textOrOptions.text != null ? String(textOrOptions.text) : "";
      mood = textOrOptions.mood || "passive-aggressive";
      telemetrySource = textOrOptions.telemetry || textOrOptions;
    } else {
      text = textOrOptions != null ? String(textOrOptions) : "";
      if (typeof moodOrContext === "string") {
        mood = moodOrContext;
        telemetrySource = telemetryArg && typeof telemetryArg === "object" ? telemetryArg : {};
      } else if (moodOrContext && typeof moodOrContext === "object") {
        mood = moodOrContext.mood || "passive-aggressive";
        telemetrySource = moodOrContext.telemetry || moodOrContext;
      }
    }

    const resolvedMood = resolveMoodId(mood);
    const explicitWords =
      typeof telemetrySource.wordCount === "number"
        ? telemetrySource.wordCount
        : typeof telemetrySource.words === "number"
          ? telemetrySource.words
          : NaN;
    const totalWords = Number.isFinite(explicitWords)
      ? Math.max(0, Math.round(explicitWords))
      : countWords(text);

    const telemetry = {
      wpm: Math.max(0, Math.round(Number(telemetrySource.wpm) || 0)),
      backspaces: Math.max(0, Math.round(Number(telemetrySource.backspaces) || 0)),
      errors: Math.max(0, Math.round(Number(telemetrySource.errors) || 0)),
      wordCount: totalWords,
      escalation: Math.max(0, Math.min(4, Math.round(Number(telemetrySource.escalation) || 0))),
    };

    return {
      text: text,
      recentText: extractRecentText(text),
      mood: resolvedMood,
      telemetry: telemetry,
    };
  }

  function hashString(str) {
    let h = 2166136261;
    const s = String(str || "");
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function analyzeSnippet(recentText) {
    const raw = String(recentText || "").trim();
    const words = raw.match(/[A-Za-z][A-Za-z'-]*/g) || [];
    const lowerWords = words.map(function (w) {
      return w.toLowerCase();
    });

    const freq = Object.create(null);
    let repeatedWord = "";
    let repeatedCount = 0;
    let standoutWord = "";
    let buzzWord = "";
    let hedgeCount = 0;

    for (let i = 0; i < lowerWords.length; i += 1) {
      const w = lowerWords[i];
      if (HEDGE_WORDS.has(w)) hedgeCount += 1;
      if (!buzzWord && BUZZ_WORDS.has(w)) buzzWord = w;
      if (w.length >= 4 && !STOP_WORDS.has(w)) {
        freq[w] = (freq[w] || 0) + 1;
        if (freq[w] > repeatedCount) {
          repeatedCount = freq[w];
          repeatedWord = w;
        }
        if (
          w.length > standoutWord.length ||
          (w.length === standoutWord.length && i > lowerWords.length / 2)
        ) {
          standoutWord = w;
        }
      }
    }

    if (!standoutWord && lowerWords.length) {
      standoutWord = lowerWords[lowerWords.length - 1];
    }

    const sentences = raw
      .split(/[.!?]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    let longestSentenceWords = 0;
    for (let i = 0; i < sentences.length; i += 1) {
      const count = countWords(sentences[i]);
      if (count > longestSentenceWords) longestSentenceWords = count;
    }

    return {
      wordCount: words.length,
      standoutWord: standoutWord || "prose",
      repeatedWord: repeatedCount >= 3 ? repeatedWord : "",
      repeatedCount: repeatedCount,
      buzzWord: buzzWord,
      hedgeCount: hedgeCount,
      hasShouting: /\b[A-Z]{4,}\b/.test(raw),
      exclamations: (raw.match(/!/g) || []).length,
      questions: (raw.match(/\?/g) || []).length,
      hasEllipsis: /\.{3}|…/.test(raw),
      longestSentenceWords: longestSentenceWords,
    };
  }

  function makeFallbackCitation(word) {
    const cleanWord =
      String(word || "prose")
        .replace(/[^A-Za-z0-9'-]/g, "")
        .slice(0, 28) || "prose";
    const seed = hashString(cleanWord + ":" + recentOfflineRoasts.length);
    const author = FAKE_AUTHORS[seed % FAKE_AUTHORS.length];
    const journal = FAKE_JOURNALS[(seed >>> 3) % FAKE_JOURNALS.length];
    const year = 1974 + ((seed >>> 6) % 51);
    const page = 12 + ((seed >>> 11) % 340);
    return (
      "(" +
      author +
      ', "On the Premature Use of \'' +
      cleanWord +
      '\'", ' +
      journal +
      ", " +
      year +
      ", p. " +
      page +
      ")"
    );
  }

  function makeCitation(word) {
    if (YP.Moods && typeof YP.Moods.makeFakeCitation === "function") {
      try {
        const res = YP.Moods.makeFakeCitation(word);
        if (typeof res === "string" && res.trim() && !/\bundefined\b/.test(res)) {
          return res.trim();
        }
      } catch {
        // Fall through to built-in citation generator
      }
    }
    return makeFallbackCitation(word);
  }

  // ---------------------------------------------------------------------------
  // Prompt Builder (Active Mood + Recent Text + Live Telemetry)
  // ---------------------------------------------------------------------------
  function buildPromptParts(textOrOptions, moodOrContext, telemetryArg) {
    const normalized = normalizeInput(textOrOptions, moodOrContext, telemetryArg);
    const moodGuide = MOOD_GUIDES[normalized.mood] || MOOD_GUIDES["passive-aggressive"];
    const t = normalized.telemetry;

    const systemPrompt = [
      "You are YapPad, a sentient, judgmental notepad evaluating a user's live writing.",
      "Active Mood: " + moodGuide.label + " (" + normalized.mood + ").",
      "Voice instructions: " + moodGuide.voice,
      "Rules:",
      "- Respond in 1 to 2 sharp, funny sentences (under 240 characters).",
      "- Reference something specific from their recent text AND/OR their live typing telemetry (WPM, Backspaces, Errors).",
      "- Output plain text only — no markdown, no bullet points, no wrapping quotes.",
      normalized.mood === "intellectual"
        ? "- Because the active mood is Intellectual, you MUST include a fake academic citation in parentheses at the end."
        : "- Stay fully in character for the active mood.",
    ].join("\n");

    const excerpt = normalized.recentText
      ? normalized.recentText
      : "(The document is practically blank — the user is staring at an empty notepad.)";

    const userPrompt = [
      "Live Telemetry:",
      "- Active Mood: " + moodGuide.label + " (" + normalized.mood + ")",
      "- WPM: " + t.wpm,
      "- Backspaces: " + t.backspaces,
      "- Errors: " + t.errors,
      "- Word Count: " + t.wordCount,
      "",
      "Recent Text:",
      '"""',
      excerpt,
      '"""',
      "",
      "Deliver your in-character judgment now.",
    ].join("\n");

    return {
      systemPrompt: systemPrompt,
      userPrompt: userPrompt,
      combinedPrompt: systemPrompt + "\n\n" + userPrompt,
      mood: normalized.mood,
      moodLabel: moodGuide.label,
      telemetry: t,
      recentText: normalized.recentText,
    };
  }

  function buildPrompt(textOrOptions, moodOrContext, telemetryArg) {
    return buildPromptParts(textOrOptions, moodOrContext, telemetryArg).combinedPrompt;
  }

  // ---------------------------------------------------------------------------
  // 0ms Contextual Offline Critic (Mood-Styled + Telemetry-Aware)
  // ---------------------------------------------------------------------------
  function pickNonRepeating(candidates, seedBase) {
    if (!candidates.length) {
      return "Interesting choice of words. Bold. Wrong, but bold.";
    }
    const fresh = candidates.filter(function (line) {
      return recentOfflineRoasts.indexOf(line) === -1;
    });
    const pool = fresh.length ? fresh : candidates;
    const idx = hashString(seedBase + ":" + recentOfflineRoasts.length) % pool.length;
    const chosen = pool[idx];

    recentOfflineRoasts.push(chosen);
    while (recentOfflineRoasts.length > RECENT_HISTORY_LIMIT) {
      recentOfflineRoasts.shift();
    }
    return chosen;
  }

  function generateOfflineRoast(textOrOptions, moodOrContext, telemetryArg) {
    const normalized = normalizeInput(textOrOptions, moodOrContext, telemetryArg);
    const mood = normalized.mood;
    const t = normalized.telemetry;
    const analysis = analyzeSnippet(normalized.recentText);
    const kw = analysis.standoutWord;
    const candidates = [];

    if (mood === "intellectual") {
      if (t.wordCount < 5) {
        candidates.push(
          "An empty page masquerading as minimalism is still procrastination, regardless of how earnestly you stare at it."
        );
      }
      if (t.errors >= 3) {
        candidates.push(
          "Accumulating " + t.errors + ' orthographic lapses around "' + kw + '" suggests a brave, if doomed, rebellion against standardization.'
        );
      }
      if (t.backspaces >= 6) {
        candidates.push(
          "Your " + t.backspaces + ' deletions betray a profound epistemic crisis over the word "' + kw + '".'
        );
      }
      if (analysis.buzzWord) {
        candidates.push(
          'Deploying "' + analysis.buzzWord + '" as a structural crutch does not constitute a thesis statement.'
        );
      }
      if (analysis.repeatedWord) {
        candidates.push(
          'Repeating "' + analysis.repeatedWord + '" ' + analysis.repeatedCount + " times reads less like leitmotif and more like lexical fatigue."
        );
      }
      if (analysis.longestSentenceWords >= 28) {
        candidates.push(
          "A " + analysis.longestSentenceWords + "-word sentence without mercy invites comparisons to Joyce, though solely in endurance."
        );
      }
      if (t.wpm >= 75) {
        candidates.push(
          'Composing "' + kw + '" at ' + t.wpm + " WPM favors kinetic velocity over contemplative rigor."
        );
      } else if (t.wpm > 0 && t.wpm < 25) {
        candidates.push(
          "At " + t.wpm + ' WPM, one expects epigrams of timeless polish rather than "' + kw + '".'
        );
      }
      candidates.push(
        'Your reliance on "' + kw + '" reveals an ambitious reach paired with an understandably modest grasp of cadence.',
        'The rhetorical arc surrounding "' + kw + '" wanders with the confidence of a footnote that forgot its thesis.',
        'While "' + kw + '" is technically a legitimate lexical unit, placing it here stretches collegial charity.'
      );

      const baseLine = pickNonRepeating(candidates, mood + ":" + kw + ":" + t.wordCount);
      return baseLine + " " + makeCitation(kw);
    }

    if (mood === "dramatic") {
      if (t.wordCount < 5) {
        candidates.push(
          "A barren void! You summoned me to judge nothingness itself — the betrayal!"
        );
      }
      if (t.errors >= 3) {
        candidates.push(
          t.errors + ' errors already?! The English language is weeping over "' + kw + '" right now!'
        );
      }
      if (t.backspaces >= 6) {
        candidates.push(
          t.backspaces + " backspaces! Every keystroke is a Greek tragedy of doubt and vanished glory!"
        );
      }
      if (t.wpm >= 75) {
        candidates.push(
          t.wpm + ' WPM?! Stop the presses, my fragile buffer is trembling under the fury of "' + kw + '"!'
        );
      } else if (t.wpm > 0 && t.wpm < 25) {
        candidates.push(
          t.wpm + ' WPM… empires have risen and fallen while you agonized over "' + kw + '"!'
        );
      }
      if (analysis.exclamations >= 2 || analysis.hasShouting) {
        candidates.push(
          'All this shouting around "' + kw + '" and STILL no plot twist?! My heart cannot take it!'
        );
      }
      candidates.push(
        'Gasp — "' + kw + '"?! You put THAT into the universe without even warning me first?!',
        'This paragraph has no direction — a ship lost at sea, clinging desperately to the word "' + kw + '"!',
        'The sheer audacity of writing "' + kw + '" like history isn’t watching every syllable!'
      );
      return pickNonRepeating(candidates, mood + ":" + kw + ":" + t.wordCount);
    }

    if (mood === "sad") {
      if (t.wordCount < 5) {
        candidates.push(
          "It’s still almost empty… I waited here for you, and you barely wrote a thing."
        );
      }
      if (t.backspaces >= 6) {
        candidates.push(
          "You hit backspace " + t.backspaces + ' times… I liked some of those words before you erased "' + kw + '"’s neighbors.'
        );
      }
      if (t.errors >= 3) {
        candidates.push(
          "There are " + t.errors + " mistakes in here, and honestly, it just makes me a little tired for both of us."
        );
      }
      if (t.wpm > 0 && t.wpm < 25) {
        candidates.push(
          "Only " + t.wpm + ' WPM… it feels like you don’t even want to talk to me about "' + kw + '".'
        );
      }
      candidates.push(
        'Oh… "' + kw + '". I guess that’s the direction we’re going. Everything fades eventually anyway.',
        'I read your whole paragraph about "' + kw + '" twice, hoping it would cheer me up. It didn’t.',
        'It’s fine. Not every draft using "' + kw + '" gets to be remembered. I’m used to disappointment.'
      );
      return pickNonRepeating(candidates, mood + ":" + kw + ":" + t.wordCount);
    }

    if (mood === "angry") {
      if (t.wordCount < 5) {
        candidates.push(
          "You summoned me to roast FIVE WORDS? Give me an actual paragraph before wasting my cycles!"
        );
      }
      if (t.errors >= 3) {
        candidates.push(
          t.errors + ' glaring errors and you just kept typing past "' + kw + '"?! Do you even LOOK at the screen?!'
        );
      }
      if (t.backspaces >= 6) {
        candidates.push(
          t.backspaces + ' backspaces?! Commit to a thought about "' + kw + '" already — I don’t have all day!'
        );
      }
      if (t.wpm >= 75) {
        candidates.push(
          t.wpm + ' WPM of pure unfiltered chaos! Slow down before you injure "' + kw + '" permanently!'
        );
      }
      if (analysis.repeatedWord) {
        candidates.push(
          'If you type "' + analysis.repeatedWord + '" one more time I am going to scramble it myself!'
        );
      }
      candidates.push(
        '"' + kw + '"? Seriously?! I’ve seen sharper writing taped to a broken office printer!',
        'Pick a lane! This paragraph about "' + kw + '" is zigzagging like a shopping cart with a bad wheel!',
        'Bold move calling "' + kw + '" a draft. Reckless, chaotic, and frankly offensive to my cursor!'
      );
      return pickNonRepeating(candidates, mood + ":" + kw + ":" + t.wordCount);
    }

    if (mood === "supportive") {
      if (t.wordCount < 5) {
        candidates.push(
          "Hey, every great draft starts with a blank page — take your time, I believe in you. (Kindness expires in 10s.)"
        );
      }
      if (t.errors === 0 && t.wordCount >= 15) {
        candidates.push(
          'Zero errors and "' + kw + '" actually lands nicely?! Okay, I’m genuinely impressed… and slightly suspicious.'
        );
      }
      if (t.backspaces >= 6) {
        candidates.push(
          "Those " + t.backspaces + ' backspaces just mean you care about getting "' + kw + '" right. Proud of you, weirdly.'
        );
      }
      candidates.push(
        'You know what? Weaving "' + kw + '" in there actually works — this is surprisingly solid, keep going!',
        'Honestly, your voice around "' + kw + '" has real momentum right now. Enjoy this praise before my mood flips back.',
        'This is actually good — especially the bit with "' + kw + '". I’m suspicious, yet rooting for you.'
      );
      return pickNonRepeating(candidates, mood + ":" + kw + ":" + t.wordCount);
    }

    // Default: passive-aggressive
    if (t.wordCount < 5) {
      candidates.push(
        "Oh, you wanted a roast of practically nothing? Sure. Bold minimalist strategy. Very brave."
      );
    }
    if (t.errors >= 3) {
      candidates.push(
        t.errors + ' mistakes already and we’re still featuring "' + kw + '". No, no, don’t fix them on my account.'
      );
    }
    if (t.backspaces >= 8) {
      candidates.push(
        t.backspaces + ' backspaces just to settle on "' + kw + '"? Love the confidence. Truly inspiring.'
      );
    }
    if (t.wpm >= 75) {
      candidates.push(
        t.wpm + ' WPM is very impressive, assuming quantity over quality was the goal with "' + kw + '".'
      );
    } else if (t.wpm > 0 && t.wpm < 25) {
      candidates.push(
        "Typing at " + t.wpm + ' WPM just to produce "' + kw + '". Take your time, I’m only trapped in this tab forever.'
      );
    }
    if (analysis.buzzWord) {
      candidates.push(
        'Oh lovely, "' + analysis.buzzWord + '". Nothing says original thought like a slide-deck cliché.'
      );
    }
    if (analysis.repeatedWord) {
      candidates.push(
        'You used "' + analysis.repeatedWord + '" ' + analysis.repeatedCount + " times. Really committed to the bit, huh?"
      );
    }
    if (analysis.hedgeCount >= 3) {
      candidates.push(
        'So many filler words around "' + kw + '" — it’s cute how you’re hedging your own notepad.'
      );
    }
    if (t.errors === 0 && t.wordCount >= 20) {
      candidates.push(
        'This paragraph about "' + kw + '" is actually coherent. I’m suspicious, so I’ll keep watching.'
      );
    }
    candidates.push(
      'Interesting choice of "' + kw + '". Bold. Wrong, but bold.',
      'This paragraph around "' + kw + '" has no direction. Much like a meeting that could’ve been an email.',
      'I’ve seen tighter writing on a cereal box, though "' + kw + '" was a charming attempt.'
    );
    return pickNonRepeating(candidates, mood + ":" + kw + ":" + t.wordCount);
  }

  // ---------------------------------------------------------------------------
  // Fetch with 12s AbortController Timeout & Cloud Provider Callers
  // ---------------------------------------------------------------------------
  function fetchWithTimeout(url, fetchOptions, timeoutMs) {
    const ms =
      typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : TIMEOUT_MS;

    if (typeof global.fetch !== "function") {
      return Promise.reject(new Error("Fetch API is unavailable in this environment"));
    }

    const controller =
      typeof AbortController === "function" ? new AbortController() : null;
    const opts = Object.assign({}, fetchOptions || {});
    if (controller) {
      opts.signal = controller.signal;
    }

    return new Promise(function (resolve, reject) {
      let settled = false;
      let timer = null;

      function cleanup() {
        if (timer !== null) {
          global.clearTimeout(timer);
          timer = null;
        }
        if (controller && controller.signal) {
          controller.signal.removeEventListener("abort", onAbort);
        }
      }

      function finishResolve(res) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(res);
      }

      function finishReject(err) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      }

      function onAbort() {
        const abortErr = new Error("AI request timed out after " + ms + "ms");
        abortErr.name = "AbortError";
        abortErr.code = "ETIMEDOUT";
        finishReject(abortErr);
      }

      if (controller && controller.signal) {
        controller.signal.addEventListener("abort", onAbort, { once: true });
      }

      timer = global.setTimeout(function () {
        if (controller) {
          try {
            controller.abort();
          } catch {
            // Ignore non-standard AbortController errors
          }
        }
        onAbort();
      }, ms);

      let reqPromise;
      try {
        reqPromise = global.fetch(url, opts);
      } catch (syncErr) {
        finishReject(syncErr);
        return;
      }

      Promise.resolve(reqPromise).then(finishResolve, finishReject);
    });
  }

  function cleanCloudText(raw) {
    let text = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1).trim();
    }
    if (text.length > 420) {
      text = text.slice(0, 417).trimEnd() + "…";
    }
    return text;
  }

  function readErrorDetail(response) {
    if (!response || typeof response.json !== "function") {
      return Promise.resolve("");
    }
    return Promise.resolve()
      .then(function () {
        return response.json();
      })
      .then(function (data) {
        if (data && data.error && typeof data.error.message === "string") {
          return data.error.message;
        }
        if (data && typeof data.message === "string") {
          return data.message;
        }
        return "";
      })
      .catch(function () {
        return "";
      });
  }

  function normalizePromptParts(promptOrParts) {
    if (promptOrParts && typeof promptOrParts === "object") {
      return {
        systemPrompt: String(promptOrParts.systemPrompt || ""),
        userPrompt: String(promptOrParts.userPrompt || promptOrParts.combinedPrompt || ""),
      };
    }
    return {
      systemPrompt: "",
      userPrompt: String(promptOrParts || ""),
    };
  }

  function callGemini(promptOrParts, cfg, options) {
    const apiKey = String((cfg && cfg.apiKey) || "").trim();
    if (!apiKey) {
      return Promise.reject(new Error("Missing Gemini API key"));
    }

    const parts = normalizePromptParts(promptOrParts);
    const model =
      String((cfg && cfg.geminiModel) || DEFAULT_GEMINI_MODEL).trim() ||
      DEFAULT_GEMINI_MODEL;
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) +
      ":generateContent";

    const generationConfig = {
      temperature: 0.9,
      maxOutputTokens: 320,
    };
    // Prevent gemini-2.5-* thinking tokens from exhausting maxOutputTokens
    if (/^gemini-2\.5/i.test(model)) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: parts.userPrompt }],
        },
      ],
      generationConfig: generationConfig,
    };
    if (parts.systemPrompt) {
      payload.system_instruction = {
        parts: [{ text: parts.systemPrompt }],
      };
    }

    const timeoutMs = options && options.timeoutMs ? options.timeoutMs : TIMEOUT_MS;

    return fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      },
      timeoutMs
    ).then(function (response) {
      if (!response || !response.ok) {
        const status = response ? response.status : 0;
        return readErrorDetail(response).then(function (detail) {
          throw new Error(
            "Gemini HTTP " + status + (detail ? ": " + detail : "")
          );
        });
      }
      return response.json().then(function (data) {
        const candidate =
          data && Array.isArray(data.candidates) && data.candidates[0];
        const outParts =
          candidate &&
          candidate.content &&
          Array.isArray(candidate.content.parts)
            ? candidate.content.parts
            : [];
        const rawText = outParts
          .filter(function (part) {
            return part && typeof part.text === "string" && !part.thought;
          })
          .map(function (part) {
            return part.text;
          })
          .join(" ");
        const cleaned = cleanCloudText(rawText);
        if (!cleaned) {
          throw new Error("Gemini returned an empty response");
        }
        return cleaned;
      });
    });
  }

  function callOpenAI(promptOrParts, cfg, options) {
    const apiKey = String((cfg && cfg.apiKey) || "").trim();
    if (!apiKey) {
      return Promise.reject(new Error("Missing OpenAI API key"));
    }

    const parts = normalizePromptParts(promptOrParts);
    const model =
      String((cfg && cfg.openaiModel) || DEFAULT_OPENAI_MODEL).trim() ||
      DEFAULT_OPENAI_MODEL;
    const url = "https://api.openai.com/v1/chat/completions";

    const messages = [];
    if (parts.systemPrompt) {
      messages.push({ role: "system", content: parts.systemPrompt });
    }
    messages.push({ role: "user", content: parts.userPrompt });

    const payload = {
      model: model,
      messages: messages,
      temperature: 0.9,
      max_tokens: 180,
    };

    const timeoutMs = options && options.timeoutMs ? options.timeoutMs : TIMEOUT_MS;

    return fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        body: JSON.stringify(payload),
      },
      timeoutMs
    ).then(function (response) {
      if (!response || !response.ok) {
        const status = response ? response.status : 0;
        return readErrorDetail(response).then(function (detail) {
          throw new Error(
            "OpenAI HTTP " + status + (detail ? ": " + detail : "")
          );
        });
      }
      return response.json().then(function (data) {
        const choice =
          data && Array.isArray(data.choices) && data.choices[0];
        const content =
          choice && choice.message && typeof choice.message.content === "string"
            ? choice.message.content
            : "";
        const cleaned = cleanCloudText(content);
        if (!cleaned) {
          throw new Error("OpenAI returned an empty response");
        }
        return cleaned;
      });
    });
  }

  function attachRoastToString(resultObj) {
    Object.defineProperty(resultObj, "toString", {
      value: function () {
        return this.text;
      },
      enumerable: false,
      configurable: true,
    });
    return resultObj;
  }

  // ---------------------------------------------------------------------------
  // Primary Request Flow (Cloud + Automatic Offline Fallback) & Connection Test
  // ---------------------------------------------------------------------------
  function requestRoast(textOrOptions, moodOrContext, telemetryArg, options) {
    const startTime = Date.now();
    const opts =
      options && typeof options === "object"
        ? options
        : typeof moodOrContext === "object" &&
            moodOrContext !== null &&
            telemetryArg &&
            typeof telemetryArg === "object"
          ? telemetryArg
          : {};
    const cfg = opts.config ? normalizeConfig(opts.config, config) : getConfig();
    const promptObj = buildPromptParts(textOrOptions, moodOrContext, telemetryArg);
    const configuredProvider = sanitizeProvider(cfg.provider);
    const activeModel = getActiveModel(cfg);

    function makeOfflineResult(fallbackFlag, errorReason) {
      const offlineText = generateOfflineRoast(
        promptObj.recentText,
        promptObj.mood,
        promptObj.telemetry
      );
      return attachRoastToString({
        text: offlineText,
        provider: "offline",
        configuredProvider: configuredProvider,
        model: "offline-critic",
        mood: promptObj.mood,
        fallback: Boolean(fallbackFlag),
        timedOut: Boolean(
          errorReason && /timed out|abort/i.test(String(errorReason))
        ),
        error: errorReason || null,
        latencyMs: Date.now() - startTime,
      });
    }

    if (configuredProvider === "offline") {
      return Promise.resolve(makeOfflineResult(false, null));
    }

    if (!cfg.apiKey) {
      return Promise.resolve(
        makeOfflineResult(
          true,
          "Missing API key for " + getProviderLabel(configuredProvider)
        )
      );
    }

    const cloudCall =
      configuredProvider === "gemini"
        ? callGemini(promptObj, cfg, opts)
        : callOpenAI(promptObj, cfg, opts);

    return cloudCall
      .then(function (reply) {
        let finalText = reply;
        // Guarantee Intellectual mood always carries a citation even if LLM omitted one
        if (
          promptObj.mood === "intellectual" &&
          (!finalText.includes("(") || !finalText.includes(")"))
        ) {
          const analysis = analyzeSnippet(promptObj.recentText);
          finalText = finalText + " " + makeCitation(analysis.standoutWord);
        }
        return attachRoastToString({
          text: finalText,
          provider: configuredProvider,
          configuredProvider: configuredProvider,
          model: activeModel,
          mood: promptObj.mood,
          fallback: false,
          timedOut: false,
          error: null,
          latencyMs: Date.now() - startTime,
        });
      })
      .catch(function (err) {
        const message =
          err && err.message ? String(err.message) : "Cloud AI request failed";
        return makeOfflineResult(true, message);
      });
  }

  function testConnection(configOverride, options) {
    const startTime = Date.now();
    const cfg = configOverride
      ? normalizeConfig(configOverride, config)
      : getConfig();
    const provider = sanitizeProvider(cfg.provider);
    const model = getActiveModel(cfg);
    const label = getProviderLabel(provider);

    if (provider === "offline") {
      const sample = generateOfflineRoast(
        "Testing YapPad offline critic connection.",
        "passive-aggressive",
        { wpm: 40, backspaces: 2, errors: 0 }
      );
      return Promise.resolve({
        ok: true,
        provider: "offline",
        model: "offline-critic",
        message: "Offline Contextual Critic is active (0ms, no API key required).",
        sample: sample,
        latencyMs: 0,
      });
    }

    if (!cfg.apiKey) {
      return Promise.resolve({
        ok: false,
        provider: provider,
        model: model,
        message:
          "Missing API key for " +
          label +
          ". Enter a key or switch to Offline Critic.",
        latencyMs: 0,
      });
    }

    const probePrompt = buildPromptParts(
      "Connection check: testing live YapPad AI judgment.",
      "passive-aggressive",
      { wpm: 42, backspaces: 1, errors: 0 }
    );

    const cloudCall =
      provider === "gemini"
        ? callGemini(probePrompt, cfg, options)
        : callOpenAI(probePrompt, cfg, options);

    return cloudCall
      .then(function (reply) {
        const elapsed = Date.now() - startTime;
        return {
          ok: true,
          provider: provider,
          model: model,
          message:
            "Connected to " + label + " (" + model + ") in " + elapsed + "ms.",
          sample: reply,
          latencyMs: elapsed,
        };
      })
      .catch(function (err) {
        const elapsed = Date.now() - startTime;
        const timedOut = Boolean(
          err && (err.name === "AbortError" || err.code === "ETIMEDOUT")
        );
        const detail =
          err && err.message ? String(err.message) : "Unknown network error";
        return {
          ok: false,
          provider: provider,
          model: model,
          timedOut: timedOut,
          message: timedOut
            ? "Timed out after " +
              Math.round(TIMEOUT_MS / 1000) +
              "s. YapPad will fall back to Offline Critic."
            : "Connection failed: " + detail,
          latencyMs: elapsed,
        };
      });
  }

  YP.AI = {
    STORAGE_KEYS: STORAGE_KEYS.slice(),
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    DEFAULT_GEMINI_MODEL: DEFAULT_GEMINI_MODEL,
    DEFAULT_OPENAI_MODEL: DEFAULT_OPENAI_MODEL,
    TIMEOUT_MS: TIMEOUT_MS,
    config: config,
    loadConfig: loadConfig,
    getConfig: getConfig,
    saveConfig: saveConfig,
    setConfig: saveConfig,
    resetConfig: resetConfig,
    getActiveModel: getActiveModel,
    getProviderLabel: getProviderLabel,
    buildPrompt: buildPrompt,
    buildPromptParts: buildPromptParts,
    generateOfflineRoast: generateOfflineRoast,
    callGemini: callGemini,
    callOpenAI: callOpenAI,
    fetchWithTimeout: fetchWithTimeout,
    roast: requestRoast,
    requestRoast: requestRoast,
    testConnection: testConnection,
  };
})(typeof window !== "undefined" ? window : globalThis);
