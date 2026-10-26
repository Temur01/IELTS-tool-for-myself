'use client';
import { useRef, useState } from 'react';

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Plays licensed dictionary audio when available, otherwise the device's
 * built-in text-to-speech voice (clearly labelled as such).
 */
export default function AudioButton({ audio, term, label, className = 'btn btn-sm' }) {
  const ref = useRef(null);
  const [error, setError] = useState(false);
  const useDevice = !audio?.url || error;

  const play = () => {
    if (!useDevice) {
      ref.current?.play().catch(() => setError(true));
      return;
    }
    if (!canSpeak()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(term);
    u.lang = 'en-GB';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  };

  if (useDevice && !canSpeak()) return null;

  return (
    <>
      {!useDevice && <audio ref={ref} src={audio.url} preload="none" onError={() => setError(true)} />}
      <button type="button" className={className} onClick={play} aria-label={`Play pronunciation of ${term}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
        </svg>
        {label ?? (useDevice ? 'Device voice' : audio.accent ? `Play (${audio.accent})` : 'Play')}
      </button>
    </>
  );
}
