import type { Progress } from './types';
import type { PersonalNotes } from './notes';
import { validateProgress } from './progress';

export function createBackup(progress: Progress, personalNotes: PersonalNotes): string {
  return JSON.stringify({ backupVersion: 1, progress, personalNotes }, null, 2);
}

export function parseBackup(source: string, currentNotes: PersonalNotes = {}): { progress: Progress; personalNotes: PersonalNotes } {
  const parsed = JSON.parse(source);
  const progress = validateProgress(parsed.backupVersion === 1 ? parsed.progress : parsed);
  const personalNotes = parsed.backupVersion === 1 && parsed.personalNotes && typeof parsed.personalNotes === 'object' && !Array.isArray(parsed.personalNotes) ? parsed.personalNotes as PersonalNotes : currentNotes;
  return { progress, personalNotes };
}
