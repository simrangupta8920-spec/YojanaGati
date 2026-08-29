/**
 * eligibility.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Smart eligibility engine that matches scholarships to a user profile.
 * Each scholarship is scored across multiple criteria:
 *   • Annual family income  (hard disqualifier if exceeded)
 *   • Marks / percentage    (hard disqualifier if below minimum)
 *   • Age                   (hard disqualifier if out of range)
 *   • Category / caste      (hard disqualifier if wrong category)
 *   • Gender                (hard disqualifier if wrong gender)
 *   • Education level       (soft match – adds to score)
 *   • Region / state        (soft match – adds to score)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Scholarship } from '@/lib/supabase';
import type { UserProfile } from '@/lib/types';

export type CriterionStatus = 'pass' | 'fail' | 'unknown';

export interface CriterionResult {
  label: string;
  status: CriterionStatus;
  detail: string;
}

export interface EligibilityResult {
  scholarship: Scholarship;
  /** 0–100 match score (higher = better match) */
  score: number;
  /** True only when ALL hard criteria pass */
  isEligible: boolean;
  criteria: CriterionResult[];
  /** Short bullet list of why this scholarship matches */
  matchReasons: string[];
  /** Short bullet list of why this scholarship does NOT match */
  mismatchReasons: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a raw income string like "3,00,000" or "300000" into a number */
function parseIncome(raw: string): number | null {
  const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? null : n;
}

/**
 * Map education level strings to a numeric tier.
 * Returns 0 for "Any" / unknown (means: no restriction applies from this side).
 * Used to compare user level vs scholarship level.
 */
function eduTier(level: string): number {
  const l = level.toLowerCase().trim();
  if (!l || l === 'any') return 0;           // 0 = no restriction
  if (l.includes('school') && (l.includes('1-10') || l.includes('class 1'))) return 1;
  if (l.includes('school') && l.includes('11-12')) return 2;
  if (l.includes('diploma')) return 3;
  if (l.includes('undergraduate') || l.includes('ug') || l === 'ug') return 4;
  if (l.includes('postgraduate') || l.includes('pg') || l === 'pg') return 5;
  return 0;
}

// ─── Core matching ────────────────────────────────────────────────────────────

export function evaluateEligibility(
  scholarship: Scholarship,
  profile: UserProfile,
): EligibilityResult {
  const criteria: CriterionResult[] = [];
  let score = 0;
  let hardFail = false;

  // ── 1. Income ──────────────────────────────────────────────────────────────
  {
    const userIncome = profile.income ? parseIncome(profile.income) : null;
    const cap = scholarship.max_income_num;

    if (cap === null) {
      criteria.push({ label: 'Annual Income', status: 'pass', detail: 'No income limit for this scholarship.' });
      score += 10;
    } else if (userIncome === null) {
      criteria.push({ label: 'Annual Income', status: 'unknown', detail: `Income limit is ₹${cap.toLocaleString('en-IN')}/year. Please add your income to check eligibility.` });
    } else if (userIncome <= cap) {
      criteria.push({ label: 'Annual Income', status: 'pass', detail: `Your income ₹${userIncome.toLocaleString('en-IN')} is within the ₹${cap.toLocaleString('en-IN')}/year limit.` });
      // Closer to 0 income = higher score boost (more needy)
      score += Math.round(20 * (1 - userIncome / cap));
      score += 10; // base pass bonus
    } else {
      criteria.push({ label: 'Annual Income', status: 'fail', detail: `Your income ₹${userIncome.toLocaleString('en-IN')} exceeds the limit of ₹${cap.toLocaleString('en-IN')}/year.` });
      hardFail = true;
    }
  }

  // ── 2. Marks / Percentage ──────────────────────────────────────────────────
  {
    const userPct = profile.percentage ? parseInt(profile.percentage, 10) : null;
    const minPct = scholarship.min_percentage;

    if (minPct === null) {
      criteria.push({ label: 'Academic Marks', status: 'pass', detail: 'No minimum marks required.' });
      score += 10;
    } else if (userPct === null) {
      criteria.push({ label: 'Academic Marks', status: 'unknown', detail: `Minimum ${minPct}% required. Please add your marks to check eligibility.` });
    } else if (userPct >= minPct) {
      const margin = userPct - minPct;
      criteria.push({ label: 'Academic Marks', status: 'pass', detail: `Your ${userPct}% meets the minimum ${minPct}% requirement (${margin}% above).` });
      score += 10 + Math.min(margin, 10); // up to +20 for high marks
    } else {
      criteria.push({ label: 'Academic Marks', status: 'fail', detail: `Your ${userPct}% is below the required ${minPct}%.` });
      hardFail = true;
    }
  }

  // ── 3. Age ─────────────────────────────────────────────────────────────────
  {
    const userAge = profile.age ? parseInt(profile.age, 10) : null;
    const minAge = scholarship.min_age;
    const maxAge = scholarship.max_age;

    if (minAge === null && maxAge === null) {
      criteria.push({ label: 'Age', status: 'pass', detail: 'No age restriction.' });
      score += 5;
    } else if (userAge === null) {
      criteria.push({ label: 'Age', status: 'unknown', detail: `Age restriction applies (${minAge ?? '–'}–${maxAge ?? '–'} years). Add your age to verify.` });
    } else {
      const aboveMin = minAge === null || userAge >= minAge;
      const belowMax = maxAge === null || userAge <= maxAge;
      if (aboveMin && belowMax) {
        criteria.push({ label: 'Age', status: 'pass', detail: `Your age ${userAge} is within the eligible range.` });
        score += 5;
      } else {
        const issue = !aboveMin ? `below minimum ${minAge}` : `above maximum ${maxAge}`;
        criteria.push({ label: 'Age', status: 'fail', detail: `Your age ${userAge} is ${issue} years.` });
        hardFail = true;
      }
    }
  }

  // ── 4. Category / Caste ────────────────────────────────────────────────────
  {
    const userCat = profile.category?.trim() || '';
    const allowed = scholarship.target_categories;

    if (allowed.length === 0) {
      // Open to all categories
      criteria.push({ label: 'Category', status: 'pass', detail: 'Open to all categories.' });
      score += 10;
    } else {
      const match = allowed.some(
        (c) => c.toLowerCase() === userCat.toLowerCase(),
      );
      if (!userCat) {
        criteria.push({ label: 'Category', status: 'unknown', detail: `This scholarship is for: ${allowed.join(', ')}. Add your category to verify.` });
      } else if (match) {
        criteria.push({ label: 'Category', status: 'pass', detail: `Your category "${userCat}" matches this scholarship's target (${allowed.join(', ')}).` });
        score += 25; // strong match signal
      } else {
        criteria.push({ label: 'Category', status: 'fail', detail: `This scholarship targets ${allowed.join(', ')} students; you selected "${userCat}".` });
        hardFail = true;
      }
    }
  }

  // ── 5. Gender ──────────────────────────────────────────────────────────────
  {
    const userGender = profile.gender?.toLowerCase().trim() || '';
    const required = scholarship.target_gender;

    if (required === null) {
      criteria.push({ label: 'Gender', status: 'pass', detail: 'Open to all genders.' });
      score += 5;
    } else if (!userGender) {
      criteria.push({ label: 'Gender', status: 'unknown', detail: `This scholarship is for ${required} students. Add your gender to verify.` });
    } else if (userGender === required) {
      criteria.push({ label: 'Gender', status: 'pass', detail: `Your gender matches (${required} students preferred).` });
      score += 15;
    } else {
      criteria.push({ label: 'Gender', status: 'fail', detail: `This scholarship is for ${required} students only.` });
      hardFail = true;
    }
  }

  // ── 6. Education Level (HARD disqualifier) ────────────────────────────────
  // A school student must NOT see undergraduate scholarships, and vice versa.
  {
    const schEduTier = eduTier(scholarship.education_level);
    const userEduTier = eduTier(profile.educationLevel || '');

    if (schEduTier === 0) {
      criteria.push({ label: 'Education Level', status: 'pass', detail: 'Open to all education levels.' });
      score += 5;
    } else if (userEduTier === 0) {
      criteria.push({ label: 'Education Level', status: 'unknown', detail: `This scholarship is for ${scholarship.education_level} students. Add your education level to verify.` });
    } else if (userEduTier === schEduTier) {
      criteria.push({ label: 'Education Level', status: 'pass', detail: `Your education level (${profile.educationLevel}) matches the requirement.` });
      score += 15;
    } else {
      criteria.push({
        label: 'Education Level',
        status: 'fail',
        detail: `This scholarship is for ${scholarship.education_level} students, but you are in ${profile.educationLevel}.`,
      });
      hardFail = true; // HARD — wrong education level disqualifies completely
    }
  }

  // ── 7. State / Region (HARD for state-specific, soft for All India) ────────
  {
    const userState = profile.state?.toLowerCase().trim() || '';
    const schRegion = scholarship.region.toLowerCase();

    if (schRegion === 'all india' || !schRegion) {
      criteria.push({ label: 'State / Region', status: 'pass', detail: 'Available across all of India.' });
      score += 5;
    } else if (!userState) {
      criteria.push({ label: 'State / Region', status: 'unknown', detail: `Only available in ${scholarship.region}. Add your state to verify.` });
    } else if (schRegion.includes(userState)) {
      criteria.push({ label: 'State / Region', status: 'pass', detail: `Available in ${scholarship.region} — matches your state (${profile.state}).` });
      score += 10;
    } else {
      criteria.push({
        label: 'State / Region',
        status: 'fail',
        detail: `This scholarship is only for residents of ${scholarship.region}. Your state is ${profile.state}.`,
      });
      hardFail = true; // HARD — state-specific scholarships are strict
    }
  }

  // ── Build match/mismatch reason lists ─────────────────────────────────────
  const matchReasons = criteria
    .filter((c) => c.status === 'pass')
    .map((c) => c.detail);

  const mismatchReasons = criteria
    .filter((c) => c.status === 'fail')
    .map((c) => c.detail);

  // Simplified: eligible = no hard criterion failed.
  // The old `criteria.some(pass)` check was always trivially true and caused
  // scholarships with hard failures to still appear as eligible.
  const isEligible = !hardFail;

  return {
    scholarship,
    score: Math.max(0, score),
    isEligible,
    criteria,
    matchReasons,
    mismatchReasons,
  };
}

/**
 * Returns all scholarships evaluated and sorted by score descending.
 * If no profile provided, returns raw list unsorted.
 */
export function rankScholarships(
  scholarships: Scholarship[],
  profile: UserProfile | null,
): EligibilityResult[] {
  if (!profile) {
    return scholarships.map((s) => ({
      scholarship: s,
      score: 0,
      isEligible: null as unknown as boolean,
      criteria: [],
      matchReasons: [],
      mismatchReasons: [],
    }));
  }

  return scholarships
    .map((s) => evaluateEligibility(s, profile))
    .sort((a, b) => b.score - a.score);
}

/** Returns only scholarships where all hard criteria pass, ranked by score */
export function getEligible(
  scholarships: Scholarship[],
  profile: UserProfile,
): EligibilityResult[] {
  return rankScholarships(scholarships, profile).filter((r) => r.isEligible);
}
