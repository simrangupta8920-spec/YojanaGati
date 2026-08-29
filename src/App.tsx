import { useState, useEffect } from 'react';
import {
  Compass,
  Bot,
  FileCheck,
  ShieldX,
} from 'lucide-react';
import type { LanguageCode, View, UserProfile } from '@/lib/types';
import { t } from '@/lib/i18n';
import { fetchScholarships, type Scholarship } from '@/lib/supabase';
import { useEphemeralSession, type UploadedFile } from '@/hooks/useEphemeralSession';
import { LanguageSelector } from '@/components/LanguageSelector';
import { LandingView } from '@/views/LandingView';
import { OnboardingView } from '@/views/OnboardingView';
import { BrowseView } from '@/views/BrowseView';
import { ChatView } from '@/views/ChatView';
import { DocumentsView } from '@/views/DocumentsView';
import { PurgeView } from '@/views/PurgeView';

type AppStage = 'welcome' | 'onboarding' | 'main';

export default function App() {
  const [lang, setLang] = useState<LanguageCode>('en');
  const [stage, setStage] = useState<AppStage>('welcome');
  const [view, setView] = useState<View>('browse');
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);

  const session = useEphemeralSession();

  useEffect(() => {
    fetchScholarships().then((data) => {
      setScholarships(data);
      setLoading(false);
    });
  }, []);

  if (session.isPurged) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PurgeView
          lang={lang}
          onPurge={() => {}}
          onNewSession={() => {
            session.startNewSession();
            setStage('welcome');
            setView('browse');
          }}
          isPurged={true}
          fileCount={0}
        />
      </div>
    );
  }

  if (stage === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-teal-50/30">
        <LandingView
          lang={lang}
          onLangChange={setLang}
          onGetStarted={() => setStage('onboarding')}
        />
      </div>
    );
  }

  if (stage === 'onboarding') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="border-b border-slate-100 bg-white">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <img src="/logo.png" alt="YojanaGati" className="h-11 w-40 object-contain" />
            <LanguageSelector lang={lang} onLangChange={setLang} compact />
          </div>
        </div>
        <OnboardingView
          lang={lang}
          onComplete={(profile: UserProfile) => {
            session.setProfile(profile);
            setStage('main');
            setView('browse');
          }}
          onSkip={() => {
            setStage('main');
            setView('browse');
          }}
        />
      </div>
    );
  }

  const navItems: { view: View; icon: typeof Compass; labelKey: Parameters<typeof t>[1] }[] = [
    { view: 'browse', icon: Compass, labelKey: 'browse' },
    { view: 'chat', icon: Bot, labelKey: 'chatAssistant' },
    { view: 'documents', icon: FileCheck, labelKey: 'documents' },
    { view: 'purge', icon: ShieldX, labelKey: 'exit' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <button
            onClick={() => setStage('welcome')}
            className="flex items-center gap-2"
          >
            <img src="/logo.png" alt="YojanaGati" className="h-11 w-40 object-contain" />
          </button>
          <div className="flex items-center gap-3">
            {session.profile && (
              <span className="hidden text-sm text-slate-400 sm:inline">
                {t(lang, 'welcomeBack')}, {session.profile.name || 'User'}
              </span>
            )}
            <LanguageSelector lang={lang} onLangChange={setLang} compact />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
          </div>
        ) : view === 'browse' ? (
          <BrowseView
            lang={lang}
            scholarships={scholarships}
            profile={session.profile}
          />
        ) : view === 'chat' ? (
          <ChatView
            lang={lang}
            scholarships={scholarships}
            profile={session.profile}
          />
        ) : view === 'documents' ? (
          <DocumentsView
            lang={lang}
            profile={session.profile}
            scholarships={scholarships}
            uploadedFiles={session.uploadedFiles}
            onAddFile={session.addFile}
            onRemoveFile={session.removeFile}
            onUpdateFileAnalysis={session.updateFileAnalysis}
          />
        ) : view === 'purge' ? (
          <PurgeView
            lang={lang}
            onPurge={session.purge}
            onNewSession={() => {
              session.startNewSession();
              setStage('welcome');
            }}
            isPurged={false}
            fileCount={session.uploadedFiles.length}
          />
        ) : null}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = view === item.view;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
                  isActive
                    ? 'text-teal-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <item.icon
                  className={`h-5 w-5 ${isActive ? 'fill-teal-50' : ''}`}
                />
                <span className="text-xs font-medium">
                  {t(lang, item.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
