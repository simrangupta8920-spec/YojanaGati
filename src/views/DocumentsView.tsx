import { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { Scholarship, LanguageCode, UserProfile, ExtractedDocumentData } from '@/lib/types';
import { t } from '@/lib/i18n';
import { analyzeDocument } from '@/lib/documentAnalysis';
import type { UploadedFile } from '@/hooks/useEphemeralSession';

interface DocumentsViewProps {
  lang: LanguageCode;
  profile: UserProfile | null;
  scholarships: Scholarship[];
  uploadedFiles: UploadedFile[];
  onAddFile: (file: UploadedFile) => void;
  onRemoveFile: (fileId: string) => void;
  onUpdateFileAnalysis: (fileId: string, analysis: ExtractedDocumentData) => void;
}

export function DocumentsView({
  lang,
  profile,
  scholarships,
  uploadedFiles,
  onAddFile,
  onRemoveFile,
  onUpdateFileAnalysis,
}: DocumentsViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const fileId = crypto.randomUUID();
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        const uploadedFile: UploadedFile = {
          id: fileId,
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
        };
        onAddFile(uploadedFile);
        setAnalyzingId(fileId);

        try {
          const analysis = await analyzeDocument(
            file.name,
            file.size,
            profile ?? undefined,
            scholarships,
          );
          onUpdateFileAnalysis(fileId, analysis);
        } catch {
          // ignore analysis errors
        } finally {
          setAnalyzingId(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <FileText className="h-6 w-6 text-teal-600" />
          {t(lang, 'uploadDocuments')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t(lang, 'uploadInstructions')}
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
        <Lock className="h-5 w-5 flex-shrink-0 text-teal-600" />
        <p className="text-sm text-teal-700">{t(lang, 'ephemeralNotice')}</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          isDragging
            ? 'border-teal-500 bg-teal-50'
            : 'border-slate-300 bg-white hover:border-teal-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <Upload className="mx-auto mb-3 h-10 w-10 text-teal-500" />
        <p className="text-sm font-medium text-slate-700">
          {t(lang, 'dragDrop')}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {t(lang, 'documentTypes')}
        </p>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-6 space-y-4">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="overflow-hidden rounded-2xl border-2 border-slate-100 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                    <FileText className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveFile(file.id)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                >
                  <X className="h-3.5 w-3.5" />
                  {t(lang, 'removeDocument')}
                </button>
              </div>

              {analyzingId === file.id && (
                <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                  {t(lang, 'analyzing')}
                  <span className="ml-1 flex items-center gap-1 text-xs text-teal-600">
                    <Lock className="h-3 w-3" />
                    {t(lang, 'processingEphemeral')}
                  </span>
                </div>
              )}

              {file.analysis && (
                <div className="border-t border-slate-100 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-teal-600" />
                      <span className="text-sm font-semibold text-slate-700">
                        {t(lang, 'analysisComplete')}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        file.analysis.confidence > 0.85
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {t(lang, 'confidenceLevel')}: {Math.round(file.analysis.confidence * 100)}%
                    </span>
                  </div>

                  <div className="mb-3">
                    <span className="text-xs font-medium text-slate-400">
                      {t(lang, 'documentType')}:
                    </span>
                    <span className="ml-2 text-sm font-medium text-slate-700">
                      {file.analysis.documentType}
                    </span>
                  </div>

                  <div className="mb-3 rounded-lg bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-medium text-slate-400">
                      {t(lang, 'extractedData')}:
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {Object.entries(file.analysis.extractedFields).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-slate-500">{key}:</span>
                            <span className="font-medium text-slate-700">
                              {value}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  {file.analysis.inconsistencies.length > 0 ? (
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                        {t(lang, 'inconsistenciesFound')}
                      </p>
                      <ul className="space-y-1">
                        {file.analysis.inconsistencies.map((inc, i) => (
                          <li
                            key={i}
                            className="text-xs text-amber-600"
                          >
                            • {inc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-lg bg-teal-50 p-3 text-sm text-teal-700">
                      <CheckCircle2 className="h-4 w-4" />
                      {t(lang, 'noInconsistencies')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {uploadedFiles.length === 0 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Lock className="h-4 w-4" />
          {t(lang, 'zeroRetention')} • {t(lang, 'privacyFirst')}
        </div>
      )}
    </div>
  );
}
