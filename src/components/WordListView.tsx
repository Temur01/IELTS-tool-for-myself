'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAllReviews, listWords } from '@/lib/data';
import { backupJson, download, wordsToCsv } from '@/lib/exportData';
import { formatDelay, isDueToday, wordStatus } from '@/lib/srs';
import { Notice, SOURCES, Segmented, Skeleton, SourceChip } from './ui';
import type { Word } from '@/lib/types';

const SOURCE_FILTERS = [{ value: 'all', label: 'All' }, ...Object.entries(SOURCES).map(([value, label]) => ({ value, label: label.replace(' English', '') }))];
const STATUS_FILTERS: Record<string, string> = {
  active: 'All active',
  due: 'Due today',
  new: 'New',
  learning: 'Learning',
  mastered: 'Mastered',
  archived: 'Archived',
};

export default function WordListView() {
  const [words, setWords] = useState<Word[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [status, setStatus] = useState('active');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setWords(await listWords());
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!words) return [];
    const q = query.trim().toLowerCase();
    const now = new Date();
    return words.filter((w) => {
      if (source !== 'all' && w.source !== source) return false;
      const st = wordStatus(w);
      if (status === 'active' && st === 'archived') return false;
      if (status === 'due' && (st === 'archived' || !isDueToday(w, now))) return false;
      if (!['active', 'due'].includes(status) && st !== status) return false;
      if (!q) return true;
      return [w.term, w.meaning, w.uzbek, w.context, w.paraphrase].some((f) => f?.toLowerCase().includes(q));
    });
  }, [words, query, source, status]);

  const exportAs = async (kind: 'csv' | 'json') => {
    if (!words) return;
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === 'csv') {
        download(`ielts-words-${stamp}.csv`, '﻿' + wordsToCsv(words), 'text/csv;charset=utf-8');
      } else {
        download(`ielts-backup-${stamp}.json`, backupJson(words, await listAllReviews()), 'application/json');
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="hero">
        <span className="eyebrow">Word bank</span>
        <div className="row spread">
          <h1>Words</h1>
          {words && words.length > 0 && (
            <div className="row">
              <button type="button" className="btn btn-sm" onClick={() => exportAs('csv')} disabled={exporting}>Export CSV</button>
              <button type="button" className="btn btn-sm" onClick={() => exportAs('json')} disabled={exporting}>Backup JSON</button>
            </div>
          )}
        </div>
      </div>

      {error && <Notice kind="error" onRetry={load}>{error}</Notice>}
      {!words && !error && <Skeleton lines={4} />}

      {words && words.length === 0 && (
        <div className="card empty">
          <div className="empty-icon" aria-hidden="true">✍️</div>
          <h2>No words yet</h2>
          <p className="muted">Words you add appear here, ready to search, edit and export.</p>
          <Link href="/add" className="btn btn-primary">Add a word</Link>
        </div>
      )}

      {words && words.length > 0 && (
        <>
          <div className="toolbar">
            <input
              type="search"
              className="input"
              placeholder="Search words, meanings, sentences…"
              aria-label="Search words"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="row spread">
              <Segmented label="Source" value={source} options={SOURCE_FILTERS} onChange={setSource} />
              <select className="select" style={{ width: 'auto' }} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(STATUS_FILTERS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <p className="hint" aria-live="polite">{filtered.length} of {words.length} words</p>
          {filtered.length === 0 ? (
            <p className="muted empty">No words match these filters.</p>
          ) : (
            <ul className="word-list">
              {filtered.map((w) => <WordRow key={w.id} word={w} />)}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function WordRow({ word }: { word: Word }) {
  const st = wordStatus(word);
  const due = st !== 'archived' && isDueToday(word, new Date());
  return (
    <li className="word-item">
      <Link href={`/words/${word.id}`}>
        <div className="row spread">
          <span className="row" style={{ minWidth: 0 }}>
            <span className="word-term">{word.term}</span>
            {word.part_of_speech && <span className="muted small">{word.part_of_speech}</span>}
          </span>
          <span className="row">
            <SourceChip source={word.source} />
            {due ? <span className="chip chip-due">Due</span> : st === 'archived' ? <span className="chip">Archived</span> : <span className="chip">in {formatDelay(word.due_at)}</span>}
          </span>
        </div>
        <div className="muted small truncate">{word.meaning || word.sense?.definition || word.uzbek}</div>
      </Link>
    </li>
  );
}
