import type { Progress, Rating, ReviewEvent, ReviewState, Skill } from './types';

const STORAGE_KEY = 'plant-brain-progress-v1';
export const emptyProgress = (): Progress => ({ version: 1, reviews: {}, history: [] });
export const reviewKey = (collectionId: string, plantId: string, skill: Skill) => `${collectionId}:${plantId}:${skill}`;

export function nextReview(previous: ReviewState | undefined, rating: Rating, now = new Date()): ReviewState {
  const attempts = (previous?.attempts || 0) + 1;
  const correct = (previous?.correct || 0) + (rating === 'again' ? 0 : 1);
  const incorrect = (previous?.incorrect || 0) + (rating === 'again' ? 1 : 0);
  const streak = rating === 'again' ? 0 : (previous?.streak || 0) + 1;
  const priorInterval = previous?.intervalDays || 0;
  const intervalDays = rating === 'again' ? 10 / 1440 : rating === 'hard' ? Math.max(0.5, priorInterval * 1.2) : rating === 'good' ? Math.max(1, priorInterval * 2.3) : Math.max(3, priorInterval * 3.2);
  const difficulty = Math.min(5, Math.max(1, (previous?.difficulty || 3) + (rating === 'again' ? 0.5 : rating === 'hard' ? 0.2 : rating === 'easy' ? -0.3 : -0.1)));
  return {
    attempts, correct, incorrect, streak, difficulty, intervalDays,
    lastReviewed: now.toISOString(), dueAt: new Date(now.getTime() + intervalDays * 86400000).toISOString(),
    recentMistakes: rating === 'again' ? [now.toISOString(), ...(previous?.recentMistakes || [])].slice(0, 5) : previous?.recentMistakes || [],
  };
}

export function recordReview(progress: Progress, event: ReviewEvent): Progress {
  const key = reviewKey(event.collectionId, event.plantId, event.skill);
  return {
    version: 1,
    reviews: { ...progress.reviews, [key]: nextReview(progress.reviews[key], event.rating, new Date(event.at)) },
    history: [...progress.history, event],
  };
}

export function loadProgress(storage: Pick<Storage, 'getItem'> = localStorage): Progress {
  try {
    const value = storage.getItem(STORAGE_KEY);
    return value ? validateProgress(JSON.parse(value)) : emptyProgress();
  } catch { return emptyProgress(); }
}

export function saveProgress(progress: Progress, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function validateProgress(value: unknown): Progress {
  if (!value || typeof value !== 'object') throw new Error('Invalid progress file');
  const data = value as Partial<Progress>;
  if (data.version !== 1 || !data.reviews || typeof data.reviews !== 'object' || !Array.isArray(data.history)) throw new Error('Unsupported progress file');
  for (const state of Object.values(data.reviews)) {
    if (typeof state.attempts !== 'number' || typeof state.dueAt !== 'string') throw new Error('Invalid review state');
  }
  return data as Progress;
}

export function dueScore(state: ReviewState | undefined, now = Date.now()): number {
  if (!state) return 38;
  const overdue = (now - new Date(state.dueAt).getTime()) / 86400000;
  return (overdue >= 0 ? 30 + Math.min(30, overdue * 4) : Math.max(0, 10 + overdue)) + state.difficulty * 5 + Math.min(20, state.incorrect * 3) - Math.min(10, state.streak);
}
