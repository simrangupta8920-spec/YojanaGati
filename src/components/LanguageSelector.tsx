import { Globe, Check } from 'lucide-react';
import { LANGUAGES, type LanguageCode } from '@/lib/types';
import { t } from '@/lib/i18n';

interface LanguageSelectorProps {
  lang: LanguageCode;
  onLangChange: (lang: LanguageCode) => void;
  compact?: boolean;
}

export function LanguageSelector({
  lang,
  onLangChange,
  compact = false,
}: LanguageSelectorProps) {
  if (compact) {
    return (
      <div className="relative">
        <select
          value={lang}
          onChange={(e) => onLangChange(e.target.value as LanguageCode)}
          className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-teal-400 focus:border-teal-500 focus:outline-none"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeLabel}
            </option>
          ))}
        </select>
        <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-700">
        <Globe className="h-5 w-5 text-teal-600" />
        <h2 className="text-lg font-semibold">{t(lang, 'selectLanguage')}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={() => onLangChange(l.code)}
            className={`group relative flex flex-col items-center gap-1 rounded-2xl border-2 p-4 transition-all duration-200 ${
              lang === l.code
                ? 'border-teal-500 bg-teal-50 shadow-md shadow-teal-500/10'
                : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50'
            }`}
          >
            {lang === l.code && (
              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-white">
                <Check className="h-3 w-3" />
              </span>
            )}
            <span className="text-2xl font-bold text-slate-800">
              {l.flag}
            </span>
            <span className="text-base font-medium text-slate-700">
              {l.nativeLabel}
            </span>
            <span className="text-xs text-slate-400">{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
