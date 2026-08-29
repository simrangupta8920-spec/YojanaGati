import { useState } from 'react';
import { ShieldCheck, Trash2, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import type { LanguageCode } from '@/lib/types';
import { t } from '@/lib/i18n';

interface PurgeViewProps {
  lang: LanguageCode;
  onPurge: () => void;
  onNewSession: () => void;
  isPurged: boolean;
  fileCount: number;
}

export function PurgeView({
  lang,
  onPurge,
  onNewSession,
  isPurged,
  fileCount,
}: PurgeViewProps) {
  const [confirming, setConfirming] = useState(false);

  if (isPurged) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-teal-100">
          <CheckCircle2 className="h-10 w-10 text-teal-600" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-slate-800">
          {t(lang, 'purgeComplete')}
        </h1>
        <p className="mb-1 text-sm text-slate-500">
          {t(lang, 'sessionPurged')}
        </p>
        <p className="mb-8 text-sm text-slate-400">
          {t(lang, 'dataSafelyDeleted')}
        </p>

        <div className="mb-8 w-full space-y-2 rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Session ID</span>
            <span className="font-mono text-slate-400">WIPED</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Documents in memory</span>
            <span className="font-medium text-teal-600">0</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Profile data</span>
            <span className="font-medium text-teal-600">DELETED</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Extracted PII</span>
            <span className="font-medium text-teal-600">ZEROED</span>
          </div>
        </div>

        <button
          onClick={onNewSession}
          className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-teal-600/20 transition-colors hover:bg-teal-700"
        >
          {t(lang, 'startNewSession')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <ShieldCheck className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">
          {t(lang, 'purgeSession')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t(lang, 'ephemeralNotice')}
        </p>
      </div>

      <div className="mb-6 space-y-3 rounded-xl border border-slate-100 bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">{t(lang, 'sessionActive')}</span>
          <span className="flex items-center gap-1 text-sm font-medium text-teal-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
            Active
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">{t(lang, 'dataInMemory')}</span>
          <span className="text-sm font-medium text-slate-700">
            {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">{t(lang, 'zeroRetention')}</span>
          <span className="flex items-center gap-1 text-sm font-medium text-teal-600">
            <Lock className="h-3.5 w-3.5" />
            Enforced
          </span>
        </div>
      </div>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-6 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
        >
          <Trash2 className="h-5 w-5" />
          {t(lang, 'purgeSession')}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <p className="text-sm text-amber-700">
              {t(lang, 'purgeConfirm')}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              {t(lang, 'no')}
            </button>
            <button
              onClick={onPurge}
              className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-red-600/20 transition-colors hover:bg-red-700"
            >
              {t(lang, 'yes')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
