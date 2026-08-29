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
  extractedFields: Record<string, string>;
  confidence: number;
  inconsistencies: string[];
}

export type View = 'onboarding' | 'browse' | 'chat' | 'documents' | 'purge';

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
