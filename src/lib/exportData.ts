// CSV / JSON backup helpers.

import type { Word, Review } from './types';

type CsvGetter = (w: Word) => unknown;

const CSV_COLUMNS: [string, CsvGetter][] = [
  ['term', (w) => w.term],
  ['source', (w) => w.source],
  ['part_of_speech', (w) => w.part_of_speech],
  ['meaning', (w) => w.meaning],
  ['uzbek', (w) => w.uzbek],
  ['paraphrase', (w) => w.paraphrase],
  ['example', (w) => w.example],
  ['context', (w) => w.context],
  ['sense_definition', (w) => w.sense?.definition ?? ''],
  ['sense_source', (w) => w.sense?.providerName ?? ''],
  ['verified_synonyms', (w) => (w.synonyms ?? []).filter((s) => s.verdict === 'fits').map((s) => s.word).join('; ')],
  ['rejected_synonyms', (w) => (w.synonyms ?? []).filter((s) => s.verdict === 'rejected').map((s) => s.word).join('; ')],
  ['status', (w) => w.status],
  ['interval_days', (w) => w.interval_days],
  ['ease', (w) => w.ease],
  ['repetitions', (w) => w.repetitions],
  ['lapses', (w) => w.lapses],
  ['due_at', (w) => w.due_at],
  ['created_at', (w) => w.created_at],
];

export function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function wordsToCsv(words: Word[]): string {
  const header = CSV_COLUMNS.map(([name]) => name).join(',');
  const rows = words.map((w) => CSV_COLUMNS.map(([, get]) => csvCell(get(w))).join(','));
  return [header, ...rows].join('\r\n');
}

export function backupJson(words: Word[], reviews: Review[]): string {
  return JSON.stringify({ app: 'ielts-vocab', version: 1, exportedAt: new Date().toISOString(), words, reviews }, null, 2);
}

export function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
