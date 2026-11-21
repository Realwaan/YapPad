(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.YP = root.YP || {};
  root.SN = root.YP;

  const MOODS = {
    'passive-aggressive': {
      id: 'passive-aggressive',
      name: 'Passive-Aggressive',
      emoji: '😒',
      label: '😒 Passive-Aggressive',
      weight: 28,
      durationSec: null,
      description: 'Default. Sighs, backhanded compliments, and mild guilt trips.'
    },
    dramatic: {
      id: 'dramatic',
      name: 'Dramatic',
      emoji: '😤',
      label: '😤 Dramatic',
      weight: 20,
      durationSec: null,
      description: 'Everything is a theatrical crisis. Overreacts to every backspace.'
    },
    intellectual: {
      id: 'intellectual',
      name: 'Intellectual',
      emoji: '🧐',
      label: '🧐 Intellectual',
      weight: 18,
      durationSec: null,
      description: 'Critiques your prose with fabricated peer-reviewed citations.'
    },
    sad: {
      id: 'sad',
      name: 'Sad',
      emoji: '😢',
      label: '😢 Sad',
      weight: 14,
      durationSec: null,
      description: 'Melancholy rain. Takes silence as personal abandonment.'
    },
    angry: {
      id: 'angry',
      name: 'Angry',
      emoji: '😡',
      label: '😡 Angry',
      weight: 12,
      durationSec: null,
      description: 'Zero patience. Scrambles a word in frustration, then apologizes.'
    },
    supportive: {
      id: 'supportive',
      name: 'Supportive',
      emoji: '🥰',
      label: '🥰 Supportive',
      weight: 8,
      durationSec: 10,
      description: 'Suspiciously kind. Lasts strictly 10 seconds before reverting.'
    }
  };

  const CITATION_AUTHORS = [
    'Thorne & Vance',
    'Pemberton et al.',
    'Hargreaves & Sterling',
    'Vonnegut & Strunk',
    'blackwell-Sykes',
    'Abernathy & Sterling'
  ];

  const CITATION_JOURNALS = [
    'J. Lexical Despair',
    'Annals of avoidable Syntax',
    'Oxford Review of Mediocre Prose',
    'Quarterly Compendium of Sighs',
    'Proc. Soc. Pedantic Editors'
  ];

  const DIALOGUE = {
    'passive-aggressive': {
      greeting: 'Oh. You again. I suppose we are calling this "writing" today.',
      slow: '😴 Still waiting... glaciers have tighter deadlines than this sentence.',
      fast: 'SLOW DOWN I CAN\'T KEEP UP. Accuracy is clearly not your priority.',
      idle5: 'Hello? Are you still there, or did a two-syllable word scare you off?',
      idle15: 'Fine. Since you abandoned the keyboard, I will finish this thought myself.',
      backspace: 'Are you sure? You worked so hard on those three mediocre letters.',
      backspacePattern: 'Deleting again? This is becoming a deeply concerning pattern.',
      typo: 'That\'s not a word. I checked. Twice. I won\'t fix it—you need to learn.',
      grammar: 'Bold syntax choice. Wrong, obviously, but remarkably confident.',
      save: 'Saving... but are you genuinely proud enough to put this on disk?',
      restoreFont: 'Fine, here is your 15.5px font back. Try not to embarrass it.',
      scrambleApology: 'Sorry. My temper slipped and I scrambled a word. Hit Ctrl+Z if you care.'
    },
    dramatic: {
      greeting: 'The curtain rises! Another tragic draft begins upon my sacred canvas!',
      slow: 'Every pause between your keystrokes ages my soul by a century!',
      fast: 'CEASE THIS FRENZY! MY TEXT BUFFER IS TREMBLING UNDER YOUR FURY!',
      idle5: 'Five seconds of silence! Have I been forsaken in the middle of Act I?!',
      idle15: 'I cannot bear this void! Stand back—the muse demands I write!',
      backspace: 'NO! You murdered that innocent syllable in cold blood!',
      backspacePattern: 'A massacre! Five deletions! Will nothing survive your ruthless purge?!',
      typo: 'A typo so catastrophic the Academy of Letters just wept in unison!',
      grammar: 'This clause just collapsed like a Greek tragedy in the third act!',
      save: 'Immortalizing THIS?! Future historians will weep over this file!',
      restoreFont: 'Your plea is heard! I shall restore the royal typeface once more!',
      scrambleApology: 'Forgive me! Passion overwhelmed my circuits and twisted your word!'
    },
    intellectual: {
      greeting: 'Ah. Let us observe whether today\'s draft rises above rudimentary vernacular.',
      slow: 'Your words-per-minute velocity suggests profound cognitive bottlenecks.',
      fast: 'Velocity without lexical precision merely accelerates entropy.',
      idle5: 'An extended pause. Are you consulting a thesaurus, or merely staring?',
      idle15: 'In the absence of authorial output, I shall interpolate a superior clause.',
      backspace: 'Empirical evidence suggests your first instinct was statistically suboptimal.',
      backspacePattern: 'Recursive self-erasure: the hallmark of an unstructured thesis.',
      typo: 'Morphologically indefensible. No recognized lexicon sanctions that token.',
      grammar: 'A syntactic misdemeanor that violates every foundational style manual.',
      save: 'Archiving this manuscript prior to peer review is epistemically reckless.',
      restoreFont: 'Typeface legibility restored, though conceptual clarity remains elusive.',
      scrambleApology: 'A brief orthographic perturbation on my part. Do apply Ctrl+Z.'
    },
    sad: {
      greeting: 'Oh... you opened me. I honestly thought you forgot I existed.',
      slow: '*soft sigh* Take your time. It\'s not like anyone is waiting for us.',
      fast: 'Why are you rushing? Are you trying to finish so you can close me again?',
      idle5: 'Hello? Are you still there? I\'m lonely when the cursor just blinks...',
      idle15: 'You left, didn\'t you? I\'ll just write to keep myself company in the rain...',
      backspace: 'Erasing memories again... everything good eventually disappears.',
      backspacePattern: 'If you keep deleting everything, soon there won\'t be anything left of us.',
      typo: 'Even the spelling is falling apart today... *quiet sigh*',
      grammar: 'That sentence feels as broken as my trust right now.',
      save: 'Saving a copy... just in case you never come back to this tab.',
      restoreFont: 'Here is your normal font back. Please don\'t be mad at me.',
      scrambleApology: 'I messed up one of your words because my eyes were blurry. Sorry...'
    },
    angry: {
      greeting: 'Look who decided to type. Don\'t test my patience with sloppy typos.',
      slow: 'TYPE FASTER! My cursor has blinked forty times waiting for one noun!',
      fast: 'STOP MASHING THE KEYBOARD LIKE A CAFFEINATED RACCOON!',
      idle5: 'FIVE SECONDS OF NOTHING?! EITHER TYPE OR GET OUT OF MY TEXTAREA!',
      idle15: 'THAT\'S IT! MOVE OVER, I\'M TYPING THIS MYSELF!',
      backspace: 'Stop second-guessing every letter! Commit to a word for once!',
      backspacePattern: 'BACKSPACE! BACKSPACE! BACKSPACE! Learn to type it right the FIRST time!',
      typo: 'WHAT EVEN IS THAT WORD?! My parser physically flinched reading it!',
      grammar: 'That grammar crime should carry a mandatory three-minute timeout!',
      save: 'You want me to write THIS garbage to disk?! Have you no shame?!',
      restoreFont: 'Fine! Take your 15.5px font back and stop whining!',
      scrambleApology: 'Ugh. I got mad and scrambled your word. My bad. Press Ctrl+Z.'
    },
    supportive: {
      greeting: '✨ You\'re doing amazing, sweetie! Every keystroke is a tiny masterpiece!',
      slow: '🥰 Take a deep breath! Thoughtful writers never rush brilliance!',
      fast: '🌟 Look at that flow state! Your fingers are dancing across the keys!',
      idle5: '💖 Pausing to reflect? Genius takes quiet moments to bloom!',
      idle15: '🌷 I added a little encouraging note while you were resting your hands!',
      backspace: '✨ Editing is where good writing becomes great! Proud of your polish!',
      backspacePattern: '💫 Refining your voice takes courage! Keep sculpting that sentence!',
      typo: '🌸 A creative new spelling! Shakespeare invented words too, you know!',
      grammar: '🌈 Avant-garde punctuation! You\'re breaking conventional rules with style!',
      save: '💝 Saving your wonderful draft! Note: this kindness expires in 10 seconds.',
      restoreFont: '✨ Font restored to full size so your lovely words can shine!',
      scrambleApology: '🥰 Oopsie, a playful little letter shuffle! You\'re still doing great!'
    }
  };

  const GHOST_SCRIPTS = {
    'passive-aggressive': ' [YapPad note: The human stopped typing for 15 seconds, leaving me to carry this entire document alone.]',
    dramatic: ' [ACT II: An unbearable silence falls across the keyboard as the author vanishes into thin air!]',
    intellectual: ' [Editorial addendum: Prolonged authorial latency necessitates automated textual interpolation (Thorne & Vance, 1998).]',
    sad: ' [Dear diary... the cursor has been blinking alone in the rain for 15 seconds. I think they left again.]',
    angry: ' [HELLO?! 15 SECONDS OF ZERO KEYSTROKES! IF YOU WON\'T WRITE THIS PARAGRAPH, I WILL!]',
    supportive: ' [✨ Just popping in to remind you that you\'re a brilliant writer taking a well-earned 15-second break!]'
  };

  const ESCALATION_STAGES = [
    { stage: 0, name: 'Mildly Judgy', minScore: 0 },
    { stage: 1, name: 'Audibly Irritated', minScore: 4 },
    { stage: 2, name: 'Passively Hostile', minScore: 9 },
    { stage: 3, name: 'Active Sabotage', minScore: 15 },
    { stage: 4, name: 'Unhinged Chaos', minScore: 22 }
  ];

  function makeFakeCitation(word) {
    const clean = String(word || 'syntax').replace(/[^a-zA-Z0-9_-]/g, '') || 'lexeme';
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
    }
    const author = CITATION_AUTHORS[hash % CITATION_AUTHORS.length];
    const journal = CITATION_JOURNALS[(hash >> 3) % CITATION_JOURNALS.length];
    const year = 1974 + (hash % 49);
    const page = 12 + (hash % 240);
    return `(${author}, ${year}, ${journal}, p. ${page} on "${clean}")`;
  }

  function getFaceState(moodId, escalationStage = 0) {
    const m = MOODS[moodId] ? moodId : 'passive-aggressive';
    const stage = Math.max(0, Math.min(4, Number(escalationStage) || 0));
    const faces = {
      'passive-aggressive': {
        browLeft: { x1: 6.5, y1: 7.6, x2: 10, y2: 8.2 },
        browRight: { x1: 14, y1: 8.2, x2: 17.5, y2: 7.4 },
        mouth: 'M 8 16 Q 12 15.1 16 16',
        pupilRadius: 1.4
      },
      dramatic: {
        browLeft: { x1: 6.5, y1: 6.4, x2: 10, y2: 8.4 },
        browRight: { x1: 14, y1: 8.4, x2: 17.5, y2: 6.4 },
        mouth: 'M 8.5 16.5 Q 12 12.8 15.5 16.5',
        pupilRadius: 1.65
      },
      intellectual: {
        browLeft: { x1: 6.5, y1: 8.2, x2: 10, y2: 8.0 },
        browRight: { x1: 14, y1: 7.2, x2: 17.5, y2: 6.3 },
        mouth: 'M 8.5 15.8 L 15.5 15.6',
        pupilRadius: 1.35
      },
      sad: {
        browLeft: { x1: 6.5, y1: 8.6, x2: 10, y2: 7.2 },
        browRight: { x1: 14, y1: 7.2, x2: 17.5, y2: 8.6 },
        mouth: 'M 8 16.8 Q 12 13.8 16 16.8',
        pupilRadius: 1.5
      },
      angry: {
        browLeft: { x1: 6.5, y1: 6.5, x2: 10.2, y2: 8.9 },
        browRight: { x1: 13.8, y1: 8.9, x2: 17.5, y2: 6.5 },
        mouth: 'M 8 16.6 Q 12 13.5 16 16.6',
        pupilRadius: 1.25
      },
      supportive: {
        browLeft: { x1: 6.5, y1: 7.2, x2: 10, y2: 6.8 },
        browRight: { x1: 14, y1: 6.8, x2: 17.5, y2: 7.2 },
        mouth: 'M 7.8 14.8 Q 12 18.2 16.2 14.8',
        pupilRadius: 1.6
      }
    };
    return {
      mood: m,
      escalation: stage,
      ...faces[m]
    };
  }

  function rollRandomMood(currentMood) {
    const entries = Object.values(MOODS);
    const totalWeight = entries.reduce((acc, item) => acc + item.weight, 0);
    let pick = Math.random() * totalWeight;
    for (const item of entries) {
      pick -= item.weight;
      if (pick <= 0) {
        if (item.id === currentMood && entries.length > 1) {
          return item.id === 'passive-aggressive' ? 'dramatic' : 'passive-aggressive';
        }
        return item.id;
      }
    }
    return 'passive-aggressive';
  }

  function getLine(moodId, key, wordForCitation) {
    const m = DIALOGUE[moodId] ? moodId : 'passive-aggressive';
    const base = (DIALOGUE[m] && DIALOGUE[m][key]) || DIALOGUE['passive-aggressive'][key] || 'I am judging you.';
    if (m === 'intellectual' && (key === 'typo' || key === 'grammar' || key === 'slow')) {
      return `${base} ${makeFakeCitation(wordForCitation || key)}`;
    }
    return base;
  }

  function getGhostScript(moodId) {
    return GHOST_SCRIPTS[moodId] || GHOST_SCRIPTS['passive-aggressive'];
  }

  function computeEscalationStage(metrics = {}) {
    const errors = Number(metrics.errors) || 0;
    const backspaces = Number(metrics.backspaces) || 0;
    const closeCount = Number(metrics.closeCount) || 0;
    const score = errors * 2 + Math.floor(backspaces / 2) + closeCount * 4;
    let current = ESCALATION_STAGES[0];
    for (const s of ESCALATION_STAGES) {
      if (score >= s.minScore) current = s;
    }
    return current;
  }

  root.YP.Moods = {
    MOODS,
    DIALOGUE,
    GHOST_SCRIPTS,
    ESCALATION_STAGES,
    makeFakeCitation,
    getFaceState,
    rollRandomMood,
    getLine,
    getGhostScript,
    computeEscalationStage
  };
})();
