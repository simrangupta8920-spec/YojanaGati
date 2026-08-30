export type LanguageCode = 'en' | 'hi' | 'pa' | 'bn' | 'ta' | 'te' | 'mr';

export interface LanguageInfo {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: 'EN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: 'HI' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', flag: 'PA' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', flag: 'BN' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', flag: 'TA' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', flag: 'TE' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', flag: 'MR' },
];

export interface UserProfile {
  name: string;
  age: string;
  educationLevel: string;
  state: string;
  category: string;
  income: string;
  percentage: string;
  gender: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  scholarshipRefs?: string[];
}

export interface ExtractedDocumentData {
  documentType: string;
  /**
   * Flat key→value map kept for backward compatibility with checkEligibility()
   * and the RAG layer. Populated from parsedFields when available.
   */
  extractedFields: Record<string, string>;
  /**
   * OCR confidence, 0–1. Tesseract's mean character-level confidence / 100.
   */
  confidence: number;
  inconsistencies: string[];
  /**
   * Verbatim OCR text, sanitized so Aadhaar numbers are already masked
   * (XXXX-XXXX-LAST4) before this string enters state.
   * Undefined for PDFs and non-image files.
   */
  rawText?: string;
  /** True when Tesseract OCR actually ran; false for PDF/filename-only path. */
  ocrPerformed: boolean;
  /**
   * Structured per-field parse result. Present only for the three supported
   * document types: Aadhaar Card, Mark Sheet, Income Certificate.
   * Undefined for other doc types (use extractedFields instead).
   */
  parsedFields?: ParsedDocumentFields;
}

// ─── Structured field types ───────────────────────────────────────────────────

/** Extraction confidence level for a single parsed field. */
export type FieldConfidence = 'high' | 'medium' | 'low' | 'none';

/**
 * A single structured field extracted from OCR text.
 * `value` is null when the pattern did not match.
 * `needs_manual_review` is true when value is null or confidence is low/none.
 * `manually_reviewed` is set to true when the user corrects the value inline.
 */
export interface ParsedField {
  value: string | null;
  confidence: FieldConfidence;
  /**
   * True → the field should be highlighted in the UI so the user can
   * verify or fill in the value. Cleared when manually_reviewed is set.
   */
  needs_manual_review: boolean;
  /** True once the user has accepted or corrected this field inline. */
  manually_reviewed: boolean;
}

/**
 * Typed slots for the three supported document types.
 * Only the relevant subset of fields is populated for each type.
 */
export interface ParsedDocumentFields {
  // ── Aadhaar Card ─────────────────────────────────────────────────────────
  /** Cardholder's full name as printed. */
  name?: ParsedField;
  /** Date of birth in DD/MM/YYYY. */
  dob?: ParsedField;
  /**
   * Aadhaar number, permanently masked to XXXX-XXXX-LAST4.
   * The raw 12-digit number is masked at parse time — before it ever
   * enters React state — and never stored unmasked anywhere in the app.
   */
  aadhaarNumberMasked?: ParsedField;
  /** Residential address. */
  address?: ParsedField;
  /** Gender as printed on the card. */
  gender?: ParsedField;

  // ── Mark Sheet ───────────────────────────────────────────────────────────
  /** Examining board or university name. */
  boardName?: ParsedField;
  /** Year of passing (4-digit). */
  passYear?: ParsedField;
  /** Percentage, e.g. "94.4%". */
  percentage?: ParsedField;
  /** CGPA on a 10-point scale, e.g. "8.6/10". */
  cgpa?: ParsedField;

  // ── Income Certificate ───────────────────────────────────────────────────
  /** Annual family income formatted as ₹XX,XX,XXX. */
  annualIncome?: ParsedField;
  /** Name/designation of the issuing government authority. */
  issuingAuthority?: ParsedField;
  /** Date of issue in DD/MM/YYYY. */
  issueDate?: ParsedField;
}


export type View = 'onboarding' | 'browse' | 'chat' | 'documents' | 'purge' | 'profile';

export const EDUCATION_LEVELS = [
  'School (Class 1-10)',
  'School (Class 11-12)',
  'Undergraduate',
  'Postgraduate',
  'Diploma',
  'Any',
];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab',
  'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Other',
];

export const CATEGORIES = [
  'General', 'SC', 'ST', 'OBC', 'EBC', 'Minority', 'Differently-Abled',
];
