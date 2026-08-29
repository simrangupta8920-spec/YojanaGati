import { useState, useMemo } from 'react';
import { Search, Filter, X, Sparkles, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import type { Scholarship, LanguageCode, UserProfile } from '@/lib/types';
import { t } from '@/lib/i18n';
import { ScholarshipCard } from '@/components/ScholarshipCard';
import { rankScholarships, getEligible, type EligibilityResult } from '@/lib/eligibility';

interface BrowseViewProps {
  lang: LanguageCode;
  scholarships: Scholarship[];
  profile: UserProfile | null;
}

const CATEGORIES = [
  'All',
  'Merit-cum-Means',
  'Caste-based',
  'Minority',
  'Gender-based',
  'Merit',
  'Need-based',
  'Sports',
  'Disability',
];

const LEVELS = ['All', 'School', 'Undergraduate', 'Postgraduate', 'Any'];

export function BrowseView({ lang, scholarships, profile }: BrowseViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [levelFilter, setLevelFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  // ── Eligibility-ranked results ─────────────────────────────────────────────
  const rankedAll = useMemo(
    () => rankScholarships(scholarships, profile),
    [scholarships, profile],
  );

  const recommended = useMemo(
    () => (profile ? getEligible(scholarships, profile) : []),
    [scholarships, profile],
  );

  // ── Filtered browse list ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = rankedAll;

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        ({ scholarship: s }) =>
          s.name.toLowerCase().includes(lower) ||
          s.description.toLowerCase().includes(lower) ||
          s.keywords.some((k) => k.toLowerCase().includes(lower)),
      );
    }

    if (categoryFilter !== 'All') {
      result = result.filter(({ scholarship: s }) => s.category === categoryFilter);
    }

    if (levelFilter !== 'All') {
      result = result.filter(
        ({ scholarship: s }) =>
          s.education_level === levelFilter || s.education_level === 'Any',
      );
    }

    return result;
  }, [rankedAll, search, categoryFilter, levelFilter]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">

      {/* ── Recommended Section (profile-matched) ────────────────────────── */}
      {profile && recommended.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              {t(lang, 'recommendedForYou')}
            </h2>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
              {recommended.length} matched
            </span>
            <span className="text-sm text-slate-400">({t(lang, 'basedOnProfile')})</span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {recommended.slice(0, 5).map((result) => (
              <EligibilityCard
                key={result.scholarship.id}
                result={result}
                lang={lang}
                profile={profile}
                defaultExpanded={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── No-match nudge ───────────────────────────────────────────────── */}
      {profile && recommended.length === 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">
            <span className="font-semibold">No exact matches found</span> based on your current profile. Browse all scholarships below, or update your profile if something has changed.
          </p>
        </div>
      )}

      {/* ── Search + Filter ───────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(lang, 'searchScholarships')}
            className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-4 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            showFilters || categoryFilter !== 'All' || levelFilter !== 'All'
              ? 'border-teal-500 bg-teal-50 text-teal-700'
              : 'border-slate-200 text-slate-600 hover:border-teal-300'
          }`}
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filter</span>
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 space-y-3 rounded-xl border border-slate-100 bg-white p-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              {t(lang, 'filterByCategory')}
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    categoryFilter === cat
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'All' ? t(lang, 'allCategories') : cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              {t(lang, 'filterByLevel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setLevelFilter(level)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    levelFilter === level
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {level === 'All' ? 'All' : level}
                </button>
              ))}
            </div>
          </div>
          {(categoryFilter !== 'All' || levelFilter !== 'All') && (
            <button
              onClick={() => { setCategoryFilter('All'); setLevelFilter('All'); }}
              className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
              {t(lang, 'clearFilters')}
            </button>
          )}
        </div>
      )}

      <div className="mb-3 text-sm text-slate-500">
        {filtered.length} {t(lang, 'scholarshipsFound')}
        {profile && (
          <span className="ml-2 text-slate-400">(sorted by profile match)</span>
        )}
      </div>

      {/* ── All scholarships, ranked by eligibility score ─────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-400">{t(lang, 'noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((result) => (
            <EligibilityCard
              key={result.scholarship.id}
              result={result}
              lang={lang}
              profile={profile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EligibilityCard ──────────────────────────────────────────────────────────
// Wraps ScholarshipCard with a compact match-score bar and expandable breakdown.

interface EligibilityCardProps {
  result: EligibilityResult;
  lang: LanguageCode;
  profile: UserProfile | null;
  defaultExpanded?: boolean;
}

function EligibilityCard({ result, lang, profile, defaultExpanded }: EligibilityCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { scholarship, isEligible, score, criteria, mismatchReasons } = result;

  const borderColor = isEligible
    ? '#5eead4'   // teal-300 — eligible
    : mismatchReasons.length > 0
    ? '#fca5a5'   // rose-300 — not eligible
    : '#e2e8f0';  // slate-200 — unknown / no profile

  return (
    <div
      className="overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all duration-200"
      style={{ borderColor }}
    >
      {/* ── Match bar (only when profile exists) ────────────────────────── */}
      {profile && (
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-2">
          {isEligible ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" />
          ) : mismatchReasons.length > 0 ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          ) : (
            <HelpCircle className="h-4 w-4 shrink-0 text-amber-400" />
          )}

          <div className="flex-1 min-w-0">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-slate-600">
                {isEligible
                  ? 'Eligible — Profile Match'
                  : mismatchReasons.length > 0
                  ? 'Not Eligible based on your profile'
                  : 'Partial info — some criteria unknown'}
              </span>
              <span className="shrink-0 text-xs font-semibold text-teal-700">
                {score} pts
              </span>
            </div>
            {/* Score progress bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all ${
                  isEligible
                    ? 'bg-teal-500'
                    : mismatchReasons.length > 0
                    ? 'bg-rose-400'
                    : 'bg-amber-400'
                }`}
                style={{ width: `${Math.min(score, 100)}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => setShowBreakdown((v) => !v)}
            className="shrink-0 text-xs font-medium text-teal-600 hover:text-teal-800"
          >
            {showBreakdown ? 'Hide' : 'Why?'}
          </button>
        </div>
      )}

      {/* ── Criterion-by-criterion breakdown ────────────────────────────── */}
      {showBreakdown && profile && (
        <div className="border-b border-slate-100 bg-white px-5 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Eligibility Breakdown
          </p>
          <div className="space-y-1.5">
            {criteria.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                {c.status === 'pass' && (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                )}
                {c.status === 'fail' && (
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                )}
                {c.status === 'unknown' && (
                  <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                )}
                <span
                  className={
                    c.status === 'pass'
                      ? 'text-slate-700'
                      : c.status === 'fail'
                      ? 'text-rose-700'
                      : 'text-amber-700'
                  }
                >
                  <span className="font-semibold">{c.label}:</span> {c.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── The actual scholarship card ──────────────────────────────────── */}
      <ScholarshipCard
        scholarship={scholarship}
        lang={lang}
        profile={profile}
        defaultExpanded={defaultExpanded}
        overrideEligible={profile ? isEligible : null}
      />
    </div>
  );
}
