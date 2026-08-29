import { useState } from 'react';
import {
  User,
  Calendar,
  GraduationCap,
  MapPin,
  Users,
  IndianRupee,
  Percent,
  ArrowRight,
  ArrowLeft,
  Check,
  Mic,
} from 'lucide-react';
import type { LanguageCode, UserProfile } from '@/lib/types';
import {
  EDUCATION_LEVELS,
  INDIAN_STATES,
  CATEGORIES,
} from '@/lib/types';
import { t } from '@/lib/i18n';
import { VoiceButton } from '@/components/VoiceButton';

interface OnboardingViewProps {
  lang: LanguageCode;
  onComplete: (profile: UserProfile) => void;
  onSkip: () => void;
}

const STEPS = [
  { key: 'name', icon: User, labelKey: 'yourName' as const },
  { key: 'age', icon: Calendar, labelKey: 'yourAge' as const },
  { key: 'educationLevel', icon: GraduationCap, labelKey: 'educationLevel' as const },
  { key: 'state', icon: MapPin, labelKey: 'yourState' as const },
  { key: 'category', icon: Users, labelKey: 'category' as const },
  { key: 'income', icon: IndianRupee, labelKey: 'annualIncome' as const },
  { key: 'percentage', icon: Percent, labelKey: 'marksPercentage' as const },
  { key: 'gender', icon: User, labelKey: 'gender' as const },
];

export function OnboardingView({ lang, onComplete, onSkip }: OnboardingViewProps) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    age: '',
    educationLevel: '',
    state: '',
    category: '',
    income: '',
    percentage: '',
    gender: '',
  });

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;
  const canProceed = Boolean(profile[currentStep.key as keyof UserProfile]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete(profile);
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleVoiceInput = (text: string) => {
    const key = currentStep.key as keyof UserProfile;
    setProfile((prev) => ({ ...prev, [key]: text }));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <Mic className="h-6 w-6 text-teal-600" />
            {t(lang, 'voiceGuidedOnboarding')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t(lang, 'step')} {step + 1} {t(lang, 'of')} {STEPS.length}
          </p>
        </div>
        <button
          onClick={onSkip}
          className="text-sm font-medium text-slate-400 hover:text-slate-600"
        >
          {t(lang, 'skipOnboarding')}
        </button>
      </div>

      <div className="mb-6 flex gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? 'bg-teal-500' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      <div className="rounded-2xl border-2 border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50">
            <currentStep.icon className="h-6 w-6 text-teal-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">
            {t(lang, currentStep.labelKey)}
          </h2>
        </div>

        {currentStep.key === 'educationLevel' ? (
          <div className="grid grid-cols-2 gap-2">
            {EDUCATION_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() =>
                  setProfile((prev) => ({ ...prev, educationLevel: level }))
                }
                className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                  profile.educationLevel === level
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-slate-200 text-slate-600 hover:border-teal-300'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        ) : currentStep.key === 'state' ? (
          <select
            value={profile.state}
            onChange={(e) =>
              setProfile((prev) => ({ ...prev, state: e.target.value }))
            }
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-slate-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="">--</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : currentStep.key === 'category' ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  setProfile((prev) => ({ ...prev, category: cat }))
                }
                className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                  profile.category === cat
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-slate-200 text-slate-600 hover:border-teal-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : currentStep.key === 'gender' ? (
          <div className="grid grid-cols-3 gap-2">
            {(['male', 'female', 'other'] as const).map((g) => (
              <button
                key={g}
                onClick={() =>
                  setProfile((prev) => ({ ...prev, gender: g }))
                }
                className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                  profile.gender === g
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-slate-200 text-slate-600 hover:border-teal-300'
                }`}
              >
                {t(lang, g)}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={profile[currentStep.key as keyof UserProfile] ?? ''}
              onChange={(e) =>
                setProfile((prev) => ({
                  ...prev,
                  [currentStep.key]: e.target.value,
                }))
              }
              placeholder={t(lang, currentStep.labelKey)}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-slate-700 focus:border-teal-500 focus:outline-none"
            />
            <VoiceButton
              lang={lang}
              onTranscript={handleVoiceInput}
              label={t(lang, 'tapToSpeak')}
            />
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={step === 0}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          {t(lang, 'previousStep')}
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/20 transition-all hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLastStep ? (
            <>
              <Check className="h-4 w-4" />
              {t(lang, 'complete')}
            </>
          ) : (
            <>
              {t(lang, 'nextStep')}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
