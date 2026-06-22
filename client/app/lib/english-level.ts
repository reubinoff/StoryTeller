export const ENGLISH_LEVEL_MIN = 0;
export const ENGLISH_LEVEL_MAX = 100;

const LEVEL_BANDS = [
  { label: "Grade 1 English", shortLabel: "Grade 1", min: 0, max: 6 },
  { label: "Grade 2 English", shortLabel: "Grade 2", min: 7, max: 13 },
  { label: "Grade 3 English", shortLabel: "Grade 3", min: 14, max: 20 },
  { label: "Grade 4 English", shortLabel: "Grade 4", min: 21, max: 26 },
  { label: "Grade 5 English", shortLabel: "Grade 5", min: 27, max: 33 },
  { label: "Grade 6 English", shortLabel: "Grade 6", min: 34, max: 40 },
  { label: "Grade 7 English", shortLabel: "Grade 7", min: 41, max: 46 },
  { label: "Grade 8 English", shortLabel: "Grade 8", min: 47, max: 53 },
  { label: "Grade 9 English", shortLabel: "Grade 9", min: 54, max: 60 },
  { label: "Grade 10 English", shortLabel: "Grade 10", min: 61, max: 66 },
  { label: "Grade 11 English", shortLabel: "Grade 11", min: 67, max: 73 },
  { label: "Grade 12 English", shortLabel: "Grade 12", min: 74, max: 80 },
  { label: "Professional English", shortLabel: "Professional", min: 81, max: 100 },
] as const;

export function clampEnglishLevel(level: number) {
  if (!Number.isFinite(level)) return ENGLISH_LEVEL_MIN;
  return Math.max(ENGLISH_LEVEL_MIN, Math.min(ENGLISH_LEVEL_MAX, Math.round(level)));
}

export function englishLevelBand(level: number) {
  const normalized = clampEnglishLevel(level);
  return (
    LEVEL_BANDS.find((band) => normalized >= band.min && normalized <= band.max) ??
    LEVEL_BANDS[0]
  );
}

export function englishLevelLabel(level: number) {
  return englishLevelBand(level).label;
}

export function englishLevelShortLabel(level: number) {
  return englishLevelBand(level).shortLabel;
}
