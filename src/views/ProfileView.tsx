import { User, MapPin, IndianRupee, GraduationCap, Users, Calendar, Percent } from 'lucide-react';
import type { LanguageCode, UserProfile } from '@/lib/types';
import { t } from '@/lib/i18n';

interface ProfileViewProps {
  lang: LanguageCode;
  profile: UserProfile | null;
}

export function ProfileView({ lang, profile }: ProfileViewProps) {
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold text-slate-800">
        {t(lang, 'profile')}
      </h1>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">
            {t(lang, 'profileComplete')}
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <User className="h-4 w-4" /> {t(lang, 'yourName')}
              </span>
              <span className="text-base font-semibold text-slate-800">
                {profile.name || '-'}
              </span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Calendar className="h-4 w-4" /> {t(lang, 'yourAge')}
              </span>
              <span className="text-base font-semibold text-slate-800">
                {profile.age || '-'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <User className="h-4 w-4" /> {t(lang, 'gender')}
              </span>
              <span className="text-base font-semibold text-slate-800">
                {profile.gender ? t(lang, profile.gender as 'male' | 'female' | 'other') : '-'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <GraduationCap className="h-4 w-4" /> {t(lang, 'educationLevel')}
              </span>
              <span className="text-base font-semibold text-slate-800">
                {profile.educationLevel || '-'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <MapPin className="h-4 w-4" /> {t(lang, 'yourState')}
              </span>
              <span className="text-base font-semibold text-slate-800">
                {profile.state || '-'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Users className="h-4 w-4" /> {t(lang, 'category')}
              </span>
              <span className="text-base font-semibold text-slate-800">
                {profile.category || '-'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <IndianRupee className="h-4 w-4" /> {t(lang, 'annualIncome')}
              </span>
              <span className="text-base font-semibold text-slate-800">
                {profile.income ? `₹${profile.income}` : '-'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Percent className="h-4 w-4" /> {t(lang, 'marksPercentage')}
              </span>
              <span className="text-base font-semibold text-slate-800">
                {profile.percentage ? `${profile.percentage}%` : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
