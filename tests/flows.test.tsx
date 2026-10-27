import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewCard from '@/components/ReviewCard';
import type { Word, Rating } from '@/lib/types';

vi.mock('@/lib/data', () => ({
  createWord: vi.fn(async (w: Partial<Word>) => ({ id: 'new-id', ...w })),
  updateWord: vi.fn(),
  findByTerm: vi.fn(async () => []),
}));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => <a href={href} {...rest}>{children}</a> }));

afterEach(cleanup);

const previews: Record<Rating, string> = { again: '10m', hard: '1d', good: '1d', easy: '4d' };

const mitigate: Word = {
  id: 'm',
  term: 'mitigate',
  source: 'reading',
  meaning: 'to make something less harmful',
  uzbek: 'yumshatmoq',
  context: 'New rules aim to mitigate the damage.',
  part_of_speech: 'verb',
  synonyms: [
    { word: 'reduce', label: 'near', basis: '', provider: 'test', providerName: 'Test', sourceUrl: '', retrievedAt: '', verdict: 'fits', note: 'neutral', sources: [] },
    { word: 'soothe', label: 'near', basis: '', provider: 'test', providerName: 'Test', sourceUrl: '', retrievedAt: '', verdict: 'rejected', note: 'for pain or feelings', sources: [] },
    { word: 'allay', label: 'near', basis: '', provider: 'test', providerName: 'Test', sourceUrl: '', retrievedAt: '', verdict: 'rejected', note: 'for fears', sources: [] },
  ],
  paraphrase: '',
  example: '',
  sense_key: '',
  sense: null,
  audio: null,
  lookup_meta: null,
  status: 'active',
  ease: 2.5,
  interval_days: 1,
  repetitions: 0,
  lapses: 0,
  confidence: 3,
  due_at: new Date().toISOString(),
  last_reviewed_at: null,
  created_at: new Date().toISOString(),
};

const others: Word[] = ['alleviate', 'exacerbate', 'undermine'].map((t, i) => ({
  ...mitigate,
  id: `o${i}`,
  term: t,
  meaning: `meaning of ${t}`,
  synonyms: [],
}));
const all = [mitigate, ...others];

function renderCard(mode: Word['part_of_speech'], onRate = vi.fn()) {
  render(<ReviewCard word={mitigate} allWords={all} mode={mode as Parameters<typeof ReviewCard>[0]['mode']} previews={previews} onRate={onRate} busy={false} />);
  return onRate;
}

describe('ReviewCard', () => {
  it('recall: hides the answer until revealed, then rates', async () => {
    const onRate = renderCard('recall');
    expect(screen.queryByText(mitigate.meaning)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByText(mitigate.meaning)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /good/i }));
    expect(onRate).toHaveBeenCalledWith('good', { correct: null, answer: null });
  });

  it('type: forgives case and punctuation and suggests Good', async () => {
    const onRate = renderCard('type');
    await userEvent.type(screen.getByLabelText(/type the word/i), '  MITIGATE. {Enter}');
    expect(screen.getByText('Correct!')).toBeTruthy();
    expect(screen.getByRole('button', { name: /good/i }).className).toContain('suggested');
    await userEvent.click(screen.getByRole('button', { name: /good/i }));
    expect(onRate).toHaveBeenCalledWith('good', { correct: true, answer: '  MITIGATE. ' });
  });

  it('cloze: hides the word in the saved sentence and suggests Again when wrong', async () => {
    renderCard('cloze');
    expect(screen.queryByText(/mitigate the damage/)).toBeNull();
    await userEvent.type(screen.getByLabelText(/missing word/i), 'exacerbate{Enter}');
    expect(screen.getByText(/not quite/i)).toBeTruthy();
    const againBtn = screen.getByRole('button', { name: /again/i });
    expect(againBtn.className).toContain('suggested');
  });

  it('choice: shows 4 options and rates correctly when right answer picked', async () => {
    const onRate = renderCard('choice');
    const buttons = screen.getAllByRole('button').filter((b) => b.className.includes('option'));
    expect(buttons.length).toBe(4);
    const correct = buttons.find((b) => b.textContent?.includes('mitigate'));
    expect(correct).toBeDefined();
    await userEvent.click(correct!);
    const goodBtn = screen.getByRole('button', { name: /good/i });
    expect(goodBtn.className).toContain('suggested');
    await userEvent.click(goodBtn);
    expect(onRate).toHaveBeenCalledWith('good', { correct: true, answer: 'mitigate' });
  });

  it('recall: keyboard Space reveals the card', async () => {
    renderCard('recall');
    await userEvent.keyboard(' ');
    expect(screen.getByText(mitigate.meaning)).toBeTruthy();
  });

  it('rates via 1–4 keyboard shortcuts after reveal', async () => {
    const onRate = renderCard('recall');
    await userEvent.keyboard(' ');
    await userEvent.keyboard('3'); // Good = index 2 = key 3
    expect(onRate).toHaveBeenCalledWith('good', { correct: null, answer: null });
  });
});
