import type { CoursePlant } from './course';

export function plantsForModule(items: CoursePlant[], moduleId: string): CoursePlant[] {
  return items.flatMap(item => {
    const membership = item.memberships.find(entry => entry.moduleId === moduleId);
    return membership ? [{ ...item, membership }] : [];
  }).sort((a, b) => a.membership.order - b.membership.order);
}

export function packetAt(items: CoursePlant[], index: number): CoursePlant[] {
  return items.slice(index * 5, index * 5 + 5);
}

export interface DrillState {
  queue: string[];
  hits: Record<string, number>;
  attempts: Record<string, number>;
}

export function startDrill(ids: string[]): DrillState {
  return { queue: [...ids], hits: Object.fromEntries(ids.map(id => [id, 0])), attempts: Object.fromEntries(ids.map(id => [id, 0])) };
}

export function answerDrill(state: DrillState, remembered: boolean): DrillState {
  const [id, ...remaining] = state.queue;
  if (!id) return state;
  const hits = { ...state.hits, [id]: remembered ? state.hits[id] + 1 : 0 };
  return {
    queue: hits[id] >= 2 ? remaining : [...remaining, id],
    hits,
    attempts: { ...state.attempts, [id]: state.attempts[id] + 1 },
  };
}
