'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createWord, findByTerm, updateWord } from '@/lib/data';
import SynonymPanel from './SynonymPanel';
import { Notice, SOURCES, Segmented } from './ui';
import type { Word } from '@/lib/types';

export type WordFormData = Omit<Word, 'id' | 'term_key' | 'ease' | 'interval_days' | 'repetitions' | 'lapses' | 'confidence' | 'due_at' | 'last_reviewed_at' | 'created_at' | 'updated_at'>;

export const BLANK_WORD: WordFormData = {
  term: '',
  source: 'reading',
  context: '',
  meaning: '',
  uzbek: '',
  paraphrase: '',
  example: '',
  part_of_speech: '',
  sense_key: '',
  sense: null,
  synonyms: [],
  audio: null,
  lookup_meta: null,
  status: 'active',
};

import type { Source } from '@/lib/types';

const SOURCE_OPTIONS = (Object.entries(SOURCES) as [Source, string][]).map(([value, label]) => ({ value, label }));

type WordWithId = WordFormData & { id?: string };

interface WordFormProps {
  initial?: WordWithId;
  onSaved?: (word: Word) => void;
  onCancel?: () => void;
}

export default function WordForm({ initial = BLANK_WORD, onSaved, onCancel }: WordFormProps) {
  const editing = Boolean(initial.id);
  const [word, setWord] = useState<WordWithId>({ ...BLANK_WORD, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState<Pick<Word, 'id' | 'term' | 'part_of_speech' | 'sense' | 'sense_key' | 'meaning'>[]>([]);

  const set = (patch: Partial<WordWithId>) => setWord((w) => ({ ...w, ...patch }));

  type TextField = 'term' | 'context' | 'meaning' | 'uzbek' | 'paraphrase' | 'example';
  const field = (name: TextField) => ({
    id: `f-${name}`,
    value: (word[name] ?? '') as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set({ [name]: e.target.value }),
  });

  const checkExisting = async () => {
    try {
      setExisting(await findByTerm(word.term, initial.id));
    } catch {
      setExisting([]);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!word.term.trim()) return setError('Enter the word or phrase.');
    if (!word.meaning.trim() && !word.uzbek.trim()) {
      return setError('Add a meaning in English or an Uzbek translation so you can be tested on it.');
    }
    setSaving(true);
    try {
      const payload: Partial<Word> = { ...word, term: word.term.trim().replace(/\s+/g, ' ') };
      const saved = editing ? await updateWord(initial.id!, payload) : await createWord(payload);
      onSaved?.(saved);
      if (!editing) {
        setWord({ ...BLANK_WORD, source: word.source });
        setExisting([]);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack" noValidate>
      <section className="card">
        <div className="field">
          <label className="label" htmlFor="f-term">Word or phrase</label>
          <input
            {...field('term')}
            className="input input-lg"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={120}
            required
            placeholder="e.g. mitigate"
            onBlur={checkExisting}
          />
        </div>
        {existing.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <Notice kind="info">
              You already have &ldquo;{word.term.trim()}&rdquo;:{' '}
              {existing.map((x, i) => (
                <span key={x.id}>
                  {i > 0 && ', '}
                  <Link href={`/words/${x.id}`}>{x.sense?.definition ? `${x.part_of_speech} — ${x.sense.definition.slice(0, 60)}` : x.meaning || 'no sense chosen'}</Link>
                </span>
              ))}
              . Save again only for a different sense.
            </Notice>
          </div>
        )}
        <div className="field">
          <span className="label" id="source-label">Where did you find it?</span>
          <Segmented label="Source" value={word.source} options={SOURCE_OPTIONS} onChange={(source) => set({ source })} />
        </div>
        <div className="field">
          <label className="label" htmlFor="f-context">Sentence or context</label>
          <textarea
            {...field('context')}
            className="textarea"
            maxLength={1000}
            placeholder="The council introduced new measures to mitigate the effects of flooding."
          />
          <span className="hint">One sentence is enough. It is used for gap-fill practice and to pick the right sense.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="f-meaning">Meaning (your own words)</label>
          <input {...field('meaning')} className="input" maxLength={1000} placeholder="to make something less harmful" />
        </div>
        <div className="field">
          <label className="label" htmlFor="f-uzbek">Uzbek translation</label>
          <input {...field('uzbek')} className="input" maxLength={500} placeholder="yumshatmoq, kamaytirmoq" lang="uz" />
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Sense &amp; synonyms</h2>
          <span className="hint">Optional</span>
        </div>
        <SynonymPanel term={word.term} context={word.context} meaning={word.meaning} value={word} onChange={set} />
      </section>

      <section className="card">
        <h2>Make it yours</h2>
        <div className="field">
          <label className="label" htmlFor="f-paraphrase">Paraphrase</label>
          <textarea
            {...field('paraphrase')}
            className="textarea"
            maxLength={1000}
            placeholder="Rewrite your sentence without the word: The council took steps to reduce the damage from floods."
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="f-example">My example sentence</label>
          <textarea {...field('example')} className="textarea" maxLength={1000} placeholder="Wearing a helmet mitigates the risk of serious injury." />
        </div>
      </section>

      {error && <Notice kind="error">{error}</Notice>}

      <div className="row">
        <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
          {saving && <span className="spinner" aria-hidden="true" />}
          {editing ? 'Save changes' : 'Save word'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-lg btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
