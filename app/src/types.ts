export type Skill = 'identification' | 'scientificSpelling' | 'commonName' | 'height' | 'spread' | 'wucolsZone3' | 'distinguishingFeatures' | 'importantFacts';
export type Rating = 'again' | 'hard' | 'good' | 'easy';
export interface SourceRef { file: string; page?: number; row?: number; sheet?: string; imageNumber?: number }
export interface Plant { id: string; scientificName: string; commonName: string; alternateCourseNames: string[]; imageIds: string[]; sourceRefs: SourceRef[] }
export interface Facts { scientificName: string; commonName: string; dimensionsRaw: string; height: string | null; spread: string | null; origin: string; wucolsZone3: string; distinguishingFeatures: string[]; importantFacts: string[]; flowerColor?: string }
export interface Membership { id: string; collectionId: string; moduleId: string; plantId: string; order: number; category: string; facts: Facts; sourceRef: SourceRef; supportingSourceRef: SourceRef; presentationRefs?: { file: string; page: number; title: string }[] }
export interface ImageRecord { id: string; plantId: string | null; url: string; part: string | null; source: string; caption: string; notes: string | null; rights: string; sourceRef: SourceRef }
export interface Collection { id: string; name: string; description: string; moduleIds: string[]; studyProfile: { requiredFacts: string[]; exam?: { plantCount: number; fields: string[] } } }
export interface Module { id: string; collectionId: string; name: string; topic: string; order: number }
export interface CourseData { schemaVersion: number; collections: Collection[]; modules: Module[]; plants: Plant[]; memberships: Membership[]; images: ImageRecord[]; unmatchedSlides: unknown[] }
export interface ReviewState { attempts: number; correct: number; incorrect: number; streak: number; difficulty: number; intervalDays: number; lastReviewed: string; dueAt: string; recentMistakes: string[] }
export interface ReviewEvent { at: string; collectionId: string; plantId: string; skill: Skill; rating: Rating; prompt?: string }
export interface Progress { version: 1; reviews: Record<string, ReviewState>; history: ReviewEvent[] }
