import { useState, useEffect } from 'react';
import {
  GraduationCap,
  Mic,
  Bot,
  ShieldCheck,
  FileCheck,
  ArrowRight,
  Sparkles,
  Volume2,
  CheckCircle2,
  Globe,
  Lock,
  Zap,
  Menu,
  X,
} from 'lucide-react';
import type { LanguageCode } from '@/lib/types';
import { t } from '@/lib/i18n';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useTextToSpeech } from '@/hooks/useSpeech';
import { LANGUAGES } from '@/lib/types';

interface LandingViewProps {
  lang: LanguageCode;
  onLangChange: (lang: LanguageCode) => void;
  onGetStarted: () => void;
}

export function LandingView({ lang, onLangChange, onGetStarted }: LandingViewProps) {
  const { speak, isSpeaking, stopSpeaking } = useTextToSpeech(lang);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: Mic,
      title: t(lang, 'landingFeature1Title'),
      desc: t(lang, 'landingFeature1Desc'),
      gradient: 'from-teal-500 to-teal-700',
    },
    {
      icon: Bot,
      title: t(lang, 'landingFeature2Title'),
      desc: t(lang, 'landingFeature2Desc'),
      gradient: 'from-blue-500 to-blue-700',
    },
    {
      icon: FileCheck,
      title: t(lang, 'landingFeature3Title'),
      desc: t(lang, 'landingFeature3Desc'),
      gradient: 'from-amber-500 to-amber-700',
    },
    {
      icon: Lock,
      title: t(lang, 'landingFeature4Title'),
      desc: t(lang, 'landingFeature4Desc'),
      gradient: 'from-rose-500 to-rose-700',
    },
  ];

  const steps = [
    { num: '01', title: t(lang, 'landingStep1Title'), desc: t(lang, 'landingStep1Desc') },
    { num: '02', title: t(lang, 'landingStep2Title'), desc: t(lang, 'landingStep2Desc') },
    { num: '03', title: t(lang, 'landingStep3Title'), desc: t(lang, 'landingStep3Desc') },
    { num: '04', title: t(lang, 'landingStep4Title'), desc: t(lang, 'landingStep4Desc') },
  ];

  const stats = [
    { value: '20+', label: t(lang, 'landingStatsScholarships') },
    { value: '7', label: t(lang, 'landingStatsLanguages') },
    { value: '0', label: t(lang, 'landingStatsPrivacy') },
    { value: '95%', label: t(lang, 'landingStatsAccuracy') },
  ];

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-slate-100 bg-white/90 shadow-sm backdrop-blur-md'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5"
          >
            <img src="/logo.png" alt="YojanaGati" className="h-14 w-48 object-contain sm:h-16 sm:w-56" />
          </button>

          <div className="hidden items-center gap-8 md:flex">
            <button
              onClick={() => scrollToSection('features')}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600"
            >
              {t(lang, 'landingNavFeatures')}
            </button>
            <button
              onClick={() => scrollToSection('howitworks')}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600"
            >
              {t(lang, 'landingNavHowItWorks')}
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600"
            >
              {t(lang, 'landingNavAbout')}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSelector lang={lang} onLangChange={onLangChange} compact />
            <button
              onClick={onGetStarted}
              className="hidden rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/20 transition-all hover:bg-teal-700 sm:block"
            >
              {t(lang, 'landingCtaTryNow')}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-slate-600 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              <button
                onClick={() => scrollToSection('features')}
                className="text-left text-sm font-medium text-slate-600 hover:text-teal-600"
              >
                {t(lang, 'landingNavFeatures')}
              </button>
              <button
                onClick={() => scrollToSection('howitworks')}
                className="text-left text-sm font-medium text-slate-600 hover:text-teal-600"
              >
                {t(lang, 'landingNavHowItWorks')}
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="text-left text-sm font-medium text-slate-600 hover:text-teal-600"
              >
                {t(lang, 'landingNavAbout')}
              </button>
              <button
                onClick={onGetStarted}
                className="mt-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white"
              >
                {t(lang, 'landingCtaTryNow')}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-teal-100/50 blur-3xl" />
          <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-amber-100/30 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-100/30 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/80 px-4 py-1.5 text-sm font-medium text-teal-700 backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            {t(lang, 'landingBadge')}
          </div>

          <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-slate-800 sm:text-5xl md:text-6xl">
            {t(lang, 'landingHeroTitle')}
          </h1>

          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-slate-500">
            {t(lang, 'landingHeroSubtitle')}
          </p>

          <div className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={onGetStarted}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-teal-600/25 transition-all hover:shadow-xl hover:shadow-teal-600/30 sm:w-auto"
            >
              <GraduationCap className="h-5 w-5" />
              {t(lang, 'getStarted')}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-8 py-4 text-base font-semibold text-slate-700 transition-all hover:border-teal-300 hover:bg-slate-50 sm:w-auto"
            >
              {t(lang, 'landingCtaLearnMore')}
            </button>
          </div>

          <button
            onClick={() =>
              isSpeaking
                ? stopSpeaking()
                : speak(`${t(lang, 'landingHeroTitle')}. ${t(lang, 'landingHeroSubtitle')}`)
            }
            className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700"
          >
            <Volume2 className="h-4 w-4" />
            {t(lang, 'listenDescription')}
          </button>

          {/* Language pills */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => onLangChange(l.code)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  lang === l.code
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-teal-300'
                }`}
              >
                {l.nativeLabel}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-slate-100 bg-slate-50/50 py-12">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="mb-1 text-3xl font-bold text-teal-600 md:text-4xl">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
              {t(lang, 'landingFeaturesTitle')}
            </h2>
            <p className="mx-auto max-w-xl text-base text-slate-500">
              {t(lang, 'landingFeaturesSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-7 shadow-sm transition-all hover:shadow-lg hover:shadow-slate-200/50"
              >
                <div
                  className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${feature.gradient} opacity-10 transition-transform group-hover:scale-150`}
                />
                <div
                  className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} shadow-lg`}
                >
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-800">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="howitworks" className="bg-slate-50/50 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
              {t(lang, 'landingHowItWorksTitle')}
            </h2>
            <p className="mx-auto max-w-xl text-base text-slate-500">
              {t(lang, 'landingHowItWorksSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div key={i} className="relative">
                {i < steps.length - 1 && (
                  <div className="absolute left-full top-8 hidden h-0.5 w-full -translate-x-1/2 bg-gradient-to-r from-teal-300 to-teal-100 lg:block" />
                )}
                <div className="relative rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-lg font-bold text-teal-600">
                    {step.num}
                  </div>
                  <h3 className="mb-1.5 text-base font-semibold text-slate-800">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-500">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About / Trust Section */}
      <section id="about" className="py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-3xl border border-slate-100 bg-gradient-to-br from-teal-50/50 to-white p-8 sm:p-12">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100">
                <ShieldCheck className="h-6 w-6 text-teal-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">
                {t(lang, 'landingTrustTitle')}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { icon: Globe, title: t(lang, 'landingStatsLanguages'), desc: 'Hindi, English, Punjabi, Bengali, Tamil, Telugu, Marathi' },
                { icon: Lock, title: t(lang, 'privacyFirst'), desc: t(lang, 'zeroRetention') },
                { icon: Zap, title: t(lang, 'landingStatsAccuracy'), desc: 'AI-powered RAG matching engine' },
              ].map((item, i) => (
                <div key={i} className="rounded-2xl bg-white p-5 shadow-sm">
                  <item.icon className="mb-3 h-6 w-6 text-teal-600" />
                  <h3 className="mb-1 text-sm font-semibold text-slate-800">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-100/40 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
            {t(lang, 'landingCtaTitle')}
          </h2>
          <p className="mb-8 text-base text-slate-500">
            {t(lang, 'landingCtaSubtitle')}
          </p>
          <button
            onClick={onGetStarted}
            className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-teal-600/25 transition-all hover:shadow-xl hover:shadow-teal-600/30"
          >
            <Sparkles className="h-5 w-5" />
            {t(lang, 'landingCtaTryNow')}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-teal-500" />
              {t(lang, 'zeroRetention')}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-teal-500" />
              {t(lang, 'privacyFirst')}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-teal-500" />
              7 {t(lang, 'landingStatsLanguages')}
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50 py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <div>
                <img src="/logo.png" alt="YojanaGati" className="h-16 w-56 object-contain" />
                <p className="text-xs text-slate-400">
                  {t(lang, 'landingFooterTagline')}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} YojanaGati. {t(lang, 'landingFooterRights')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
