import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewCard from '@/components/ReviewCard';

vi.mock('@/lib/data', () => ({
  createWord: vi.fn(async (w) => ({ id: 'new-id', ...w })),
  updateWord: vi.fn(),
  findByTerm: vi.fn(async () => []),
}));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }));

afterEach(cleanup);

const previews = { again: '10m', hard: '1d', good: '1d', easy: '4d' };
const mitigate = {
  id: 'm',
  term: 'mitigate',
  meaning: 'to make something less harmful',
  uzbek: 'yumshatmoq',
  context: 'New rules aim to mitigate the damage.',
  part_of_speech: 'verb',
  synonyms: [
    { word: 'reduce', verdict: 'fits', note: 'neutral' },
    { word: 'soothe', verdict: 'rejected', note: 'for pain or feelings' },
    { word: 'allay', verdict: 'rejected', note: 'for fears' },
  ],
  repetitions: 0,
};
const others = ['alleviate', 'exacerbate', 'undermine'].map((t, i) => ({ id: `o${i}`, term: t, meaning: `meaning of ${t}`, part_of_speech: 'verb', synonyms: [] }));
const all = [mitigate, ...others];

function renderCard(mode, onRate = vi.fn()) {
  render(<ReviewCard word={mitigate} allWords={all} mode={mode} previews={previews} onRate={onRate} />);
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
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: /good/i }));
    expect(onRate).toHaveBeenCalledWith('good', { correct: true, answer: '  MITIGATE. ' });
  });

  it('cloze: hides the word in the saved sentence and suggests Again when wrong', async () => {
    renderCard('cloze');
    expect(screen.queryByText(/mitigate the damage/)).toBeNull();
    await userEvent.type(screen.getByLabelText(/missing word/i), 'reduce{Enter}');
    expect(screen.getByText(/the answer is “mitigate”/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /again/i }).className).toContain('suggested');
  });

  it('multiple choice: shows explanations after answering', async () => {
    const onRate = renderCard('choice');
    await userEvent.click(screen.getByRole('button', { name: /exacerbate/ }));
    expect(screen.getByText('meaning of exacerbate')).toBeTruthy();
    expect(screen.getByText(/not quite/i)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /again/i }));
    expect(onRate).toHaveBeenCalledWith('again', { correct: false, answer: 'exacerbate' });
  });

  it('synonym in context: the verified replacement is correct; rejected ones explain why', async () => {
    renderCard('synonym');
    expect(screen.getByText(/without changing the meaning/i)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /reduce/ }));
    expect(screen.getByText('Correct!')).toBeTruthy();
    expect(screen.getByText('for pain or feelings')).toBeTruthy();
  });

  it('paraphrase: warns when the paraphrase reuses the word', async () => {
    renderCard('paraphrase');
    await userEvent.type(screen.getByRole('textbox'), 'The rules mitigate damage');
    await userEvent.click(screen.getByRole('button', { name: /compare/i }));
    expect(screen.getByText(/still uses/i)).toBeTruthy();
  });

  it('keyboard: 1–4 rate after revealing', async () => {
    const onRate = renderCard('reverse');
    await userEvent.keyboard(' ');
    await userEvent.keyboard('4');
    expect(onRate).toHaveBeenCalledWith('easy', { correct: null, answer: null });
  });
});

describe('Add word flow', () => {
  it('requires a meaning, then saves the word with its source', async () => {
    const { default: WordForm } = await import('@/components/WordForm');
    const { createWord } = await import('@/lib/data');
    const onSaved = vi.fn();
    render(<WordForm onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText(/word or phrase/i), 'mitigate');
    await userEvent.click(screen.getByRole('radio', { name: 'Listening' }));
    await userEvent.click(screen.getByRole('button', { name: /save word/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/meaning/i);
    expect(createWord).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/uzbek/i), 'yumshatmoq');
    await userEvent.click(screen.getByRole('button', { name: /save word/i }));
    expect(createWord).toHaveBeenCalledWith(expect.objectContaining({ term: 'mitigate', source: 'listening', uzbek: 'yumshatmoq', synonyms: [] }));
    expect(onSaved).toHaveBeenCalled();
  });
});
