export interface PersonalNote { distinguishingFeatures: string; importantFacts: string }
export type PersonalNotes = Record<string, PersonalNote>;
const KEY = 'plant-brain-notes-v1';

export function loadNotes(storage: Pick<Storage, 'getItem'> = localStorage): PersonalNotes {
  try {
    const data = JSON.parse(storage.getItem(KEY) || '{}');
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch { return {}; }
}

export function saveNotes(notes: PersonalNotes, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(KEY, JSON.stringify(notes));
}
