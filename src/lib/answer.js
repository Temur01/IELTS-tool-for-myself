// Forgiving answer checking and cloze helpers.

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeAnswer(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[-‐-―_/]/g, ' ')
    .replace(/[^\p{L}\p{N}\s']/gu, '')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// "to mitigate" and "mitigate" should both count; so should "a/the" before nouns.
function stripLeadingParticles(text) {
  return text.replace(/^(to|a|an|the)\s+/, '');
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Compare a typed answer against one or more accepted answers.
 * @returns {{correct: boolean, typo: boolean, matched: string|null}}
 *   typo = accepted, but only after allowing a small spelling slip.
 */
export function checkAnswer(input, accepted) {
  const given = stripLeadingParticles(normalizeAnswer(input));
  const list = (Array.isArray(accepted) ? accepted : [accepted]).filter(Boolean);
  if (!given) return { correct: false, typo: false, matched: null };

  for (const target of list) {
    if (stripLeadingParticles(normalizeAnswer(target)) === given) {
      return { correct: true, typo: false, matched: target };
    }
  }
  for (const target of list) {
    const t = stripLeadingParticles(normalizeAnswer(target));
    const allowed = t.length >= 9 ? 2 : t.length >= 5 ? 1 : 0;
    if (allowed && levenshtein(t, given) <= allowed) {
      return { correct: true, typo: true, matched: target };
    }
  }
  return { correct: false, typo: false, matched: null };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the target term (or an inflected form of it) inside the context.
 * Handles "mitigate" -> "mitigated", "study" -> "studies", and phrases
 * ("carry out" -> "carried out" is matched on the last words only when the
 * first word inflects, so only simple suffixes are supported).
 * @returns {{before: string, answer: string, after: string} | null}
 */
export function findCloze(context, term) {
  const text = String(context ?? '');
  const t = String(term ?? '').trim();
  if (!text || !t) return null;

  const words = t.split(/\s+/).map(escapeRegExp);
  const stemOf = (w) => w.replace(/(e|y)$/i, '');
  const patterns = [words.join('\\s+')];
  // Allow a suffix on the first word of a phrase, or on a single word.
  // Very short stems ("be", "go") would match unrelated words, so skip them.
  if (stemOf(words[0]).length >= 3) {
    patterns.push([stemOf(words[0]) + "[\\p{L}']{0,4}", ...words.slice(1)].join('\\s+'));
  }
  for (const p of patterns) {
    const re = new RegExp(`(^|[^\\p{L}])(${p})(?=[^\\p{L}]|$)`, 'iu');
    const m = re.exec(text);
    if (m) {
      const start = m.index + m[1].length;
      const answer = m[2];
      return { before: text.slice(0, start), answer, after: text.slice(start + answer.length) };
    }
  }
  return null;
}

/** Words immediately left and right of the term, for context-aware lookups. */
export function neighbours(context, term) {
  const c = findCloze(context, term);
  if (!c) return { lc: '', rc: '' };
  const left = c.before.match(/([\p{L}']+)[^\p{L}']*$/u);
  const right = c.after.match(/^[^\p{L}']*([\p{L}']+)/u);
  return { lc: left ? left[1].toLowerCase() : '', rc: right ? right[1].toLowerCase() : '' };
}

/** True if the text contains the term or an inflected form of its first word. */
export function usesTerm(text, term) {
  const stem = normalizeAnswer(term).split(' ')[0].replace(/(e|y)$/, '');
  if (stem.length < 3) return normalizeAnswer(text).split(' ').includes(normalizeAnswer(term));
  return normalizeAnswer(text).split(' ').some((w) => w.startsWith(stem));
}
