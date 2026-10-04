import type { CourseData, Membership, Plant, ImageRecord } from './types';

export interface CoursePlant { plant: Plant; membership: Membership; memberships: Membership[]; images: ImageRecord[]; hasPersonalFeatures?: boolean; hasPersonalFacts?: boolean }

export function collectionPlants(data: CourseData, collectionId: string): CoursePlant[] {
  const plants = new Map(data.plants.map(p => [p.id, p]));
  const images = new Map<string, ImageRecord[]>();
  for (const image of data.images) if (image.plantId) images.set(image.plantId, [...(images.get(image.plantId) || []), image]);
  const memberships = new Map<string, Membership[]>();
  for (const membership of data.memberships.filter(m => m.collectionId === collectionId)) {
    memberships.set(membership.plantId, [...(memberships.get(membership.plantId) || []), membership]);
  }
  return [...memberships.entries()].map(([id, items]) => ({
    plant: plants.get(id)!, membership: items[0], memberships: items, images: images.get(id) || [],
  }));
}

export function filterByModules(items: CoursePlant[], selected: string[]): CoursePlant[] {
  return selected.length ? items.filter(item => item.memberships.some(m => selected.includes(m.moduleId))) : items;
}

export function moduleNames(item: CoursePlant, data: CourseData): string {
  const names = new Map(data.modules.map(m => [m.id, m.name]));
  return item.memberships.map(m => names.get(m.moduleId)).join(', ');
}
