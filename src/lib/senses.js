// Sense selection and synonym-candidate handling.
//
// A dictionary returns many senses for a spelling. The learner chooses the
// one that matches their sentence; synonym suggestions are then tied to that
// sense. Candidates are never treated as interchangeable with the target:
// only the learner's "fits" verdict marks a verified replacement.

export const LABELS = {
  near: 'Near synonym',
  related: 'Related candidate',
};

export const VERDICTS = {
  unreviewed: 'Not checked',
  fits: 'Fits my sentence',
  rejected: "Doesn't fit",
};

const STOPWORDS = new Set(
  ('a an the and or but if of to in on at by for with from as is are was were be been being ' +
    'it its this that these those there their they them he she his her we our you your i me my ' +
    'not no so than then too very can could will would should may might must do does did done ' +
    'have has had having into over under about after before more most less such which who whom ' +
    'what when where why how all any each other some something someone one also just only')
    .split(' '),
);

function stem(word) {
  return word
    .replace(/(ies)$/, 'y')
    .replace(/(ing|ed|es|s|ly)$/, '')
    .replace(/e$/, '');
}

export function contentWords(text) {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .split(/[^\p{L}']+/u)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map(stem),
  );
}

/** Stable key for a sense so the same term can be saved once per sense. */
export function senseKey(sense) {
  if (!sense || !sense.definition) return '';
  const pos = String(sense.partOfSpeech ?? '').toLowerCase().trim();
  const def = String(sense.definition)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${pos}|${def}`;
}

/**
 * Score senses by word overlap with the learner's context and meaning.
 * This is only a hint for ordering; the learner must still choose.
 */
export function rankSenses(senses, { term = '', context = '', meaning = '' } = {}) {
  const termWords = contentWords(term);
  const clue = contentWords(`${context} ${meaning}`);
  for (const w of termWords) clue.delete(w);

  const scored = senses.map((sense, index) => {
    const words = contentWords(`${sense.definition} ${sense.example ?? ''} ${(sense.synonyms ?? []).join(' ')}`);
    let score = 0;
    for (const w of words) if (clue.has(w)) score += 1;
    return { ...sense, score, index };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const best = scored[0]?.score ?? 0;
  return scored.map((s) => ({ ...s, suggested: best > 0 && s.score === best }));
}

/**
 * Build the candidate list for a selected sense.
 * - Synonyms the provider lists under the selected sense -> "near".
 * - Everything else (other senses, WordNet synsets, "means like") -> "related".
 * Duplicates are merged, keeping the strongest label and every source.
 */
export function buildCandidates(lookup, selectedSense, term = '') {
  const self = String(term).toLowerCase().trim();
  const byWord = new Map();

  const add = (word, entry) => {
    const key = String(word).toLowerCase().trim();
    if (!key || key === self) return;
    const existing = byWord.get(key);
    if (!existing) {
      byWord.set(key, { word: String(word).trim(), ...entry, sources: [sourceOf(entry)] });
      return;
    }
    if (entry.label === 'near' && existing.label !== 'near') {
      Object.assign(existing, { ...entry, word: existing.word, sources: existing.sources });
    }
    if (!existing.sources.some((s) => s.provider === entry.provider)) {
      existing.sources.push(sourceOf(entry));
    }
  };

  if (selectedSense) {
    for (const word of selectedSense.synonyms ?? []) {
      add(word, {
        label: 'near',
        basis: `Listed for this sense by ${selectedSense.providerName}`,
        provider: selectedSense.provider,
        providerName: selectedSense.providerName,
        sourceUrl: selectedSense.sourceUrl,
        retrievedAt: lookup.retrievedAt,
      });
    }
    for (const word of selectedSense.relatedSynonyms ?? []) {
      add(word, {
        label: 'related',
        basis: `Listed for this part of speech by ${selectedSense.providerName}; sense not specified`,
        provider: selectedSense.provider,
        providerName: selectedSense.providerName,
        sourceUrl: selectedSense.sourceUrl,
        retrievedAt: lookup.retrievedAt,
      });
    }
  }

  const pos = selectedSense?.partOfSpeech?.toLowerCase();
  for (const c of lookup.candidates ?? []) {
    // Drop candidates whose known parts of speech exclude the chosen one.
    if (pos && c.partsOfSpeech?.length && !c.partsOfSpeech.includes(pos)) continue;
    add(c.word, {
      label: 'related',
      basis: c.basis,
      provider: c.provider,
      providerName: c.providerName,
      sourceUrl: c.sourceUrl,
      retrievedAt: lookup.retrievedAt,
    });
  }

  return [...byWord.values()].map((c) => ({ ...c, verdict: 'unreviewed', note: '' }));
}

function sourceOf(entry) {
  return { provider: entry.provider, providerName: entry.providerName, sourceUrl: entry.sourceUrl };
}

/** Keep the learner's verdicts and notes when candidates are refreshed. */
export function mergeCandidates(saved = [], fresh = []) {
  const old = new Map(saved.map((c) => [c.word.toLowerCase(), c]));
  const merged = fresh.map((c) => {
    const prev = old.get(c.word.toLowerCase());
    old.delete(c.word.toLowerCase());
    return prev ? { ...c, verdict: prev.verdict, note: prev.note } : c;
  });
  // Candidates the learner already judged stay, even if the provider dropped them.
  for (const prev of old.values()) {
    if (prev.verdict !== 'unreviewed' || prev.note) merged.push(prev);
  }
  return merged;
}

export function verifiedReplacements(synonyms = []) {
  return synonyms.filter((s) => s.verdict === 'fits');
}

export function rejectedCandidates(synonyms = []) {
  return synonyms.filter((s) => s.verdict === 'rejected');
}
