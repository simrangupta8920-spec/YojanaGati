import { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Cpu,
  FileWarning,
  Edit2,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { LanguageCode, UserProfile, ExtractedDocumentData, ParsedDocumentFields, ParsedField } from '@/lib/types';
import type { Scholarship } from '@/lib/supabase';
import { t } from '@/lib/i18n';
import { analyzeDocument } from '@/lib/documentAnalysis';
import type { UploadedFile } from '@/hooks/useEphemeralSession';

interface FieldConfig {
  key: keyof ParsedDocumentFields;
  label: string;
}

const AADHAAR_FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Name' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'aadhaarNumberMasked', label: 'Aadhaar Number' },
  { key: 'gender', label: 'Gender' },
  { key: 'address', label: 'Address' },
];

const MARKSHEET_FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Name' },
  { key: 'boardName', label: 'Board / University' },
  { key: 'passYear', label: 'Year of Passing' },
  { key: 'percentage', label: 'Percentage' },
  { key: 'cgpa', label: 'CGPA' },
];

const INCOME_FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Name' },
  { key: 'annualIncome', label: 'Annual Income' },
  { key: 'issuingAuthority', label: 'Issuing Authority' },
  { key: 'issueDate', label: 'Date of Issue' },
];

interface ConsistencyWarning {
  type: 'inter-document' | 'document-profile';
  message: string;
}

interface AutoFillSuggestion {
  profileField: keyof UserProfile;
  label: string;
  newValue: string;
  displayValue: string;
}

function calculateAge(dobStr: string): number | null {
  const match = dobStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const dob = new Date(year, month, day);
    if (!isNaN(dob.getTime())) {
      const ageDifMs = Date.now() - dob.getTime();
      const ageDate = new Date(ageDifMs);
      return Math.abs(ageDate.getUTCFullYear() - 1970);
    }
  }
  return null;
}

function getAutoFillSuggestions(
  file: UploadedFile,
  profile: UserProfile | null,
): AutoFillSuggestion[] {
  const suggestions: AutoFillSuggestion[] = [];
  if (!profile || !file.analysis || !file.analysis.parsedFields) return suggestions;

  const parsed = file.analysis.parsedFields;

  // Name
  if (parsed.name?.value) {
    const val = parsed.name.value.trim();
    if (val.toLowerCase() !== profile.name.trim().toLowerCase()) {
      suggestions.push({
        profileField: 'name',
        label: 'Name',
        newValue: val,
        displayValue: val,
      });
    }
  }

  // Gender
  if (parsed.gender?.value) {
    const val = parsed.gender.value.trim();
    if (val.toLowerCase() !== profile.gender.trim().toLowerCase()) {
      suggestions.push({
        profileField: 'gender',
        label: 'Gender',
        newValue: val,
        displayValue: val,
      });
    }
  }

  // Annual Income
  if (parsed.annualIncome?.value) {
    const rawVal = parsed.annualIncome.value.replace(/[^0-9]/g, '');
    const pVal = profile.income.replace(/[^0-9]/g, '');
    if (rawVal !== pVal) {
      suggestions.push({
        profileField: 'income',
        label: 'Annual Income',
        newValue: rawVal,
        displayValue: parsed.annualIncome.value,
      });
    }
  }

  // Percentage
  if (parsed.percentage?.value) {
    const rawVal = parsed.percentage.value.replace(/[^0-9\.]/g, '');
    const pVal = profile.percentage.replace(/[^0-9\.]/g, '');
    if (rawVal !== pVal) {
      suggestions.push({
        profileField: 'percentage',
        label: 'Percentage',
        newValue: rawVal,
        displayValue: parsed.percentage.value,
      });
    }
  }

  // Age (from DOB)
  if (parsed.dob?.value) {
    const computedAge = calculateAge(parsed.dob.value);
    if (computedAge !== null) {
      const pAge = parseInt(profile.age, 10);
      if (computedAge !== pAge) {
        suggestions.push({
          profileField: 'age',
          label: 'Age',
          newValue: computedAge.toString(),
          displayValue: `${computedAge} years (from DOB ${parsed.dob.value})`,
        });
      }
    }
  }

  return suggestions;
}

function checkConsistency(
  files: UploadedFile[],
  profile: UserProfile | null,
): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = [];
  if (files.length === 0) return warnings;

  const docs = files.filter((f) => f.analysis);

  // 1. Inter-document checks
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const d1 = docs[i];
      const d2 = docs[j];

      // Name comparison
      const name1 = d1.analysis?.parsedFields?.name?.value || d1.analysis?.extractedFields?.['Name'];
      const name2 = d2.analysis?.parsedFields?.name?.value || d2.analysis?.extractedFields?.['Name'];
      if (name1 && name2) {
        const first1 = name1.trim().toLowerCase().split(/\s+/)[0];
        const first2 = name2.trim().toLowerCase().split(/\s+/)[0];
        if (first1 !== first2) {
          warnings.push({
            type: 'inter-document',
            message: `Name mismatch between "${d1.name}" (${name1}) and "${d2.name}" (${name2}).`,
          });
        }
      }

      // DOB comparison
      const dob1 = d1.analysis?.parsedFields?.dob?.value || d1.analysis?.extractedFields?.['Date of Birth'];
      const dob2 = d2.analysis?.parsedFields?.dob?.value || d2.analysis?.extractedFields?.['Date of Birth'];
      if (dob1 && dob2) {
        const cleanDob1 = dob1.trim().replace(/[\-\.]/g, '/');
        const cleanDob2 = dob2.trim().replace(/[\-\.]/g, '/');
        if (cleanDob1 !== cleanDob2) {
          warnings.push({
            type: 'inter-document',
            message: `Date of Birth mismatch between "${d1.name}" (${dob1}) and "${d2.name}" (${dob2}).`,
          });
        }
      }

      // Gender comparison
      const gen1 = d1.analysis?.parsedFields?.gender?.value || d1.analysis?.extractedFields?.['Gender'];
      const gen2 = d2.analysis?.parsedFields?.gender?.value || d2.analysis?.extractedFields?.['Gender'];
      if (gen1 && gen2) {
        if (gen1.trim().toLowerCase() !== gen2.trim().toLowerCase()) {
          warnings.push({
            type: 'inter-document',
            message: `Gender mismatch between "${d1.name}" (${gen1}) and "${d2.name}" (${gen2}).`,
          });
        }
      }
    }
  }

  // 2. Document-vs-Profile checks
  if (profile) {
    docs.forEach((d) => {
      // Profile Name
      const name = d.analysis?.parsedFields?.name?.value || d.analysis?.extractedFields?.['Name'];
      if (name && profile.name) {
        const pFirst = profile.name.trim().toLowerCase().split(/\s+/)[0];
        const dFirst = name.trim().toLowerCase().split(/\s+/)[0];
        if (pFirst !== dFirst) {
          warnings.push({
            type: 'document-profile',
            message: `Name in "${d.name}" (${name}) does not match your profile name (${profile.name}).`,
          });
        }
      }

      // Profile Income (Annual Income)
      const incomeStr = d.analysis?.parsedFields?.annualIncome?.value || d.analysis?.extractedFields?.['Annual Income'];
      if (incomeStr && profile.income) {
        const dIncome = parseInt(incomeStr.replace(/[^0-9]/g, ''), 10);
        const pIncome = parseInt(profile.income.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(dIncome) && !isNaN(pIncome) && Math.abs(dIncome - pIncome) > 100000) {
          warnings.push({
            type: 'document-profile',
            message: `Annual Income in "${d.name}" (${incomeStr}) differs from your profile (₹${pIncome.toLocaleString('en-IN')}).`,
          });
        }
      }

      // Profile Percentage
      const pctStr = d.analysis?.parsedFields?.percentage?.value || d.analysis?.extractedFields?.['Percentage'];
      if (pctStr && profile.percentage) {
        const dPct = parseFloat(pctStr.replace(/[^0-9\.]/g, ''));
        const pPct = parseFloat(profile.percentage.replace(/[^0-9\.]/g, ''));
        if (!isNaN(dPct) && !isNaN(pPct) && Math.abs(dPct - pPct) > 5) {
          warnings.push({
            type: 'document-profile',
            message: `Percentage in "${d.name}" (${pctStr}) differs from your profile (${profile.percentage}%).`,
          });
        }
      }

      // Profile Gender
      const gender = d.analysis?.parsedFields?.gender?.value || d.analysis?.extractedFields?.['Gender'];
      if (gender && profile.gender) {
        if (gender.trim().toLowerCase() !== profile.gender.trim().toLowerCase()) {
          warnings.push({
            type: 'document-profile',
            message: `Gender in "${d.name}" (${gender}) does not match your profile (${profile.gender}).`,
          });
        }
      }

      // Profile Age / Date of Birth check
      const dob = d.analysis?.parsedFields?.dob?.value || d.analysis?.extractedFields?.['Date of Birth'];
      if (dob && profile.age) {
        const computedAge = calculateAge(dob);
        const pAge = parseInt(profile.age, 10);
        if (computedAge !== null && !isNaN(pAge) && Math.abs(computedAge - pAge) > 1) {
          warnings.push({
            type: 'document-profile',
            message: `DOB in "${d.name}" (${dob}) suggests age ${computedAge}, but your profile states ${pAge}.`,
          });
        }
      }
    });
  }

  return warnings;
}

interface DocumentsViewProps {
  lang: LanguageCode;
  profile: UserProfile | null;
  scholarships: Scholarship[];
  uploadedFiles: UploadedFile[];
  onAddFile: (file: UploadedFile) => void;
  onRemoveFile: (fileId: string) => void;
  onUpdateFileAnalysis: (fileId: string, analysis: ExtractedDocumentData) => void;
  onUpdateParsedField: (
    fileId: string,
    fieldKey: keyof ParsedDocumentFields,
    value: string,
    scholarships: Scholarship[],
  ) => void;
  onUpdateProfile: (profile: UserProfile) => void;
}

/**
 * Per-file OCR progress state.
 * `null`  → not yet analysing
 * 0–100   → actively running OCR (progress %)
 * -1      → done / cleared
 */
type OcrProgressMap = Record<string, number | null>;

export function DocumentsView({
  lang,
  profile,
  scholarships,
  uploadedFiles,
  onAddFile,
  onRemoveFile,
  onUpdateFileAnalysis,
  onUpdateParsedField,
  onUpdateProfile,
}: DocumentsViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  /** Which file ID is currently being analysed (drives the progress UI). */
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  /** Per-file OCR progress, 0–100. */
  const [ocrProgress, setOcrProgress] = useState<OcrProgressMap>({});
  const [editingField, setEditingField] = useState<{ fileId: string; fieldKey: keyof ParsedDocumentFields } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const consistencyWarnings = checkConsistency(uploadedFiles, profile);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const fileId = crypto.randomUUID();
      const reader = new FileReader();
      reader.onload = async (e) => {
        // dataUrl is string | null to match UploadedFile; FileReader always
        // produces a string here, but we type it correctly for purge safety.
        const dataUrl = (e.target?.result as string) ?? null;
        const uploadedFile: UploadedFile = {
          id: fileId,
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
        };
        onAddFile(uploadedFile);
        setAnalyzingId(fileId);
        setOcrProgress((prev) => ({ ...prev, [fileId]: 0 }));

        try {
          const analysis = await analyzeDocument(
            file.name,
            file.size,
            profile ?? undefined,
            scholarships,
            dataUrl,
            // Progress callback: drives the per-file progress bar
            (percent) =>
              setOcrProgress((prev) => ({ ...prev, [fileId]: percent })),
          );
          onUpdateFileAnalysis(fileId, analysis);
        } catch (err) {
          console.error('[YG OCR] Analysis error:', err);
        } finally {
          setAnalyzingId(null);
          // Keep progress at 100 briefly so the bar completes visually,
          // then clear it so the completed analysis panel takes over.
          setTimeout(
            () => setOcrProgress((prev) => ({ ...prev, [fileId]: -1 })),
            400,
          );
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

      {/* Privacy notice */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
        <Lock className="h-5 w-5 flex-shrink-0 text-teal-600" />
        <p className="text-sm text-teal-700">{t(lang, 'ephemeralNotice')}</p>
      </div>

      {/* Drop zone */}
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

      {/* ── Cross-document/profile consistency warnings ──────────── */}
      {consistencyWarnings.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">
              Document Consistency Warnings
            </h3>
          </div>
          <p className="text-xs text-amber-700 mb-2">
            We detected conflicts between your uploaded files and manually-entered profile:
          </p>
          <ul className="space-y-1 list-disc pl-5 text-xs text-amber-600">
            {consistencyWarnings.map((warn, index) => (
              <li key={index}>{warn.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* File cards */}
      {uploadedFiles.length > 0 && (
        <div className="mt-6 space-y-4">
          {uploadedFiles.map((file) => {
            const progress = ocrProgress[file.id];
            const isAnalysing = analyzingId === file.id;

            return (
              <div
                key={file.id}
                className="overflow-hidden rounded-2xl border-2 border-slate-100 bg-white shadow-sm"
              >
                {/* ── File header ──────────────────────────────────────── */}
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
                    disabled={isAnalysing}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t(lang, 'removeDocument')}
                  </button>
                </div>

                {/* ── OCR progress bar ─────────────────────────────────── */}
                {isAnalysing && typeof progress === 'number' && progress >= 0 && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <Cpu className="h-3.5 w-3.5 animate-pulse text-teal-600" />
                        {progress < 20
                          ? 'Loading OCR engine…'
                          : progress < 45
                          ? 'Loading language model…'
                          : 'Reading document…'}
                        <span className="ml-1 flex items-center gap-0.5 text-teal-600">
                          <Lock className="h-3 w-3" />
                          {t(lang, 'processingEphemeral')}
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-teal-700">
                        {progress}%
                      </span>
                    </div>
                    {/* Segmented progress bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">
                      OCR runs entirely in your browser — no data is uploaded.
                    </p>
                  </div>
                )}

                {/* ── Analysis results ─────────────────────────────────── */}
                {file.analysis && (() => {
                  const docType = file.analysis.documentType;
                  let configFields: FieldConfig[] | null = null;
                  if (docType === 'Aadhaar Card') configFields = AADHAAR_FIELDS;
                  else if (docType === 'Mark Sheet') configFields = MARKSHEET_FIELDS;
                  else if (docType === 'Income Certificate') configFields = INCOME_FIELDS;

                  const parsedFields = file.analysis.parsedFields;
                  const needsReviewCount = parsedFields && configFields
                    ? configFields.filter((cfg) => parsedFields[cfg.key]?.needs_manual_review).length
                    : 0;

                  return (
                    <div className="border-t border-slate-100 p-4">
                      {/* Header row: title + confidence badge */}
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-5 w-5 text-teal-600" />
                          <span className="text-sm font-semibold text-slate-700">
                            {t(lang, 'analysisComplete')}
                          </span>
                          {needsReviewCount > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 animate-pulse">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Review needed ({needsReviewCount})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* OCR badge */}
                          {file.analysis.ocrPerformed ? (
                            <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                              <Cpu className="h-3 w-3" />
                              Live OCR
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              <FileWarning className="h-3 w-3" />
                              PDF — no OCR
                            </span>
                          )}
                          {/* Confidence badge (only meaningful when OCR ran) */}
                          {file.analysis.ocrPerformed && (
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                file.analysis.confidence > 0.7
                                  ? 'bg-teal-100 text-teal-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {t(lang, 'confidenceLevel')}:{' '}
                              {Math.round(file.analysis.confidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Document type */}
                      <div className="mb-3">
                        <span className="text-xs font-medium text-slate-400">
                          {t(lang, 'documentType')}:
                        </span>
                        <span className="ml-2 text-sm font-medium text-slate-700">
                          {file.analysis.documentType}
                        </span>
                      </div>

                      {/* Auto-fill suggestions */}
                      {(() => {
                        const suggestions = getAutoFillSuggestions(file, profile);
                        const activeSuggestions = suggestions.filter(
                          (sug) => !rejectedSuggestions[`${file.id}-${sug.profileField}`],
                        );

                        if (activeSuggestions.length === 0) return null;

                        return (
                          <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/80 p-3.5">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="h-4 w-4 text-teal-600 animate-pulse" />
                              <h4 className="text-xs font-bold text-teal-800">
                                Profile Auto-fill Suggestions
                              </h4>
                            </div>
                            <p className="text-xs text-teal-700 mb-2.5">
                              This document contains verified details that differ from your current profile. Would you like to update your profile?
                            </p>
                            <div className="space-y-1.5">
                              {activeSuggestions.map((sug) => (
                                <div
                                  key={sug.profileField}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-white border border-teal-100 p-2 shadow-sm"
                                >
                                  <div className="text-xs text-slate-700">
                                    <span className="font-semibold text-slate-500">{sug.label}: </span>
                                    <span className="text-slate-400 line-through mr-1.5">
                                      {profile ? profile[sug.profileField] : 'None'}
                                    </span>
                                    <span className="font-semibold text-teal-700">
                                      → {sug.displayValue}
                                    </span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        if (profile) {
                                          onUpdateProfile({
                                            ...profile,
                                            [sug.profileField]: sug.newValue,
                                          });
                                        }
                                      }}
                                      className="px-2 py-0.5 rounded bg-teal-600 text-white font-semibold text-xs hover:bg-teal-700 transition-colors shadow-sm"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRejectedSuggestions((prev) => ({
                                          ...prev,
                                          [`${file.id}-${sug.profileField}`]: true,
                                        }));
                                      }}
                                      className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-xs hover:bg-slate-200 transition-colors"
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Extracted/Structured fields */}
                      <div className="mb-3 rounded-lg bg-slate-50 p-3">
                        <p className="mb-2 text-xs font-medium text-slate-400">
                          {t(lang, 'extractedData')}:
                        </p>
                        {configFields && parsedFields ? (
                          <div className="space-y-2">
                            {configFields.map((cfg) => {
                              const fieldVal = parsedFields[cfg.key] as ParsedField | undefined;
                              const isEditing = editingField?.fileId === file.id && editingField?.fieldKey === cfg.key;
                              
                              if (!fieldVal) return null;

                              return (
                                <div
                                  key={cfg.key}
                                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-md p-1.5 transition-colors ${
                                    fieldVal.needs_manual_review
                                      ? 'bg-amber-50/70 border border-dashed border-amber-200'
                                      : 'hover:bg-slate-100/50'
                                  }`}
                                >
                                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                                    {cfg.label}
                                    {fieldVal.needs_manual_review && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100/60 rounded px-1">
                                        <AlertCircle className="h-2.5 w-2.5" />
                                        Verify
                                      </span>
                                    )}
                                    {fieldVal.manually_reviewed && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-100/60 rounded px-1">
                                        <Check className="h-2.5 w-2.5" />
                                        Verified
                                      </span>
                                    )}
                                  </span>

                                  {isEditing ? (
                                    <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                                      <input
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            onUpdateParsedField(file.id, cfg.key, editValue, scholarships);
                                            setEditingField(null);
                                          } else if (e.key === 'Escape') {
                                            setEditingField(null);
                                          }
                                        }}
                                        className="rounded border border-teal-300 px-2 py-0.5 text-xs text-slate-700 focus:border-teal-500 focus:outline-none bg-white min-w-[120px] sm:min-w-[180px]"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => {
                                          onUpdateParsedField(file.id, cfg.key, editValue, scholarships);
                                          setEditingField(null);
                                        }}
                                        className="p-1 rounded bg-teal-600 text-white hover:bg-teal-700"
                                        title="Save"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setEditingField(null)}
                                        className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
                                        title="Cancel"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 group mt-1 sm:mt-0">
                                      <span
                                        onClick={() => {
                                          setEditingField({ fileId: file.id, fieldKey: cfg.key });
                                          setEditValue(fieldVal.value || '');
                                        }}
                                        className={`text-sm font-medium cursor-pointer transition-colors ${
                                          fieldVal.value
                                            ? 'text-slate-700 hover:text-teal-600'
                                            : 'text-red-500 hover:text-red-600 italic'
                                        }`}
                                      >
                                        {fieldVal.value || 'Needs manual entry'}
                                      </span>
                                      <button
                                        onClick={() => {
                                          setEditingField({ fileId: file.id, fieldKey: cfg.key });
                                          setEditValue(fieldVal.value || '');
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-teal-600 rounded"
                                        title="Edit field"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                            {Object.entries(file.analysis.extractedFields).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="flex items-start justify-between gap-2 text-sm"
                                >
                                  <span className="shrink-0 text-slate-500">{key}:</span>
                                  <span className="text-right font-medium text-slate-700">
                                    {value}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </div>

                      {/* Inconsistencies / all-clear */}
                    {file.analysis.inconsistencies.length > 0 ? (
                      <div className="rounded-lg bg-amber-50 p-3">
                        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-amber-700">
                          <AlertTriangle className="h-4 w-4" />
                          {t(lang, 'inconsistenciesFound')}
                        </p>
                        <ul className="space-y-1">
                          {file.analysis.inconsistencies.map((inc, i) => (
                            <li key={i} className="text-xs text-amber-600">
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

                    {/* Raw OCR text (collapsible, dev/power-user aid) */}
                    {file.analysis.ocrPerformed && file.analysis.rawText && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600">
                          Raw OCR text
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
                          {file.analysis.rawText}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })()}
              </div>
            );
          })}
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
