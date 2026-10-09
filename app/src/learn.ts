import type { CoursePlant } from './course';

export const ALL_MODULES = 'all';

export function plantsForModule(items: CoursePlant[], moduleId: string, moduleOrder: Record<string, number> = {}): CoursePlant[] {
  if (moduleId === ALL_MODULES) {
    // Each plant once, at its first week, so recurring plants are not drilled twice.
    const rank = (item: CoursePlant) => (moduleOrder[item.membership.moduleId] ?? 0) * 1000 + item.membership.order;
    return [...items].sort((a, b) => rank(a) - rank(b));
  }
  return items.flatMap(item => {
    const membership = item.memberships.find(entry => entry.moduleId === moduleId);
    return membership ? [{ ...item, membership }] : [];
  }).sort((a, b) => a.membership.order - b.membership.order);
}

export function packetAt(items: CoursePlant[], index: number, size = 5): CoursePlant[] {
  return items.slice(index * size, index * size + size);
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
