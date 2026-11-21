(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.YP = root.YP || {};
  root.SN = root.YP;

  // Common valid vocabulary so valid partial prefixes (e.g. "delet", "notep", "qu", "in") never false-fire mid-word
  const BASE_WORDS = [
    'a', 'able', 'about', 'above', 'accept', 'account', 'across', 'act', 'action', 'actually', 'add', 'address',
    'admit', 'adult', 'affect', 'after', 'again', 'against', 'age', 'agency', 'agent', 'ago', 'agree', 'ahead',
    'air', 'all', 'allow', 'almost', 'alone', 'along', 'already', 'also', 'although', 'always', 'am', 'among',
    'amount', 'an', 'analysis', 'and', 'animal', 'another', 'answer', 'any', 'anyone', 'anything', 'appear',
    'apply', 'approach', 'app', 'application', 'are', 'area', 'argue', 'arm', 'around', 'arrive', 'art', 'article',
    'artist', 'as', 'ask', 'assume', 'at', 'attack', 'attention', 'attorney', 'audience', 'author', 'authority',
    'available', 'avoid', 'away', 'awesome', 'back', 'bad', 'bag', 'ball', 'bank', 'bar', 'base', 'be', 'beat',
    'beautiful', 'because', 'become', 'bed', 'before', 'begin', 'behavior', 'behind', 'believe', 'benefit', 'best',
    'better', 'between', 'beyond', 'big', 'bill', 'billion', 'bit', 'black', 'blood', 'blue', 'board', 'body',
    'book', 'born', 'both', 'box', 'boy', 'break', 'bring', 'brother', 'budget', 'build', 'building', 'business',
    'but', 'buy', 'by', 'call', 'camera', 'campaign', 'can', 'cancer', 'candidate', 'capital', 'car', 'card',
    'care', 'career', 'carry', 'case', 'catch', 'cause', 'cell', 'center', 'central', 'century', 'certain',
    'certainly', 'chair', 'challenge', 'chance', 'change', 'character', 'charge', 'check', 'child', 'choice',
    'choose', 'church', 'citizen', 'city', 'civil', 'claim', 'class', 'clean', 'clear', 'clearly', 'close',
    'coach', 'code', 'coding', 'cold', 'collection', 'college', 'color', 'come', 'commercial', 'common',
    'community', 'company', 'compare', 'computer', 'concern', 'condition', 'conference', 'congress', 'consider',
    'consumer', 'contain', 'continue', 'control', 'cost', 'could', 'country', 'couple', 'course', 'court', 'cover',
    'create', 'crime', 'cultural', 'culture', 'cup', 'current', 'customer', 'cut', 'dark', 'data', 'daughter',
    'day', 'dead', 'deal', 'death', 'debate', 'decade', 'decide', 'decision', 'deep', 'defense', 'degree',
    'delete', 'deleted', 'deleting', 'deletion', 'demo', 'democrat', 'democratic', 'describe', 'design', 'despite',
    'detail', 'determine', 'develop', 'development', 'die', 'difference', 'different', 'difficult', 'dinner',
    'direction', 'director', 'discover', 'discuss', 'discussion', 'disease', 'do', 'doctor', 'document', 'does',
    'dog', 'door', 'down', 'draw', 'dream', 'drive', 'drop', 'drug', 'during', 'each', 'early', 'east', 'easy',
    'eat', 'economic', 'economy', 'edge', 'editor', 'education', 'effect', 'effort', 'eight', 'either', 'election',
    'else', 'employee', 'end', 'energy', 'enjoy', 'enough', 'enter', 'entire', 'environment', 'environmental',
    'especially', 'establish', 'even', 'evening', 'event', 'ever', 'every', 'everybody', 'everyone', 'everything',
    'evidence', 'exactly', 'example', 'executive', 'exist', 'expect', 'experience', 'expert', 'explain', 'eye',
    'face', 'fact', 'factor', 'fail', 'fall', 'family', 'far', 'fast', 'father', 'fear', 'federal', 'feel',
    'feeling', 'few', 'field', 'fight', 'figure', 'file', 'fill', 'film', 'final', 'finally', 'financial', 'find',
    'fine', 'finger', 'finish', 'fire', 'firm', 'first', 'fish', 'five', 'fix', 'floor', 'fly', 'focus', 'follow',
    'food', 'foot', 'for', 'force', 'foreign', 'forget', 'form', 'former', 'forward', 'four', 'free', 'friend',
    'from', 'front', 'full', 'fund', 'future', 'game', 'garden', 'gas', 'general', 'generation', 'get', 'girl',
    'give', 'glass', 'go', 'goal', 'going', 'good', 'government', 'grammar', 'great', 'green', 'ground', 'group',
    'grow', 'growth', 'guess', 'gun', 'guy', 'hackathon', 'hair', 'half', 'hand', 'hang', 'happen', 'happy',
    'hard', 'have', 'he', 'head', 'health', 'hear', 'heart', 'heat', 'heavy', 'hello', 'help', 'her', 'here',
    'herself', 'high', 'him', 'himself', 'his', 'history', 'hit', 'hold', 'home', 'hope', 'hospital', 'hot',
    'hotel', 'hour', 'house', 'how', 'however', 'huge', 'human', 'hundred', 'husband', 'i', 'idea', 'identify',
    'if', 'image', 'imagine', 'impact', 'important', 'improve', 'in', 'include', 'including', 'increase', 'indeed',
    'indicate', 'individual', 'industry', 'information', 'inside', 'instead', 'institution', 'interest',
    'interesting', 'international', 'interview', 'into', 'investment', 'involve', 'is', 'issue', 'it', 'item',
    'its', 'itself', 'job', 'join', 'judge', 'judging', 'just', 'keep', 'key', 'keyboard', 'kid', 'kill', 'kind',
    'kitchen', 'know', 'knowledge', 'land', 'language', 'large', 'last', 'late', 'later', 'laugh', 'law', 'lawyer',
    'lay', 'lead', 'leader', 'learn', 'least', 'leave', 'left', 'leg', 'legal', 'less', 'let', 'letter', 'level',
    'lie', 'life', 'light', 'like', 'likely', 'line', 'list', 'listen', 'little', 'live', 'local', 'long', 'look',
    'lose', 'loss', 'lot', 'love', 'low', 'machine', 'magazine', 'main', 'maintain', 'major', 'majority', 'make',
    'man', 'manage', 'management', 'manager', 'many', 'market', 'marriage', 'material', 'matter', 'may', 'maybe',
    'me', 'mean', 'measure', 'media', 'medical', 'meet', 'meeting', 'member', 'memory', 'mention', 'message',
    'method', 'middle', 'might', 'military', 'million', 'mind', 'minute', 'miss', 'mission', 'mistake', 'model',
    'modern', 'moment', 'money', 'month', 'mood', 'more', 'morning', 'most', 'mother', 'mouth', 'move', 'movement',
    'movie', 'mr', 'mrs', 'much', 'music', 'must', 'my', 'myself', 'name', 'nation', 'national', 'natural',
    'nature', 'near', 'nearly', 'necessary', 'need', 'network', 'never', 'new', 'news', 'newspaper', 'next',
    'nice', 'night', 'no', 'none', 'nor', 'north', 'not', 'note', 'notepad', 'notes', 'nothing', 'notice', 'now',
    'number', 'occur', 'of', 'off', 'offer', 'office', 'officer', 'official', 'often', 'oh', 'oil', 'ok', 'old',
    'on', 'once', 'one', 'only', 'onto', 'open', 'operation', 'opportunity', 'option', 'or', 'order',
    'organization', 'other', 'others', 'our', 'out', 'outside', 'over', 'own', 'owner', 'page', 'pain', 'painting',
    'paper', 'paragraph', 'parent', 'part', 'participant', 'particular', 'particularly', 'partner', 'party',
    'pass', 'past', 'patient', 'pattern', 'pay', 'peace', 'people', 'per', 'perform', 'performance', 'perhaps',
    'period', 'person', 'personal', 'phone', 'physical', 'pick', 'picture', 'piece', 'place', 'plan', 'plant',
    'play', 'player', 'pm', 'point', 'police', 'policy', 'political', 'politics', 'poor', 'popular', 'population',
    'position', 'positive', 'possible', 'power', 'practice', 'prepare', 'present', 'president', 'pressure',
    'pretty', 'prevent', 'price', 'private', 'probably', 'problem', 'process', 'produce', 'product', 'production',
    'professional', 'professor', 'program', 'project', 'property', 'protect', 'prove', 'provide', 'public', 'pull',
    'purpose', 'push', 'put', 'quality', 'question', 'quick', 'quickly', 'quiet', 'quite', 'quote', 'race',
    'radio', 'raise', 'range', 'rate', 'rather', 'reach', 'read', 'ready', 'real', 'reality', 'realize', 'really',
    'reason', 'receive', 'recent', 'recently', 'recognize', 'record', 'red', 'reduce', 'reflect', 'region',
    'relate', 'relationship', 'religious', 'remain', 'remember', 'remove', 'report', 'represent', 'republican',
    'require', 'research', 'resource', 'respond', 'response', 'responsibility', 'rest', 'result', 'return',
    'reveal', 'rich', 'right', 'rise', 'risk', 'road', 'roast', 'rock', 'role', 'room', 'rule', 'run', 'safe',
    'same', 'save', 'saving', 'say', 'scene', 'school', 'science', 'scientist', 'score', 'sea', 'season', 'seat',
    'second', 'section', 'security', 'see', 'seek', 'seem', 'select', 'sell', 'send', 'senior', 'sense',
    'sentence', 'separate', 'series', 'serious', 'serve', 'service', 'set', 'seven', 'several', 'shake', 'share',
    'she', 'shoot', 'short', 'shot', 'should', 'shoulder', 'show', 'side', 'sign', 'significant', 'similar',
    'simple', 'simply', 'since', 'sing', 'single', 'sister', 'sit', 'site', 'situation', 'six', 'size', 'skill',
    'skin', 'slow', 'small', 'smile', 'so', 'social', 'society', 'soldier', 'some', 'somebody', 'someone',
    'something', 'sometimes', 'son', 'song', 'soon', 'sort', 'sound', 'source', 'south', 'southern', 'space',
    'speak', 'special', 'specific', 'speech', 'speed', 'spend', 'sport', 'spring', 'staff', 'stage', 'stand',
    'standard', 'star', 'start', 'state', 'statement', 'station', 'stay', 'step', 'still', 'stock', 'stop',
    'store', 'story', 'strategy', 'street', 'strong', 'structure', 'student', 'study', 'stuff', 'style', 'subject',
    'success', 'successful', 'such', 'suddenly', 'suffer', 'suggest', 'summer', 'support', 'sure', 'surface',
    'system', 'table', 'take', 'talk', 'task', 'tax', 'teach', 'teacher', 'team', 'technology', 'television',
    'tell', 'ten', 'tend', 'term', 'test', 'testing', 'text', 'than', 'thank', 'that', 'the', 'their', 'them',
    'themselves', 'then', 'theory', 'there', 'these', 'they', 'thing', 'think', 'third', 'this', 'those', 'though',
    'thought', 'thousand', 'threat', 'three', 'through', 'throughout', 'throw', 'thus', 'time', 'to', 'today',
    'together', 'tonight', 'too', 'top', 'total', 'tough', 'toward', 'town', 'trade', 'traditional', 'training',
    'travel', 'treat', 'treatment', 'tree', 'trial', 'trip', 'trouble', 'true', 'truth', 'try', 'turn', 'tv',
    'two', 'type', 'typing', 'under', 'understand', 'unit', 'until', 'up', 'upon', 'us', 'use', 'usually', 'value',
    'various', 'very', 'victim', 'view', 'violence', 'visit', 'voice', 'vote', 'wait', 'waiting', 'walk', 'wall',
    'want', 'war', 'watch', 'water', 'way', 'we', 'weapon', 'wear', 'week', 'weight', 'welcome', 'well', 'west', 'western',
    'what', 'whatever', 'when', 'where', 'whether', 'which', 'while', 'white', 'who', 'whole', 'whom', 'whose',
    'why', 'wide', 'wife', 'will', 'win', 'wind', 'window', 'wish', 'with', 'within', 'without', 'woman', 'wonder',
    'word', 'words', 'work', 'worker', 'working', 'world', 'worry', 'would', 'write', 'writer', 'writing', 'wrong',
    'xp', 'yappad', 'yard', 'yeah', 'year', 'yes', 'yet', 'you', 'young', 'your', 'yourself',
    "aren't", "can't", "couldn't", "didn't", "doesn't", "don't", "hadn't", "hasn't", "haven't", "he's",
    "here's", "i'd", "i'll", "i'm", "i've", "isn't", "it's", "let's", "she's", "shouldn't", "that's",
    "there's", "they're", "they've", "wasn't", "we're", "we've", "weren't", "what's", "who's", "won't",
    "wouldn't", "you'd", "you'll", "you're", "you've"
  ];

  const LEXICON = new Set(BASE_WORDS);
  const LEXICON_PREFIXES = new Set();

  for (const w of BASE_WORDS) {
    for (let i = 1; i <= w.length; i++) {
      LEXICON_PREFIXES.add(w.slice(0, i));
    }
  }

  // Known typos map (fires immediately at 0ms even mid-typing)
  const KNOWN_TYPOS = {
    teh: 'the',
    notpad: 'notepad',
    definately: 'definitely',
    definatly: 'definitely',
    recieve: 'receive',
    seperate: 'separate',
    occured: 'occurred',
    untill: 'until',
    wierd: 'weird',
    alot: 'a lot',
    becuase: 'because',
    beacuse: 'because',
    thier: 'their',
    freind: 'friend',
    goverment: 'government',
    enviroment: 'environment',
    adress: 'address',
    tommorow: 'tomorrow',
    accomodate: 'accommodate',
    embarass: 'embarrass',
    neccessary: 'necessary',
    wierdly: 'weirdly',
    writting: 'writing',
    typping: 'typing',
    judgemental: 'judgmental',
    grammer: 'grammar',
    speling: 'spelling',
    sentance: 'sentence',
    paragarph: 'paragraph'
  };

  function isPrefixOfLexicon(token) {
    if (!token) return true;
    const lower = String(token).toLowerCase();
    return LEXICON_PREFIXES.has(lower);
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function addIssue(issues, seenSpans, issue) {
    const key = `${issue.start}:${issue.end}:${issue.rule}`;
    if (seenSpans.has(key)) return;
    seenSpans.add(key);
    issues.push({
      ...issue,
      fingerprint: `${issue.rule}@${issue.start}:${issue.token}`
    });
  }

  function analyze(text, options = {}) {
    const src = String(text || '');
    if (!src) return [];

    const cursorPos = typeof options.cursorPos === 'number' ? options.cursorPos : src.length;
    const issues = [];
    const seenSpans = new Set();

    // 1. Grammar Crime: "could of" / "should of" / "would of" (must NOT contain literal $1)
    const modalOfRegex = /\b(could|should|would|must|might)\s+of\b/gi;
    let m;
    while ((m = modalOfRegex.exec(src)) !== null) {
      const modalWord = m[1];
      const suggestion = `${modalWord} have`;
      addIssue(issues, seenSpans, {
        type: 'grammar',
        rule: 'modal-of',
        token: m[0],
        start: m.index,
        end: m.index + m[0].length,
        suggestion,
        message: `"${m[0]}"? Did you mean "${suggestion}"? Even primary schoolers know it's not "of".`
      });
    }

    // 2. Grammar Crime: Repeated adjacent words ("the the", "is is")
    const repeatedWordRegex = /\b([a-zA-Z]{2,})\s+\1\b/gi;
    while ((m = repeatedWordRegex.exec(src)) !== null) {
      addIssue(issues, seenSpans, {
        type: 'grammar',
        rule: 'repeated-word',
        token: m[0],
        start: m.index,
        end: m.index + m[0].length,
        suggestion: m[1],
        message: `You typed "${m[0]}" twice in a row. Is there an echo in your keyboard?`
      });
    }

    // 3. Grammar Crime: Uncapitalized sentence start after . ! ? ("Hello. w")
    const uncapAfterPunctRegex = /([.!?]\s+)([a-z])/g;
    while ((m = uncapAfterPunctRegex.exec(src)) !== null) {
      const letterStart = m.index + m[1].length;
      const letter = m[2];
      addIssue(issues, seenSpans, {
        type: 'grammar',
        rule: 'uncapitalized-start',
        token: letter,
        start: letterStart,
        end: letterStart + 1,
        suggestion: letter.toUpperCase(),
        message: `Starting a new sentence with lowercase "${letter}"? Did your Shift key resign?`
      });
    }

    // 4. Grammar Crime: Standalone lowercase "i" (completed word followed by space or punctuation)
    const lowerIRegex = /(?:^|\s)(i)(?=\s|[.,!?;:])/g;
    while ((m = lowerIRegex.exec(src)) !== null) {
      const iStart = m.index + (m[0].length - 1);
      addIssue(issues, seenSpans, {
        type: 'grammar',
        rule: 'lowercase-i',
        token: 'i',
        start: iStart,
        end: iStart + 1,
        suggestion: 'I',
        message: `Lowercase "i"? Having so little self-respect you won't even capitalize yourself is sad.`
      });
    }

    // 5. Double spaces
    const doubleSpaceRegex = /[^\S\r\n]{2,}/g;
    while ((m = doubleSpaceRegex.exec(src)) !== null) {
      addIssue(issues, seenSpans, {
        type: 'style',
        rule: 'double-space',
        token: m[0],
        start: m.index,
        end: m.index + m[0].length,
        suggestion: ' ',
        message: 'Multiple consecutive spaces. This isn\'t a 1970s typewriter.'
      });
    }

    // 6. Simple comma splice (", it is", ", they are", ", we were", ", I am")
    const commaSpliceRegex = /,\s+(it|they|we|he|she|you|i)\s+(is|are|was|were|am|will|have|had)\b/gi;
    while ((m = commaSpliceRegex.exec(src)) !== null) {
      addIssue(issues, seenSpans, {
        type: 'grammar',
        rule: 'comma-splice',
        token: m[0],
        start: m.index,
        end: m.index + m[0].length,
        suggestion: `; ${m[1]} ${m[2]}`,
        message: `Comma splice ("${m[0]}"). Two independent clauses duct-taped together. Disappointing.`
      });
    }

    // 6b. Grammar Crime: "your welcome" -> "you're welcome"
    const yourWelcomeRegex = /\byour\s+welcome\b/gi;
    while ((m = yourWelcomeRegex.exec(src)) !== null) {
      addIssue(issues, seenSpans, {
        type: 'grammar',
        rule: 'your-welcome',
        token: m[0],
        start: m.index,
        end: m.index + m[0].length,
        suggestion: "you're welcome",
        message: `"${m[0]}"? Unless someone owns a welcome, you meant "you're welcome".`
      });
    }

    // 7. Token-level instant & completed-word checks
    const wordRegex = /[a-zA-Z']+/g;
    while ((m = wordRegex.exec(src)) !== null) {
      const rawToken = m[0];
      const lower = rawToken.toLowerCase();
      const start = m.index;
      const end = start + rawToken.length;
      const isAtCursor = end === cursorPos;

      // 7a. Known typo dictionary (fires at 0ms even mid-typing)
      if (Object.prototype.hasOwnProperty.call(KNOWN_TYPOS, lower)) {
        const fix = KNOWN_TYPOS[lower];
        addIssue(issues, seenSpans, {
          type: 'spelling',
          rule: 'known-typo',
          token: rawToken,
          start,
          end,
          suggestion: fix,
          message: `"${rawToken}" is not a word. I checked. Twice. (Try "${fix}"—though I refuse to fix it for you.)`
        });
        continue;
      }

      // 7b. 3+ repeated identical letters ("sooo", "helllo") — fires at 0ms
      if (/([a-zA-Z])\1\1/.test(rawToken)) {
        addIssue(issues, seenSpans, {
          type: 'spelling',
          rule: 'repeated-letters',
          token: rawToken,
          start,
          end,
          suggestion: rawToken.replace(/([a-zA-Z])\1+/g, '$1$1'),
          message: `"${rawToken}"? Three of the same letter in a row. Did you fall asleep on that key?`
        });
        continue;
      }

      // 7c. 'q' followed immediately by non-'u' ("qir", "qzx") — fires at 0ms
      if (/q(?!u)[a-z]/i.test(rawToken)) {
        addIssue(issues, seenSpans, {
          type: 'spelling',
          rule: 'q-without-u',
          token: rawToken,
          start,
          end,
          suggestion: rawToken,
          message: `"${rawToken}" violates English orthography: 'Q' without 'U'. Bold. Wrong, but bold.`
        });
        continue;
      }

      // 7d. Zero-vowel 4+ letter mash ("bcdf", "xkcd") — fires at 0ms
      if (rawToken.length >= 4 && !/[aeiouyAEIOUY]/.test(rawToken)) {
        addIssue(issues, seenSpans, {
          type: 'spelling',
          rule: 'no-vowels',
          token: rawToken,
          start,
          end,
          suggestion: rawToken,
          message: `"${rawToken}" has zero vowels. Keyboard smash detected.`
        });
        continue;
      }

      // 7e. General lexicon check:
      // If the word is currently being typed at the cursor, keep quiet if it is a valid prefix of any lexicon word!
      if (rawToken.length >= 3) {
        const cleanLower = lower.replace(/^'+|'+$/g, '');
        const strippedStem = cleanLower.replace(/(ing|ed|ly|es|s|er|est|ment|ness|tion)$/i, '');
        const inLexicon =
          LEXICON.has(cleanLower) ||
          (strippedStem.length >= 2 && LEXICON.has(strippedStem));

        if (!inLexicon) {
          if (isAtCursor && isPrefixOfLexicon(cleanLower)) {
            // Valid partial prefix mid-word ("delet", "notep", "qu", "in") — stay silent!
            continue;
          }
          if (!isPrefixOfLexicon(cleanLower) || !isAtCursor) {
            addIssue(issues, seenSpans, {
              type: 'spelling',
              rule: 'unrecognized-word',
              token: rawToken,
              start,
              end,
              suggestion: null,
              message: `"${rawToken}"? That's not in my dictionary. I won't autocorrect it—you need to learn.`
            });
          }
        }
      }
    }

    issues.sort((a, b) => a.start - b.start || a.end - b.end);
    return issues;
  }

  function renderBackdropHTML(text, issues) {
    const src = String(text || '');
    if (!src) return '';
    const list = Array.isArray(issues) ? [...issues].sort((a, b) => a.start - b.start) : [];
    if (list.length === 0) {
      return escapeHTML(src) + (src.endsWith('\n') ? ' ' : '');
    }

    let html = '';
    let cursor = 0;

    for (const item of list) {
      const start = Math.max(cursor, Math.min(src.length, Number(item.start) || 0));
      const end = Math.max(start, Math.min(src.length, Number(item.end) || start));
      if (end <= start) continue;

      if (start > cursor) {
        html += escapeHTML(src.slice(cursor, start));
      }
      const cls =
        item.type === 'grammar'
          ? 'issue-grammar'
          : item.type === 'style'
          ? 'issue-style'
          : 'issue-spelling';
      html += `<mark class="backdrop-mark ${cls}">${escapeHTML(src.slice(start, end))}</mark>`;
      cursor = end;
    }

    if (cursor < src.length) {
      html += escapeHTML(src.slice(cursor));
    }

    if (src.endsWith('\n')) {
      html += ' ';
    }
    return html;
  }

  root.YP.Grammar = {
    LEXICON,
    LEXICON_PREFIXES,
    KNOWN_TYPOS,
    isPrefixOfLexicon,
    escapeHTML,
    analyze,
    renderBackdropHTML
  };
})();
