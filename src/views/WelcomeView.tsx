import {
  GraduationCap,
  Mic,
  Bot,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type { LanguageCode } from '@/lib/types';
import { t } from '@/lib/i18n';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useTextToSpeech } from '@/hooks/useSpeech';

interface WelcomeViewProps {
  lang: LanguageCode;
  onLangChange: (lang: LanguageCode) => void;
  onGetStarted: () => void;
}

export function WelcomeView({ lang, onLangChange, onGetStarted }: WelcomeViewProps) {
  const { speak } = useTextToSpeech(lang);

  const features = [
    {
      icon: Mic,
      title: t(lang, 'voiceGuidedOnboarding'),
      desc: 'Navigate by voice in your language',
    },
    {
      icon: Bot,
      title: t(lang, 'chatAssistant'),
      desc: 'Ask questions, get matched',
    },
    {
      icon: ShieldCheck,
      title: t(lang, 'privacyFirst'),
      desc: t(lang, 'zeroRetention'),
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-teal-100/40 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-amber-100/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-100/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-12 sm:py-20">
        <div className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-1.5 text-sm font-medium text-teal-700">
            <Sparkles className="h-4 w-4" />
            {t(lang, 'privacyFirst')}
          </div>

          <img src="/logo.png" alt="YojanaGati" className="mx-auto mb-4 h-24 w-80 object-contain sm:h-28 sm:w-96" />
          <p className="mb-2 text-xl text-slate-500">
            {t(lang, 'appTagline')}
          </p>
          <button
            onClick={() => speak(`${t(lang, 'appName')}. ${t(lang, 'appTagline')}`)}
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700"
          >
            <Volume2 className="h-4 w-4" />
            {t(lang, 'listenDescription')}
          </button>
        </div>

        <div className="mb-10">
          <LanguageSelector lang={lang} onLangChange={onLangChange} />
        </div>

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition-all hover:shadow-md"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 transition-transform group-hover:scale-110">
                <feature.icon className="h-6 w-6 text-teal-600" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-800">
                {feature.title}
              </h3>
              <p className="text-xs text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={onGetStarted}
            className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-teal-600/25 transition-all hover:shadow-xl hover:shadow-teal-600/30"
          >
            <GraduationCap className="h-5 w-5" />
            {t(lang, 'getStarted')}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
