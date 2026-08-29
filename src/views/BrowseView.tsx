import { useState, useMemo } from 'react';
import { Search, Filter, X, Sparkles } from 'lucide-react';
import type { Scholarship, LanguageCode, UserProfile } from '@/lib/types';
import { t } from '@/lib/i18n';
import { ScholarshipCard } from '@/components/ScholarshipCard';

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

  const filtered = useMemo(() => {
    let result = scholarships;

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(lower) ||
          s.description.toLowerCase().includes(lower) ||
          s.keywords.some((k) => k.toLowerCase().includes(lower)),
      );
    }

    if (categoryFilter !== 'All') {
      result = result.filter((s) => s.category === categoryFilter);
    }

    if (levelFilter !== 'All') {
      result = result.filter(
        (s) =>
          s.education_level === levelFilter ||
          s.education_level === 'Any',
      );
    }

    return result;
  }, [scholarships, search, categoryFilter, levelFilter]);

  const recommended = useMemo(() => {
    if (!profile) return [];
    return scholarships.filter((s) => {
      let eligible = true;
      if (s.min_percentage && profile.percentage) {
        const pct = parseInt(profile.percentage, 10);
        if (!isNaN(pct) && pct < s.min_percentage) eligible = false;
      }
      if (s.min_income && profile.income) {
        const income = parseInt(profile.income.replace(/[^0-9]/g, ''), 10);
        const minIncome = parseInt(s.min_income.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(income) && !isNaN(minIncome) && income > minIncome)
          eligible = false;
      }
      return eligible;
    });
  }, [scholarships, profile]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {profile && recommended.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              {t(lang, 'recommendedForYou')}
            </h2>
            <span className="text-sm text-slate-400">
              ({t(lang, 'basedOnProfile')})
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {recommended.slice(0, 3).map((s) => (
              <ScholarshipCard
                key={s.id}
                scholarship={s}
                lang={lang}
                profile={profile}
                defaultExpanded
              />
            ))}
          </div>
        </div>
      )}

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
              onClick={() => {
                setCategoryFilter('All');
                setLevelFilter('All');
              }}
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
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-400">{t(lang, 'noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((s) => (
            <ScholarshipCard
              key={s.id}
              scholarship={s}
              lang={lang}
              profile={profile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
