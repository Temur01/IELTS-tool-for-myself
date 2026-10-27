'use client';
import { useState } from 'react';
import { LABELS, VERDICTS } from '@/lib/senses';
import { formatDate } from './ui';
import type { Synonym, Verdict } from '@/lib/types';

const VERDICT_ORDER: Record<Verdict, number> = { fits: 0, unreviewed: 1, rejected: 2 };
const INITIAL_VISIBLE = 10;

interface CandidateListProps {
  term: string;
  synonyms: Synonym[];
  onChange: (synonyms: Synonym[]) => void;
}

export default function CandidateList({ term, synonyms, onChange }: CandidateListProps) {
  const [showAll, setShowAll] = useState(false);
  const [custom, setCustom] = useState('');

  const update = (word: string, patch: Partial<Synonym>) =>
    onChange(synonyms.map((s) => (s.word === word ? { ...s, ...patch } : s)));

  const addCustom = () => {
    const word = custom.trim();
    if (!word || synonyms.some((s) => s.word.toLowerCase() === word.toLowerCase())) return;
    onChange([
      ...synonyms,
      {
        word,
        label: 'related',
        basis: 'Added by you',
        provider: 'you',
        providerName: 'You',
        sourceUrl: '',
        retrievedAt: new Date().toISOString(),
        verdict: 'unreviewed',
        note: '',
        sources: [],
      },
    ]);
    setCustom('');
  };

  const sorted = [...synonyms].sort(
    (a, b) =>
      VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] || Number(b.label === 'near') - Number(a.label === 'near'),
  );
  const visible = showAll ? sorted : sorted.slice(0, INITIAL_VISIBLE);

  return (
    <div className="stack">
      <p className="hint">
        These are <strong>candidates</strong>, not guaranteed replacements. Synonyms can differ from
        &ldquo;{term}&rdquo; in tone, formality, grammar or collocation. Mark each one against your own sentence, and
        note the difference.
      </p>
      {synonyms.length === 0 && <p className="muted small">No candidates yet.</p>}
      <ul className="cand-list">
        {visible.map((c) => (
          <li key={c.word} className="cand">
            <div className="row spread">
              <span className="row">
                <span className="cand-word">{c.word}</span>
                <span className={`chip chip-${c.label}`}>{LABELS[c.label] ?? c.label}</span>
                {c.verdict !== 'unreviewed' && <span className={`chip chip-${c.verdict}`}>{VERDICTS[c.verdict]}</span>}
              </span>
              <div className="segmented" role="radiogroup" aria-label={`Does "${c.word}" fit your sentence?`}>
                {(['fits', 'rejected', 'unreviewed'] as Verdict[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={c.verdict === v}
                    onClick={() => update(c.word, { verdict: v })}
                  >
                    {v === 'fits' ? 'Fits' : v === 'rejected' ? "Doesn't" : '?'}
                  </button>
                ))}
              </div>
            </div>
            <p className="hint" style={{ margin: '0.35rem 0 0' }}>
              {c.basis}
              {(c.sources?.length ? c.sources : [c]).filter((s) => s.sourceUrl).map((s) => (
                <span key={s.provider}>
                  {' · '}
                  <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                    {s.providerName}
                  </a>
                </span>
              ))}
              {c.retrievedAt && ` · retrieved ${formatDate(c.retrievedAt)}`}
            </p>
            {(c.verdict !== 'unreviewed' || c.note) && (
              <input
                className="input"
                style={{ marginTop: '0.5rem', minHeight: 38, padding: '0.4rem 0.7rem' }}
                value={c.note}
                maxLength={200}
                placeholder={c.verdict === 'fits' ? 'Any nuance? e.g. more formal' : 'Why not? e.g. different collocation'}
                aria-label={`Note about ${c.word}`}
                onChange={(e) => update(c.word, { note: e.target.value })}
              />
            )}
          </li>
        ))}
      </ul>
      {sorted.length > INITIAL_VISIBLE && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show ${sorted.length - INITIAL_VISIBLE} more`}
        </button>
      )}
      <div className="row">
        <input
          className="input"
          style={{ flex: 1, minWidth: 0 }}
          value={custom}
          maxLength={60}
          placeholder="Add your own synonym"
          aria-label="Add your own synonym"
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button className="btn" type="button" onClick={addCustom} disabled={!custom.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}
