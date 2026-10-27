'use client';
import { useState } from 'react';
import { neighbours } from '@/lib/answer';
import { buildCandidates, mergeCandidates, rankSenses, senseKey } from '@/lib/senses';
import AudioButton from './AudioButton';
import CandidateList from './CandidateList';
import { Notice, formatDate } from './ui';
import type { Word, Synonym, LookupResult, Sense, SavedSense, Audio } from '@/lib/types';

const STATUS_TEXT: Record<string, string> = {
  ok: 'OK',
  not_found: 'Not found',
  rate_limited: 'Rate limited',
  error: 'Unavailable',
};

const OWN_SENSE = '__own__';
const INITIAL_SENSES = 6;

type WordPatch = Partial<Pick<Word, 'lookup_meta' | 'synonyms' | 'audio' | 'sense' | 'sense_key' | 'part_of_speech'>>;

interface SynonymPanelProps {
  term: string;
  context: string;
  meaning: string;
  value: Partial<Word>;
  onChange: (patch: WordPatch) => void;
  actionLabel?: string;
}

export default function SynonymPanel({ term, context, meaning, value, onChange, actionLabel = 'Check synonyms' }: SynonymPanelProps) {
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showAllSenses, setShowAllSenses] = useState(false);

  const run = async (fresh = false) => {
    if (!term.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { lc, rc } = neighbours(context, term);
      const params = new URLSearchParams({ term: term.trim() });
      if (lc) params.set('lc', lc);
      if (rc) params.set('rc', rc);
      if (fresh) params.set('fresh', '1');

      const res = await fetch(`/api/lookup?${params}`);
      const body = await res.json().catch(() => ({})) as LookupResult & { error?: string };
      if (!res.ok) throw new Error(body.error || `Lookup failed (HTTP ${res.status}).`);

      setLookup(body);
      setSelected(null);
      onChange({
        lookup_meta: { retrievedAt: body.retrievedAt, providers: body.providers },
        synonyms: mergeCandidates(value.synonyms, buildCandidates(body, null, term)),
        ...(value.audio || !body.audio.length ? {} : { audio: body.audio[0] }),
      });
    } catch (err: unknown) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setError('You are offline. You can save the word now and check synonyms later.');
      } else {
        setError((err as Error).message || 'Lookup failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const ranked = lookup ? rankSenses(lookup.senses, { term, context, meaning }) : [];
  const shownSenses = showAllSenses ? ranked : ranked.slice(0, INITIAL_SENSES);

  const choose = (id: string) => {
    setSelected(id);
    const sense = ranked.find((s) => s.id === id) as Sense | undefined;
    const fresh = buildCandidates(lookup!, sense ?? null, term);
    const savedSense: SavedSense | null = sense
      ? {
          provider: sense.provider,
          providerName: sense.providerName,
          partOfSpeech: sense.partOfSpeech,
          definition: sense.definition,
          example: sense.example,
          sourceUrl: sense.sourceUrl,
          retrievedAt: lookup!.retrievedAt,
        }
      : null;
    onChange({
      sense: savedSense,
      sense_key: sense ? senseKey(sense) : '',
      part_of_speech: sense?.partOfSpeech ?? value.part_of_speech,
      synonyms: mergeCandidates(
        (value.synonyms ?? []).filter((s: Synonym) => s.provider === 'you' || s.verdict !== 'unreviewed' || s.note),
        fresh,
      ),
    });
  };

  const failed = lookup && !lookup.senses.length && !lookup.candidates.length;

  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="btn" onClick={() => run(Boolean(lookup))} disabled={!term.trim() || loading}>
          {loading ? <span className="spinner" aria-hidden="true" /> : null}
          {lookup ? 'Refresh' : actionLabel}
        </button>
        {!lookup && !loading && (
          <span className="hint">Only the word and its two neighbouring words are sent to the dictionaries.</span>
        )}
      </div>

      {error && <Notice kind="error" onRetry={() => run(true)}>{error}</Notice>}

      {lookup && (
        <>
          <div className="provider-row" aria-label="Dictionary sources">
            {lookup.providers.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className={`chip ${p.status === 'ok' ? 'chip-fits' : p.status === 'not_found' ? '' : 'chip-rejected'}`}
                title={p.message || ''}
              >
                {p.name}: {STATUS_TEXT[p.status] ?? p.status}
              </a>
            ))}
            <span className="hint">Retrieved {formatDate(lookup.retrievedAt, { time: true })}</span>
          </div>

          {failed && (
            <Notice kind="warn" onRetry={() => run(true)}>
              {lookup.providers.some((p) => p.status === 'ok' || p.status === 'not_found')
                ? 'No dictionary entry or synonyms found. Check the spelling, or try the base form of a phrase.'
                : 'The dictionaries are unavailable right now.'}
              {' '}You can still save the word with your own meaning.
              {lookup.providers.flatMap((p) => p.suggestions ?? []).length > 0 &&
                ` Did you mean: ${lookup.providers.flatMap((p) => p.suggestions ?? []).join(', ')}?`}
            </Notice>
          )}

          {ranked.length > 0 && (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: '0.5rem' }}>
                Which sense matches your sentence?
              </legend>
              <ul className="sense-list">
                {shownSenses.map((s) => (
                  <li key={s.id}>
                    <label className="sense">
                      <input type="radio" name="sense" checked={selected === s.id} onChange={() => choose(s.id)} />
                      <span>
                        <span className="row" style={{ marginBottom: '0.2rem' }}>
                          {s.partOfSpeech && <span className="chip">{s.partOfSpeech}</span>}
                          {s.suggested && <span className="chip chip-near">Closest to your sentence</span>}
                        </span>
                        <span>{s.definition}</span>
                        {s.example && <span className="hint" style={{ display: 'block' }}>&ldquo;{s.example}&rdquo;</span>}
                        <span className="hint" style={{ display: 'block' }}>
                          {s.providerName}
                          {s.synonyms.length > 0 && ` · ${s.synonyms.length} synonyms for this sense`}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
                <li>
                  <label className="sense">
                    <input type="radio" name="sense" checked={selected === OWN_SENSE} onChange={() => choose(OWN_SENSE)} />
                    <span>None of these — use my own meaning</span>
                  </label>
                </li>
              </ul>
              {ranked.length > INITIAL_SENSES && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowAllSenses((v) => !v)}>
                  {showAllSenses ? 'Show fewer senses' : `Show all ${ranked.length} senses`}
                </button>
              )}
              {!selected && <p className="hint">&ldquo;Closest&rdquo; is only a word-overlap hint. Read the definitions and choose.</p>}
            </fieldset>
          )}

          {lookup.audio.length > 0 && (
            <div>
              <div className="label">Pronunciation</div>
              <ul className="sense-list" style={{ marginTop: '0.4rem' }}>
                {lookup.audio.map((a) => (
                  <li key={a.url} className="row">
                    <label className="row" style={{ cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="audio"
                        checked={value.audio?.url === a.url}
                        onChange={() => onChange({ audio: a })}
                      />
                      {a.text || term} {a.accent && <span className="chip">{a.accent}</span>}
                    </label>
                    <AudioButton audio={a} term={term} label="Play" />
                    <span className="hint">
                      Audio:{' '}
                      <a href={a.sourceUrl || a.license.url} target="_blank" rel="noreferrer">Wikimedia Commons</a>,{' '}
                      <a href={a.license.url} target="_blank" rel="noreferrer">{a.license.name}</a>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {!lookup && value.sense && (
        <p className="small">
          <span className="muted">Selected sense:</span>{' '}
          {value.sense.partOfSpeech && <em>{value.sense.partOfSpeech}. </em>}
          {value.sense.definition}{' '}
          <span className="hint">({value.sense.providerName})</span>
        </p>
      )}

      {(lookup || (value.synonyms?.length ?? 0) > 0) && (
        <div>
          <div className="label" style={{ marginBottom: '0.4rem' }}>
            Synonym candidates{value.sense ? ' for the selected sense' : ''}
          </div>
          <CandidateList term={term} synonyms={value.synonyms ?? []} onChange={(synonyms) => onChange({ synonyms })} />
        </div>
      )}
    </div>
  );
}
