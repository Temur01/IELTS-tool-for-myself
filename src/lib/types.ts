// Shared types used across lib, components and app.

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type ReviewMode = 'recall' | 'reverse' | 'paraphrase' | 'cloze' | 'type' | 'choice' | 'synonym' | 'listen';
export type WordStatus = 'new' | 'learning' | 'mastered' | 'archived';
export type Source = 'reading' | 'listening' | 'general';
export type Verdict = 'unreviewed' | 'fits' | 'rejected';
export type SynonymLabel = 'near' | 'related';

export interface SrsSettings {
  againMinutes: number;
  firstIntervalDays: number;
  secondIntervalDays: number;
  easyFirstIntervalDays: number;
  hardMultiplier: number;
  easyBonus: number;
  startingEase: number;
  maxIntervalDays: number;
}

export interface AudioLicense {
  name: string;
  url: string;
}

export interface Audio {
  url: string;
  text: string;
  license: AudioLicense;
  sourceUrl: string;
  accent: string;
}

export interface Sense {
  id: string;
  provider: string;
  providerName: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  synonyms: string[];
  relatedSynonyms: string[];
  sourceUrl: string;
  retrievedAt?: string;
  // set by rankSenses
  score?: number;
  index?: number;
  suggested?: boolean;
}

export interface SavedSense {
  provider: string;
  providerName: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  sourceUrl: string;
  retrievedAt: string;
}

export interface SynonymSource {
  provider: string;
  providerName: string;
  sourceUrl: string;
}

export interface Synonym {
  word: string;
  label: SynonymLabel;
  basis: string;
  provider: string;
  providerName: string;
  sourceUrl: string;
  retrievedAt: string;
  verdict: Verdict;
  note: string;
  sources: SynonymSource[];
}

export interface LookupMeta {
  retrievedAt: string;
  providers: ProviderInfo[];
}

export interface ProviderInfo {
  id: string;
  name: string;
  url: string;
  status: string;
  message?: string;
  suggestions?: string[];
}

export interface Word {
  id: string;
  term: string;
  term_key?: string;
  source: Source;
  context: string;
  meaning: string;
  uzbek: string;
  paraphrase: string;
  example: string;
  part_of_speech: string;
  sense_key: string;
  sense: SavedSense | null;
  synonyms: Synonym[];
  audio: Audio | null;
  lookup_meta: LookupMeta | null;
  status: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  confidence: number;
  due_at: string;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Review {
  id: string;
  word_id: string;
  mode: ReviewMode;
  rating: Rating;
  correct: boolean | null;
  answer: string | null;
  early: boolean;
  prev_ease?: number;
  new_ease?: number;
  prev_interval: number;
  new_interval: number;
  prev_repetitions?: number;
  new_repetitions?: number;
  prev_lapses?: number;
  new_lapses?: number;
  prev_confidence?: number;
  new_confidence?: number;
  due_at?: string;
  reviewed_at: string;
}

export interface SrsCard {
  ease?: number;
  interval_days?: number;
  repetitions?: number;
  lapses?: number;
  due_at?: string;
  confidence?: number;
}

export interface ScheduleResult {
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: Date;
  confidence: number;
}

export interface ApplyReviewResult extends ScheduleResult {
  early: boolean;
  changed: boolean;
}

export interface ClozeResult {
  before: string;
  answer: string;
  after: string;
}

export interface CheckAnswerResult {
  correct: boolean;
  typo: boolean;
  matched: string | null;
}

export interface QueueItem {
  wordId: string;
  mode: ReviewMode;
  early: boolean;
  key: string;
}

export interface SessionResultEntry {
  wordId: string;
  mode: ReviewMode;
  rating: Rating;
  newDueAt: string;
}

export interface SessionState {
  queue: QueueItem[];
  index: number;
  results: SessionResultEntry[];
  minutes: number;
  startedAt: string;
  day: string;
  done?: boolean;
}

export interface SessionSummary {
  reviewed: number;
  words: number;
  learned: number;
  missed: number;
  missedIds: string[];
  dueAgainToday: number;
  minutes: number;
}

export interface Choice {
  term: string;
  explanation: string;
  correct: boolean;
}

export interface Candidate {
  word: string;
  partsOfSpeech?: string[];
  basis: string;
  provider: string;
  providerName: string;
  sourceUrl: string;
  retrievedAt?: string;
}

export interface LookupResult {
  term: string;
  retrievedAt: string;
  providers: ProviderInfo[];
  senses: Sense[];
  candidates: Candidate[];
  audio: Audio[];
}

export interface ReviewRecord {
  wordId: string;
  mode: ReviewMode;
  rating: Rating;
  correct: boolean | null;
  answer: string | null;
  early: boolean;
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: Date | string;
  confidence: number;
  reviewedAt?: Date | string;
}

export interface RecordReviewResult {
  saved: boolean;
  word?: Word;
}

export interface DictionaryProvider {
  id: string;
  name: string;
  homepage: string;
  enabled: () => boolean;
  lookup: (term: string, opts: LookupOptions) => Promise<ProviderResult>;
}

export interface LookupOptions {
  fresh?: boolean;
  lc?: string;
  rc?: string;
}

export interface ProviderResult {
  senses: Sense[];
  candidates: Candidate[];
  audio: Audio[];
  sourceUrl: string;
}
