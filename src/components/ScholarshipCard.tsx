import { useState } from 'react';
import {
  GraduationCap,
  Calendar,
  Building2,
  MapPin,
  FileText,
  IndianRupee,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { Scholarship, LanguageCode, UserProfile } from '@/lib/types';
import { t } from '@/lib/i18n';
import { SpeakButton } from './VoiceButton';

interface ScholarshipCardProps {
  scholarship: Scholarship;
  lang: LanguageCode;
  profile?: UserProfile | null;
  defaultExpanded?: boolean;
  /** Pre-computed eligibility from the engine; overrides local calculation when provided */
  overrideEligible?: boolean | null;
}

export function ScholarshipCard({
  scholarship,
  lang,
  profile,
  defaultExpanded = false,
  overrideEligible,
}: ScholarshipCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const descriptionText = [
    scholarship.name,
    scholarship.description,
    scholarship.eligibility_criteria,
    `Funding: ${scholarship.funding_amount}`,
    `Deadline: ${scholarship.deadline}`,
    `Required documents: ${scholarship.required_documents.join(', ')}`,
  ].join('. ');

  const categoryColors: Record<string, string> = {
    'Merit-cum-Means': 'bg-teal-100 text-teal-700',
    'Caste-based': 'bg-amber-100 text-amber-700',
    Minority: 'bg-purple-100 text-purple-700',
    'Gender-based': 'bg-pink-100 text-pink-700',
    Merit: 'bg-blue-100 text-blue-700',
    'Need-based': 'bg-green-100 text-green-700',
    Sports: 'bg-orange-100 text-orange-700',
    Disability: 'bg-indigo-100 text-indigo-700',
  };

  const categoryColor =
    categoryColors[scholarship.category] ?? 'bg-slate-100 text-slate-700';

  const isEligible = overrideEligible !== undefined
    ? overrideEligible
    : checkEligibility(scholarship, profile);

  return (
    <div className="bg-white">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColor}`}
              >
                {scholarship.category}
              </span>
              {isEligible === true && (
                <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {t(lang, 'matched')}
                </span>
              )}
              {isEligible === false && profile && (
                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-400">
                  <AlertCircle className="h-3 w-3" />
                  {t(lang, 'notMatched')}
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              {lang === 'hi' && scholarship.name_hindi
                ? scholarship.name_hindi
                : scholarship.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">
              {scholarship.description}
            </p>
          </div>
          <SpeakButton lang={lang} text={descriptionText} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoChip
            icon={<IndianRupee className="h-4 w-4" />}
            label={t(lang, 'fundingAmount')}
            value={scholarship.funding_amount}
          />
          <InfoChip
            icon={<Calendar className="h-4 w-4" />}
            label={t(lang, 'deadline')}
            value={scholarship.deadline}
          />
          <InfoChip
            icon={<GraduationCap className="h-4 w-4" />}
            label={t(lang, 'educationLevel')}
            value={scholarship.education_level}
          />
          <InfoChip
            icon={<MapPin className="h-4 w-4" />}
            label={t(lang, 'region')}
            value={scholarship.region}
          />
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              {t(lang, 'hideDetails')}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              {t(lang, 'viewDetails')}
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-5">
          <div className="space-y-4">
            <div>
              <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
                {t(lang, 'eligibility')}
              </h4>
              <p className="text-sm text-slate-600">
                {scholarship.eligibility_criteria}
              </p>
            </div>

            <div>
              <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <FileText className="h-4 w-4 text-teal-600" />
                {t(lang, 'requiredDocuments')}
              </h4>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {scholarship.required_documents.map((doc, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-slate-600"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                    {doc}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Building2 className="h-4 w-4 text-teal-600" />
                {t(lang, 'provider')}
              </h4>
              <p className="text-sm text-slate-600">{scholarship.provider}</p>
            </div>

            {scholarship.min_income && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <IndianRupee className="h-4 w-4" />
                <span>
                  {t(lang, 'annualIncome')}: {scholarship.min_income}
                </span>
              </div>
            )}

            {scholarship.min_percentage && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <GraduationCap className="h-4 w-4" />
                <span>
                  {t(lang, 'marksPercentage')}: {scholarship.min_percentage}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-xs text-slate-400">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-slate-700">{value}</span>
    </div>
  );
}

function checkEligibility(
  scholarship: Scholarship,
  profile?: UserProfile | null,
): boolean | null {
  if (!profile) return null;

  let eligible = true;

  if (scholarship.min_percentage && profile.percentage) {
    const pct = parseInt(profile.percentage, 10);
    if (!isNaN(pct) && pct < scholarship.min_percentage) {
      eligible = false;
    }
  }

  if (scholarship.min_income && profile.income) {
    const income = parseInt(profile.income.replace(/[^0-9]/g, ''), 10);
    const minIncome = parseInt(scholarship.min_income.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(income) && !isNaN(minIncome) && income > minIncome) {
      eligible = false;
    }
  }

  return eligible;
}
