export function normalizeName(value: string): string {
  // Grade the spelling of the letters and numbers, not their presentation.
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function gradeScientificName(answer: string, expected: string): boolean {
  // The prompt does not reveal whether a generic entry uses sp. or spp.
  const normalizeScientific = (value: string) => normalizeName(value.replace(/\bspp?\b/giu, 'sp'));
  const normalized = normalizeScientific(answer);
  return normalized.length > 0 && normalized === normalizeScientific(expected);
}

export function gradeCommonName(answer: string, expected: string): boolean {
  const normalized = normalizeName(answer);
  // The Week 1 source abbreviates three complete names with one shared suffix.
  const alternatives = normalizeName(expected) === 'apricotdesertglobemallow'
    ? ['apricot mallow', 'desert mallow', 'globe mallow']
    : expected.split(/,|\//);
  const options = [expected, ...alternatives].map(normalizeName);
  return normalized.length > 0 && options.includes(normalized);
}

export function gradeWucols(answer: string, expected: string): boolean {
  return answer.trim().toUpperCase() === expected;
}

function feet(value: string): number | null {
  const cleaned = value.trim().toLowerCase();
  if (/varies|spreading|vining/.test(cleaned)) return null;
  const feetMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)?(?:\s*-\s*(\d+(?:\.\d+)?)\s*(?:'|ft|feet)?)?$/);
  if (feetMatch) return Number(feetMatch[1]);
  const inchMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inches)$/);
  if (inchMatch) return Number(inchMatch[1]) / 12;
  return null;
}

export function gradeApproxDimension(answer: string, expected: string | null): boolean | null {
  if (!expected) return null;
  const actual = feet(answer), target = feet(expected);
  if (target === null) return null;
  if (actual === null) return false;
  return Math.abs(actual - target) <= Math.max(1, target * 0.2);
}

export function spellingDiff(answer: string, expected: string): { answer: string; expected: string; mismatch: boolean }[] {
  const a = answer.trim(), b = expected.trim();
  const n = Math.max(a.length, b.length);
  return Array.from({ length: n }, (_, i) => ({ answer: a[i] || '∅', expected: b[i] || '∅', mismatch: (a[i] || '').toLowerCase() !== (b[i] || '').toLowerCase() }));
}
