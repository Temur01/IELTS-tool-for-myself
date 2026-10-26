'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { checkAnswer, findCloze, usesTerm } from '@/lib/answer';
import { verifiedReplacements } from '@/lib/senses';
import { MODES, buildChoices, buildSynonymChoices, promptMeaning } from '@/lib/session';
import { RATINGS, RATING_LABELS } from '@/lib/srs';
import AudioButton from './AudioButton';
import { Highlighted } from './ui';

const SELF_RATED = new Set(['recall', 'reverse', 'paraphrase']);

function suggestedRating(result) {
  if (!result) return null;
  if (!result.correct) return 'again';
  return result.typo ? 'hard' : 'good';
}

function Details({ word, showTerm = true }) {
  const cloze = findCloze(word.context, word.term);
  const fits = verifiedReplacements(word.synonyms);
  return (
    <div className="answer stack">
      {showTerm && (
        <div className="row">
          <span className="prompt-term" style={{ fontSize: '2rem' }}>{word.term}</span>
          {word.part_of_speech && <span className="chip">{word.part_of_speech}</span>}
          <AudioButton audio={word.audio} term={word.term} label="" className="btn btn-sm icon-btn" />
        </div>
      )}
      <dl className="dl">
        {word.meaning && (<><dt>Meaning</dt><dd>{word.meaning}</dd></>)}
        {word.uzbek && (<><dt>Uzbek</dt><dd lang="uz">{word.uzbek}</dd></>)}
        {word.sense?.definition && (
          <><dt>Dictionary</dt><dd>{word.sense.definition} <span className="hint">({word.sense.providerName})</span></dd></>
        )}
        {word.paraphrase && (<><dt>Paraphrase</dt><dd>{word.paraphrase}</dd></>)}
        {word.example && (<><dt>Example</dt><dd>{word.example}</dd></>)}
        {fits.length > 0 && (
          <><dt>Fits your sentence</dt><dd>{fits.map((s) => s.word + (s.note ? ` (${s.note})` : '')).join(', ')}</dd></>
        )}
      </dl>
      {cloze ? <p className="context"><Highlighted {...cloze} /></p> : word.context && <p className="context">{word.context}</p>}
    </div>
  );
}

function AnswerInput({ value, onChange, onSubmit, disabled, placeholder, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit();
      }}
    >
      <input
        ref={ref}
        className="input input-lg"
        style={{ flex: 1, minWidth: 0 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck="false"
      />
      {!disabled && (
        <button type="submit" className="btn btn-primary btn-lg" disabled={!value.trim()}>
          Check
        </button>
      )}
    </form>
  );
}

function Options({ options, picked, onPick }) {
  return (
    <div className="options" role="group" aria-label="Choices">
      {options.map((o, i) => {
        const state = picked == null ? '' : o.correct ? 'correct' : picked === i ? 'wrong' : '';
        return (
          <button key={o.term} type="button" className={`option ${state}`} disabled={picked != null} onClick={() => onPick(i)}>
            <span className="kbd" aria-hidden="true">{i + 1}</span> {o.term}
            {picked != null && o.explanation && <span className="option-explain">{o.explanation}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function ReviewCard({ word, allWords, mode, previews, onRate, busy }) {
  const [revealed, setRevealed] = useState(false);
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState(null);
  const [showHint, setShowHint] = useState(false);

  const cloze = useMemo(() => findCloze(word.context, word.term), [word]);
  // Options are fixed for the lifetime of this card.
  const options = useMemo(() => {
    if (mode === 'choice') return buildChoices(word, allWords);
    if (mode === 'synonym') return buildSynonymChoices(word, allWords);
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id, mode]);

  const check = (accepted) => {
    const r = checkAnswer(input, accepted);
    setResult(r);
    setRevealed(true);
  };

  const pick = (i) => {
    if (picked != null) return;
    setPicked(i);
    setResult({ correct: options[i].correct, typo: false });
    setRevealed(true);
  };

  const suggested = SELF_RATED.has(mode) ? null : suggestedRating(result);

  const rate = (rating) => {
    if (busy) return;
    const answer = picked != null ? options[picked].term : input || null;
    onRate(rating, { correct: result ? result.correct : null, answer });
  };

  // Keyboard: Space/Enter reveals, 1–4 rate (or pick an option).
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (!revealed && SELF_RATED.has(mode) && mode !== 'paraphrase' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (!revealed && options && /^[1-4]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (options[i]) pick(i);
      } else if (revealed && /^[1-4]$/.test(e.key)) {
        rate(RATINGS[Number(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const meaningPrompt = promptMeaning(word);

  return (
    <article className="flashcard" aria-live="polite">
      <div className="row spread">
        <span className="eyebrow">{MODES[mode].label}</span>
        {word.part_of_speech && mode !== 'listen' && <span className="chip">{word.part_of_speech}</span>}
      </div>

      {mode === 'recall' && (
        <>
          <div className="row">
            <span className="prompt-term">{word.term}</span>
            <AudioButton audio={word.audio} term={word.term} label="" className="btn btn-sm icon-btn" />
          </div>
          <p className="muted">What does it mean? Say it or think it, then reveal.</p>
          {!revealed && word.context && (
            showHint
              ? <p className="context">{cloze ? <Highlighted {...cloze} /> : word.context}</p>
              : <button type="button" className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setShowHint(true)}>Show my sentence</button>
          )}
        </>
      )}

      {mode === 'reverse' && (
        <>
          {meaningPrompt && <p className="prompt-text">{meaningPrompt}</p>}
          {word.uzbek && <p className="prompt-text muted" lang="uz">🇺🇿 {word.uzbek}</p>}
          <p className="muted">Which English word or phrase is this? Recall it, then reveal.</p>
        </>
      )}

      {mode === 'paraphrase' && (
        <>
          <div className="prompt-term">{word.term}</div>
          {word.context && <p className="context">{cloze ? <Highlighted {...cloze} /> : word.context}</p>}
          <label className="label" htmlFor="paraphrase-input">
            {word.context ? 'Rewrite the sentence without using this word:' : 'Explain the meaning in your own words:'}
          </label>
          <textarea
            id="paraphrase-input"
            className="textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={revealed}
            maxLength={1000}
          />
          {revealed && usesTerm(input, word.term) && (
            <p className="feedback-wrong small">Your paraphrase still uses “{word.term}”. Try a different expression.</p>
          )}
        </>
      )}

      {mode === 'cloze' && cloze && (
        <>
          <p className="context">
            {cloze.before}
            <span className="gap">{revealed ? cloze.answer : ' ? '}</span>
            {cloze.after}
          </p>
          <p className="hint">
            Hint: {meaningPrompt || word.uzbek} · starts with “{cloze.answer[0]}”, {cloze.answer.length} letters
          </p>
          <AnswerInput value={input} onChange={setInput} onSubmit={() => check([cloze.answer, word.term])} disabled={revealed} label="Missing word" placeholder="Type the missing word" />
        </>
      )}

      {mode === 'type' && (
        <>
          {meaningPrompt && <p className="prompt-text">{meaningPrompt}</p>}
          {word.uzbek && <p className="prompt-text muted" lang="uz">🇺🇿 {word.uzbek}</p>}
          <AnswerInput value={input} onChange={setInput} onSubmit={() => check(word.term)} disabled={revealed} label="Type the word" placeholder="Type the English word" />
        </>
      )}

      {mode === 'choice' && (
        <>
          <p className="prompt-text">{meaningPrompt || word.uzbek}</p>
          <p className="muted small">Choose the word that matches this meaning.</p>
          <Options options={options} picked={picked} onPick={pick} />
        </>
      )}

      {mode === 'synonym' && cloze && (
        <>
          <p className="context"><Highlighted {...cloze} /></p>
          <p className="muted">
            Which word could replace <strong>{cloze.answer}</strong> here without changing the meaning?
          </p>
          <Options options={options} picked={picked} onPick={pick} />
        </>
      )}

      {mode === 'listen' && (
        <>
          <p className="muted">Listen and type what you hear. (A pronunciation drill, not an IELTS Listening question.)</p>
          <div>
            <AudioButton audio={word.audio} term={word.term} className="btn btn-lg" label={word.audio?.url ? 'Play audio' : 'Play (device voice)'} />
          </div>
          <AnswerInput value={input} onChange={setInput} onSubmit={() => check(word.term)} disabled={revealed} label="What did you hear?" placeholder="Type what you hear" />
        </>
      )}

      {!revealed && SELF_RATED.has(mode) && (
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setRevealed(true)}>
          {mode === 'paraphrase' ? 'Compare' : 'Reveal'} <span className="kbd" aria-hidden="true">space</span>
        </button>
      )}

      {revealed && result && (
        <p className={result.correct ? 'feedback-correct' : 'feedback-wrong'} role="status">
          {result.correct
            ? result.typo
              ? `Almost — check the spelling: “${result.matched}”.`
              : 'Correct!'
            : options
              ? 'Not quite — see the explanations above.'
              : `Not quite. The answer is “${mode === 'cloze' && cloze ? cloze.answer : word.term}”.`}
        </p>
      )}

      {revealed && <Details word={word} showTerm={mode !== 'recall'} />}

      {revealed && (
        <div>
          <p className="hint" style={{ marginBottom: '0.4rem' }}>
            How well did you know it?{suggested ? ' The highlighted button is a suggestion.' : ''}
          </p>
          <div className="ratings">
            {RATINGS.map((r, i) => (
              <button
                key={r}
                type="button"
                className={`rate rate-${r} ${suggested === r ? 'suggested' : ''}`}
                onClick={() => rate(r)}
                disabled={busy}
                aria-keyshortcuts={String(i + 1)}
              >
                {RATING_LABELS[r]}
                <small>{previews[r]}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
