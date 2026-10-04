import { describe, expect, it } from 'vitest';
import { collectionPlants, filterByModules } from './course';
import { gradeApproxDimension, gradeCommonName, gradeScientificName, spellingDiff } from './grading';
import { dueScore, emptyProgress, nextReview, recordReview, reviewKey, saveProgress, loadProgress } from './progress';
import { loadNotes, saveNotes } from './notes';
import { createBackup, parseBackup } from './backup';
import { answerDrill, packetAt, plantsForModule, startDrill } from './learn';
import type { CourseData } from './types';

describe('scientific name grading', () => {
  it('ignores surrounding space and capitalization, but rejects misspellings and missing cultivar', () => {
    expect(gradeScientificName('  quercus AGRIFOLIA  ', 'Quercus agrifolia')).toBe(true);
    expect(gradeScientificName('Quercus agrifola', 'Quercus agrifolia')).toBe(false);
    expect(gradeScientificName('Cedrus atlantica', "Cedrus atlantica 'Glauca'")).toBe(false);
    expect(spellingDiff('agrifola', 'agrifolia').some(x => x.mismatch)).toBe(true);
  });
  it('ignores punctuation and spacing while preserving the exact letters', () => {
    expect(gradeScientificName('acanthus,  MOLLIS', 'Acanthus mollis')).toBe(true);
    expect(gradeScientificName('Acanthusmollis', 'Acanthus mollis')).toBe(true);
    expect(gradeScientificName('Agapanthus sp', 'Agapanthus sp.')).toBe(true);
    expect(gradeScientificName('Agapanthus spp', 'Agapanthus sp.')).toBe(true);
    expect(gradeScientificName('Canna sp', 'Canna spp.')).toBe(true);
    expect(gradeScientificName('Hemerocallis spp.', 'Hemerocallis sp.')).toBe(true);
    expect(gradeScientificName('asparagus densiflorus sprengeri', "Asparagus densiflorus 'Sprengeri'")).toBe(true);
    expect(gradeScientificName('Acanthus molis', 'Acanthus mollis')).toBe(false);
    expect(gradeScientificName('Canna speciosa', 'Canna spp.')).toBe(false);
    expect(gradeScientificName('Asparagus densiflorus', "Asparagus densiflorus 'Sprengeri'")).toBe(false);
    expect(gradeScientificName(' , ', 'Acanthus mollis')).toBe(false);
  });
  it('accepts common-name variants separated by commas or slashes', () => {
    expect(gradeCommonName('bears  breech', "Bear's Breech")).toBe(true);
    expect(gradeCommonName('LILY OF THE NILE', 'Lily of the Nile')).toBe(true);
    expect(gradeCommonName('Jersey Lily', 'Hybrid naked lady, jersey lily')).toBe(true);
    expect(gradeCommonName('hybrid naked lady jersey lily', 'Hybrid naked lady, jersey lily')).toBe(true);
    expect(gradeCommonName('Apricot Mallow', 'apricot/desert/globe mallow')).toBe(true);
    expect(gradeCommonName('Desert Mallow', 'apricot/desert/globe mallow')).toBe(true);
    expect(gradeCommonName('Globe Mallow', 'apricot/desert/globe mallow')).toBe(true);
    expect(gradeCommonName('apricot', 'apricot/desert/globe mallow')).toBe(false);
    expect(gradeCommonName('Lily of Nile', 'Lily of the Nile')).toBe(false);
    expect(gradeCommonName('', 'Lily of the Nile')).toBe(false);
  });
  it('grades approximate dimensions only when the source is numeric', () => {
    expect(gradeApproxDimension('45 ft', "50'")).toBe(true);
    expect(gradeApproxDimension('20 ft', "50'")).toBe(false);
    expect(gradeApproxDimension('', "50'")).toBe(false);
    expect(gradeApproxDimension('4 ft', 'spreading')).toBe(null);
  });
});

const course: CourseData = {
  schemaVersion: 1,
  collections: [{ id: 'course', name: 'Course', description: '', moduleIds: ['w1', 'w2'], studyProfile: { requiredFacts: [] } }],
  modules: [{ id: 'w1', collectionId: 'course', name: 'Week 1', topic: '', order: 1 }, { id: 'w2', collectionId: 'course', name: 'Week 2', topic: '', order: 2 }],
  plants: [{ id: 'oak', scientificName: 'Quercus agrifolia', commonName: 'Coast Live Oak', alternateCourseNames: [], imageIds: [], sourceRefs: [] }],
  images: [], unmatchedSlides: [],
  memberships: [1, 2].map(n => ({ id: `m${n}`, collectionId: 'course', moduleId: `w${n}`, plantId: 'oak', order: n, category: 'Trees', facts: { scientificName: 'Quercus agrifolia', commonName: 'Coast Live Oak', dimensionsRaw: "45'x45'", height: "45'", spread: "45'", origin: 'California', wucolsZone3: 'VL', distinguishingFeatures: [], importantFacts: [] }, sourceRef: { file: 'master', row: n }, supportingSourceRef: { file: 'weekly', page: 1 } })),
};

describe('reusable plants and course memberships', () => {
  it('keeps one plant in two modules', () => {
    const items = collectionPlants(course, 'course');
    expect(items).toHaveLength(1);
    expect(items[0].memberships).toHaveLength(2);
    expect(filterByModules(items, ['w2'])).toHaveLength(1);
  });
  it('uses course order and advances a five-plant packet after two successful recalls each', () => {
    const items = collectionPlants(course, 'course');
    expect(plantsForModule(items, 'w2')[0].membership.moduleId).toBe('w2');
    expect(packetAt(items, 0)).toHaveLength(1);
    let drill = startDrill(['oak', 'cedar']);
    drill = answerDrill(drill, true);
    expect(drill.queue).toEqual(['cedar', 'oak']);
    drill = answerDrill(drill, false);
    expect(drill.hits.cedar).toBe(0);
    drill = answerDrill(drill, true);
    expect(drill.queue).toEqual(['cedar']);
    drill = answerDrill(drill, true);
    drill = answerDrill(drill, true);
    expect(drill.queue).toEqual([]);
    expect(drill.hits).toEqual({ oak: 2, cedar: 2 });
  });
});

describe('independent review and persistence', () => {
  it('schedules missed facts sooner and keeps skills separate', () => {
    const now = new Date('2026-09-25T12:00:00Z');
    const good = nextReview(undefined, 'good', now);
    const missed = nextReview(undefined, 'again', now);
    expect(new Date(missed.dueAt).getTime()).toBeLessThan(new Date(good.dueAt).getTime());
    expect(dueScore(missed, now.getTime() + 11 * 60_000)).toBeGreaterThan(dueScore(undefined));
    const progress = recordReview(emptyProgress(), { at: now.toISOString(), collectionId: 'course', plantId: 'oak', skill: 'scientificSpelling', rating: 'again' });
    expect(progress.reviews[reviewKey('course', 'oak', 'scientificSpelling')].incorrect).toBe(1);
    expect(progress.reviews[reviewKey('course', 'oak', 'identification')]).toBeUndefined();
  });
  it('restores saved progress independently of regenerated course data', () => {
    const memory = new Map<string, string>();
    const storage = { getItem: (key: string) => memory.get(key) || null, setItem: (key: string, value: string) => { memory.set(key, value); } };
    const progress = recordReview(emptyProgress(), { at: '2026-09-25T12:00:00Z', collectionId: 'course', plantId: 'oak', skill: 'wucolsZone3', rating: 'good' });
    saveProgress(progress, storage);
    const changedCourse = { ...course, modules: [...course.modules] };
    expect(collectionPlants(changedCourse, 'course')).toHaveLength(1);
    expect(loadProgress(storage)).toEqual(progress);
  });
  it('saves personal study notes separately from instructor data', () => {
    const memory = new Map<string, string>();
    const storage = { getItem: (key: string) => memory.get(key) || null, setItem: (key: string, value: string) => { memory.set(key, value); } };
    const notes = { oak: { distinguishingFeatures: 'leathery leaves', importantFacts: '' } };
    saveNotes(notes, storage);
    expect(loadNotes(storage)).toEqual(notes);
    expect(course.memberships[0].facts.distinguishingFeatures).toEqual([]);
  });
  it('round-trips the portable progress and notes backup', () => {
    const progress = recordReview(emptyProgress(), { at: '2026-09-25T12:00:00Z', collectionId: 'course', plantId: 'oak', skill: 'commonName', rating: 'good' });
    const notes = { oak: { distinguishingFeatures: 'leathery leaves', importantFacts: '' } };
    expect(parseBackup(createBackup(progress, notes))).toEqual({ progress, personalNotes: notes });
    expect(parseBackup(JSON.stringify(progress), notes)).toEqual({ progress, personalNotes: notes });
  });
});
