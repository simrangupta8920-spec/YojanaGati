/**
 * documentAnalysis.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side document OCR, Aadhaar masking, and structured field extraction.
 *
 * PRIVACY GUARANTEE
 * ─────────────────
 * • Tesseract.js runs OCR entirely inside a browser Web Worker via WASM.
 *   The image bytes (dataUrl) are transferred to the worker via structured
 *   clone — they NEVER leave the browser process.
 * • Aadhaar numbers are masked to XXXX-XXXX-LAST4 before the OCR text is
 *   stored in any React state or returned from this function. The raw 12-digit
 *   number is held in a JS local variable only for the duration of the mask
 *   operation and is never assigned to any exported object.
 * • The only external network traffic: one-time CDN download of the Tesseract
 *   WASM core (~3 MB) and 'eng' language model (~9 MB). Both are cached. No
 *   user image data or text is included in these requests.
 *
 * PDF handling
 * ────────────
 * Tesseract.js processes raster images only. PDFs fall back to filename-based
 * heuristics with ocrPerformed=false so the UI can inform the user.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createWorker } from 'tesseract.js';
import type {
  ExtractedDocumentData,
  UserProfile,
  FieldConfidence,
  ParsedField,
  ParsedDocumentFields,
} from '@/lib/types';
import type { Scholarship } from '@/lib/supabase';

// ─── OCR progress phases ──────────────────────────────────────────────────────

const PHASE_WEIGHT: Record<string, { start: number; end: number }> = {
  'loading tesseract core':       { start: 0,  end: 15 },
  'initializing tesseract':       { start: 15, end: 20 },
  'loading language traineddata': { start: 20, end: 40 },
  'initializing api':             { start: 40, end: 45 },
  'recognizing text':             { start: 45, end: 100 },
};

function phaseProgress(status: string, progress: number): number {
  const phase = PHASE_WEIGHT[status];
  if (!phase) return 0;
  return Math.round(phase.start + progress * (phase.end - phase.start));
}

// ─── Tesseract OCR ────────────────────────────────────────────────────────────

interface OcrResult {
  text: string;
  confidence: number; // 0–100 from Tesseract
}

async function performOCR(
  dataUrl: string,
  onProgress?: (percent: number) => void,
): Promise<OcrResult> {
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      onProgress?.(phaseProgress(m.status, m.progress ?? 0));
    },
  });
  try {
    const { data } = await worker.recognize(dataUrl);
    return { text: data.text ?? '', confidence: data.confidence ?? 0 };
  } finally {
    await worker.terminate();
  }
}

// ─── Aadhaar masking ──────────────────────────────────────────────────────────
// Applied to the raw OCR text BEFORE it is stored anywhere.
// The 12-digit number is held only in a regex capture group; after this
// function returns, the full number no longer exists in any variable.

const AADHAAR_RE = /\b(\d{4})\s*(\d{4})\s*(\d{4})\b/g;

/**
 * Replace every 12-digit Aadhaar sequence in `text` with XXXX-XXXX-LAST4.
 * Returns { sanitizedText, maskedValue } where maskedValue is the first match
 * (or null if none found) — used to populate parsedFields.aadhaarNumberMasked.
 */
function sanitizeAndExtractAadhaar(text: string): {
  sanitizedText: string;
  maskedValue: string | null;
} {
  let maskedValue: string | null = null;
  const sanitizedText = text.replace(AADHAAR_RE, (_match, _g1, _g2, g3: string) => {
    const masked = `XXXX-XXXX-${g3}`;
    if (maskedValue === null) maskedValue = masked; // capture first occurrence only
    return masked;
  });
  return { sanitizedText, maskedValue };
}

// ─── Document type detection ──────────────────────────────────────────────────

function detectTypeFromText(text: string): string | null {
  const u = text.toUpperCase();
  if (u.includes('AADHAAR') || u.includes('AADHAR') || u.includes('UNIQUE IDENTIFICATION AUTHORITY'))
    return 'Aadhaar Card';
  if (u.includes('INCOME CERTIFICATE') || (u.includes('ANNUAL INCOME') && u.includes('CERTIFICATE')))
    return 'Income Certificate';
  if (
    u.includes('MARK SHEET') || u.includes('MARKSHEET') ||
    (u.includes('MARKS OBTAINED') && (u.includes('BOARD') || u.includes('UNIVERSITY'))) ||
    (u.includes('PERCENTAGE') && (u.includes('CBSE') || u.includes('ICSE') || u.includes('STATE BOARD')))
  )
    return 'Mark Sheet';
  if (u.includes('CASTE CERTIFICATE') || (u.includes('CASTE') && u.includes('CERTIFY')))
    return 'Caste Certificate';
  if (u.includes('DOMICILE') || u.includes('RESIDENCE CERTIFICATE'))
    return 'Domicile Certificate';
  if (u.includes('DISABILITY CERTIFICATE') || u.includes('PERSON WITH DISABILITY'))
    return 'Disability Certificate';
  return null;
}

function detectTypeFromFilename(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('aadhaar') || lower.includes('aadhar') || lower.includes('uid'))
    return 'Aadhaar Card';
  if (lower.includes('income') || lower.includes('salary'))
    return 'Income Certificate';
  if (lower.includes('mark') || lower.includes('result') || lower.includes('score'))
    return 'Mark Sheet';
  if (lower.includes('caste') || lower.includes('category'))
    return 'Caste Certificate';
  if (lower.includes('domicile') || lower.includes('residence'))
    return 'Domicile Certificate';
  if (lower.includes('disability'))
    return 'Disability Certificate';
  return 'Identity Document';
}

// ─── ParsedField constructor helper ──────────────────────────────────────────

function pf(value: string | null, confidence: FieldConfidence): ParsedField {
  return {
    value,
    confidence,
    needs_manual_review: value === null || confidence === 'low' || confidence === 'none',
    manually_reviewed: false,
  };
}

// ─── Per-doc-type field parsers ───────────────────────────────────────────────
// Each parser returns a ParsedField. Patterns are ordered from most-specific
// (HIGH confidence) to most-permissive (LOW confidence) so that the first
// match is always the best available result.

// ── Shared ──────────────────────────────────────────────────────────────────

function parseName(text: string): ParsedField {
  // Labeled "Name:" with a Proper Case or ALLCAPS value (HIGH)
  const labeled = text.match(
    /(?:^|\n)\s*(?:name|applicant name|student name|holder name)\s*[:\-]\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]*){1,5})/im,
  );
  if (labeled) return pf(labeled[1].trim(), 'high');

  // All-caps name on its own line — common Aadhaar OCR output (MEDIUM)
  const capsLine = text.match(/^([A-Z]{2,}(?:\s+[A-Z]{2,}){1,4})$/m);
  if (capsLine) return pf(capsLine[1].trim(), 'medium');

  return pf(null, 'none');
}

function parseDOB(text: string): ParsedField {
  // Labeled (HIGH)
  const labeled = text.match(
    /(?:date of birth|d\.?o\.?b\.?|dob|born on|janm tithi|जन्म)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  );
  if (labeled) return pf(labeled[1], 'high');

  // Bare DD/MM/YYYY (LOW — ambiguous without label)
  const bare = text.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/);
  if (bare) return pf(bare[1], 'low');

  return pf(null, 'none');
}

function parseGender(text: string): ParsedField {
  const match = text.match(/\b(MALE|FEMALE|TRANSGENDER)\b/i);
  if (!match) return pf(null, 'none');
  const g = match[1];
  return pf(g.charAt(0).toUpperCase() + g.slice(1).toLowerCase(), 'high');
}

function parseAadhaarAddress(text: string): ParsedField {
  // After an address-prefix keyword; stop at a double-newline or PIN
  const match = text.match(
    /(?:address|s\/o|w\/o|d\/o|c\/o|house no|flat no)\s*[:\-]?\s*(.{15,150}?)(?:\n\n|\nPIN|\npin|$)/is,
  );
  if (match) return pf(match[1].trim().replace(/\n/g, ', '), 'medium');
  return pf(null, 'none');
}

// ── Mark Sheet ───────────────────────────────────────────────────────────────

const KNOWN_BOARDS = [
  'CBSE', 'ICSE', 'ISC', 'NIOS', 'IGNOU',
  'UP BOARD', 'UPMSP', 'MAHARASHTRA BOARD', 'MSBSHSE', 'GSEB',
  'RBSE', 'HBSE', 'PSEB', 'WBCHSE', 'TSBSE', 'BSEAP', 'AP BOARD',
  'KSEEB', 'TNBSE', 'MPBSE', 'CGBSE', 'BSEB', 'JAC', 'BSEH',
  'JKBOSE', 'AHSEC', 'NBSE', 'TBSE',
];

function parseBoardName(text: string): ParsedField {
  const upper = text.toUpperCase();
  // Exact acronym match (HIGH)
  for (const board of KNOWN_BOARDS) {
    if (upper.includes(board)) return pf(board, 'high');
  }
  // "Board of Secondary Education, <State>" pattern (MEDIUM)
  const boardPhrase = text.match(
    /(?:board of|council of)\s+(?:secondary|higher secondary|intermediate|senior secondary)\s+(?:education|examination)[\s,]*([A-Za-z\s]{2,40}?)(?:\n|,|$)/i,
  );
  if (boardPhrase) return pf(boardPhrase[0].trim(), 'medium');
  // University name (MEDIUM)
  const uni = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+University)/);
  if (uni) return pf(uni[1], 'medium');

  return pf(null, 'none');
}

function parsePassYear(text: string): ParsedField {
  // Labeled (HIGH)
  const labeled = text.match(
    /(?:year of passing|pass year|year of examination|annual examination|session)\s*[:\-]?\s*(20[0-2]\d(?:\s*[-–]\s*20[0-2]\d)?)/i,
  );
  if (labeled) return pf(labeled[1].trim(), 'high');

  // Bare 4-digit year 2000-2029 (LOW)
  const bare = text.match(/\b(20[0-2]\d)\b/);
  if (bare) return pf(bare[1], 'low');

  return pf(null, 'none');
}

function parsePercentage(text: string): ParsedField {
  // Labeled percentage (HIGH)
  const labeled = text.match(
    /(?:percentage|percent|marks percentage|aggregate percentage|overall percentage)\s*[:\-]?\s*(\d{1,3}(?:\.\d{1,2})?)\s*%?/i,
  );
  if (labeled) return pf(`${labeled[1]}%`, 'high');

  // "X out of Y" → compute (MEDIUM)
  const fraction = text.match(/(\d{3,4})\s*(?:\/|out of)\s*(\d{3,4})/);
  if (fraction) {
    const obtained = parseInt(fraction[1], 10);
    const total = parseInt(fraction[2], 10);
    if (total > 0 && obtained <= total) {
      return pf(`${((obtained / total) * 100).toFixed(2)}%`, 'medium');
    }
  }

  // Bare "XX%" (LOW — might be a sub-score)
  const bare = text.match(/\b(\d{2,3}(?:\.\d{1,2})?)\s*%/);
  if (bare) return pf(`${bare[1]}%`, 'low');

  return pf(null, 'none');
}

function parseCGPA(text: string): ParsedField {
  // "CGPA X.X out of 10" (HIGH)
  const labeled = text.match(
    /(?:CGPA|GPA|grade point average|grade point)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:out of|\/)\s*10/i,
  );
  if (labeled) return pf(`${labeled[1]}/10`, 'high');

  // "CGPA: X.X" (MEDIUM)
  const bare = text.match(/(?:CGPA|GPA)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)/i);
  if (bare) return pf(bare[1], 'medium');

  return pf(null, 'none');
}

// ── Income Certificate ───────────────────────────────────────────────────────

function parseAnnualIncome(text: string): ParsedField {
  // Labeled (HIGH)
  const labeled = text.match(
    /(?:annual income|total annual income|annual family income|yearly income|income)\s*[:\-\s]+(?:rs\.?|₹|inr)?\s*([\d,]+(?:\.\d{2})?)/i,
  );
  if (labeled) {
    const num = parseInt(labeled[1].replace(/,/g, ''), 10);
    if (!isNaN(num)) return pf(`₹${num.toLocaleString('en-IN')}`, 'high');
  }
  // Currency symbol + amount (MEDIUM)
  const currency = text.match(/(?:rs\.?|₹|inr)\s*([\d,]+)/i);
  if (currency) {
    const num = parseInt(currency[1].replace(/,/g, ''), 10);
    if (!isNaN(num)) return pf(`₹${num.toLocaleString('en-IN')}`, 'medium');
  }
  return pf(null, 'none');
}

const KNOWN_DESIGNATIONS = [
  'Tehsildar', 'Naib Tehsildar', 'Sub Divisional Magistrate', 'SDM',
  'District Collector', 'District Magistrate', 'Deputy Commissioner',
  'Block Development Officer', 'BDO', 'Revenue Officer', 'Patwari',
  'Mamlatdar', 'Circle Officer', 'Additional Collector', 'Gram Panchayat',
];

function parseIssuingAuthority(text: string): ParsedField {
  // Known government designations (HIGH)
  for (const desig of KNOWN_DESIGNATIONS) {
    if (text.toLowerCase().includes(desig.toLowerCase()))
      return pf(desig, 'high');
  }
  // Labeled "Issued by:" (MEDIUM)
  const labeled = text.match(
    /(?:issued by|issuing authority|authority|signed by|certifying officer)\s*[:\-]?\s*(.{5,80}?)(?:\n|$)/i,
  );
  if (labeled) return pf(labeled[1].trim(), 'medium');

  return pf(null, 'none');
}

function parseIssueDate(text: string): ParsedField {
  // Labeled (HIGH)
  const labeled = text.match(
    /(?:date of issue|date of certificate|issued on|issue date)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  );
  if (labeled) return pf(labeled[1], 'high');

  // Generic date label (MEDIUM)
  const generic = text.match(
    /(?:^|\n)\s*date\s*[:\-]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/im,
  );
  if (generic) return pf(generic[1], 'medium');

  // Bare date (LOW)
  const bare = text.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);
  if (bare) return pf(bare[1], 'low');

  return pf(null, 'none');
}

// ─── Top-level structured parser ──────────────────────────────────────────────

/**
 * Parse a sanitized OCR text string into a strongly-typed ParsedDocumentFields
 * object for the three supported doc types.
 *
 * @param text         - OCR text with Aadhaar numbers already masked.
 * @param docType      - Document type string (e.g. 'Aadhaar Card').
 * @param maskedAadhaar - Pre-extracted masked Aadhaar value (XXXX-XXXX-LAST4)
 *                        or null if none was found in the original text.
 */
function parseFieldsFromText(
  text: string,
  docType: string,
  maskedAadhaar: string | null,
): ParsedDocumentFields {
  switch (docType) {
    case 'Aadhaar Card':
      return {
        name:               parseName(text),
        dob:                parseDOB(text),
        aadhaarNumberMasked: pf(maskedAadhaar, maskedAadhaar ? 'high' : 'none'),
        gender:             parseGender(text),
        address:            parseAadhaarAddress(text),
      };

    case 'Mark Sheet':
      return {
        name:      parseName(text),
        boardName: parseBoardName(text),
        passYear:  parsePassYear(text),
        percentage: parsePercentage(text),
        cgpa:      parseCGPA(text),
      };

    case 'Income Certificate':
      return {
        name:              parseName(text),
        annualIncome:      parseAnnualIncome(text),
        issuingAuthority:  parseIssuingAuthority(text),
        issueDate:         parseIssueDate(text),
      };

    default:
      return {};
  }
}

// ─── Flat extractedFields builder ────────────────────────────────────────────
// Converts ParsedDocumentFields back to Record<string, string> for backward
// compatibility with checkEligibility() and any future RAG consumers.
// Exported so useEphemeralSession can re-sync after an inline user edit.

export function buildExtractedFields(
  parsed: ParsedDocumentFields,
): Record<string, string> {
  const f: Record<string, string> = {};
  if (parsed.name?.value)               f['Name'] = parsed.name.value;
  if (parsed.dob?.value)                f['Date of Birth'] = parsed.dob.value;
  if (parsed.aadhaarNumberMasked?.value) f['Aadhaar Number'] = parsed.aadhaarNumberMasked.value;
  if (parsed.address?.value)            f['Address'] = parsed.address.value;
  if (parsed.gender?.value)             f['Gender'] = parsed.gender.value;
  if (parsed.boardName?.value)          f['Board / University'] = parsed.boardName.value;
  if (parsed.passYear?.value)           f['Year of Passing'] = parsed.passYear.value;
  if (parsed.percentage?.value)         f['Percentage'] = parsed.percentage.value;
  if (parsed.cgpa?.value)               f['CGPA'] = parsed.cgpa.value;
  if (parsed.annualIncome?.value)       f['Annual Income'] = parsed.annualIncome.value;
  if (parsed.issuingAuthority?.value)   f['Issuing Authority'] = parsed.issuingAuthority.value;
  if (parsed.issueDate?.value)          f['Date of Issue'] = parsed.issueDate.value;
  return f;
}

// ─── Legacy field extraction for non-OCR doc types ──────────────────────────
// Used for Caste / Domicile / Disability Certificate and Identity Document
// when parsedFields is not populated.

function extractLegacyFields(text: string, docType: string): Record<string, string> {
  const fields: Record<string, string> = {};

  const nameMatch = text.match(/(?:name|naam)\s*[:\-]\s*([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*){1,4})/i);
  if (nameMatch) fields['Name'] = nameMatch[1].trim();

  const dobMatch = text.match(/(?:date of birth|d\.?o\.?b|dob)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (dobMatch) fields['Date of Birth'] = dobMatch[1];

  if (docType === 'Caste Certificate') {
    const cat = text.match(/(?:belongs to|caste|category)\s*[:\-]?\s*\b(SC|ST|OBC|EBC|General|Scheduled Caste|Scheduled Tribe|Other Backward Class)\b/i);
    if (cat) fields['Category'] = cat[1].trim();
    const cert = text.match(/(?:certificate no|no\.)\s*[:\-]?\s*([A-Z0-9\/\-]{4,20})/i);
    if (cert) fields['Certificate Number'] = cert[1].trim();
    const iss = text.match(/(?:issued by|issuing authority)\s*[:\-]?\s*(.{5,60}?)(?:\n|$)/i);
    if (iss) fields['Issuing Authority'] = iss[1].trim();
  }

  if (docType === 'Domicile Certificate') {
    const state = text.match(/(?:state of|resident of|domicile of)\s*[:\-]?\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i);
    if (state) fields['State'] = state[1].trim();
    const cert = text.match(/(?:certificate no|no\.)\s*[:\-]?\s*([A-Z0-9\/\-]{4,20})/i);
    if (cert) fields['Certificate Number'] = cert[1].trim();
  }

  if (docType === 'Disability Certificate') {
    const pct = text.match(/(?:disability percentage|percentage of disability)\s*[:\-]?\s*(\d{1,3})\s*%?/i);
    if (pct) fields['Disability Percentage'] = `${pct[1]}%`;
    const type = text.match(/(?:type of disability|nature of disability)\s*[:\-]?\s*(.{5,80}?)(?:\n|$)/i);
    if (type) fields['Type of Disability'] = type[1].trim();
  }

  return fields;
}

// ─── Profile cross-check ─────────────────────────────────────────────────────

export function checkEligibility(
  extracted: Record<string, string>,
  profile: UserProfile | undefined,
  scholarships: Scholarship[],
): { inconsistencies: string[]; matchedScholarships: string[] } {
  const inconsistencies: string[] = [];
  const matchedScholarships: string[] = [];
  if (!profile) return { inconsistencies, matchedScholarships };

  const incomeStr = extracted['Annual Income'];
  if (incomeStr && profile.income) {
    const docIncome = parseInt(incomeStr.replace(/[^0-9]/g, ''), 10);
    const profIncome = parseInt(profile.income.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(docIncome) && !isNaN(profIncome) && Math.abs(docIncome - profIncome) > 100_000) {
      inconsistencies.push(
        `Income mismatch: document shows ${incomeStr}, your profile states ₹${profile.income}`,
      );
    }
  }

  const pctStr = extracted['Percentage'];
  if (pctStr && profile.percentage) {
    const docPct = parseFloat(pctStr.replace(/[^0-9.]/g, ''));
    const profPct = parseFloat(profile.percentage);
    if (!isNaN(docPct) && !isNaN(profPct) && Math.abs(docPct - profPct) > 5) {
      inconsistencies.push(
        `Marks mismatch: document shows ${pctStr}, your profile states ${profile.percentage}%`,
      );
    }
  }

  const docName = extracted['Name'];
  if (docName && profile.name) {
    const profFirst = profile.name.trim().split(/\s+/)[0].toLowerCase();
    if (profFirst && !docName.toLowerCase().includes(profFirst)) {
      inconsistencies.push(
        `Name mismatch: document shows "${docName}", your profile name is "${profile.name}"`,
      );
    }
  }

  for (const s of scholarships) {
    let eligible = true;
    if (s.min_percentage && profile.percentage) {
      const pct = parseFloat(profile.percentage);
      if (!isNaN(pct) && pct < s.min_percentage) eligible = false;
    }
    if (s.min_income && profile.income) {
      const income = parseInt(profile.income.replace(/[^0-9]/g, ''), 10);
      const cap = parseInt(s.min_income.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(income) && !isNaN(cap) && income > cap) eligible = false;
    }
    if (eligible) matchedScholarships.push(s.name);
  }

  return { inconsistencies, matchedScholarships };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse a document using client-side Tesseract.js OCR + structured field
 * extraction with per-field confidence and needs_manual_review flags.
 *
 * @param fileName    - Original filename (fallback type detection + PDF check)
 * @param fileSize    - Kept for API compatibility; not used in logic
 * @param profile     - Optional profile for cross-check inconsistency detection
 * @param scholarships - Scholarship list for eligibility pre-screening
 * @param dataUrl     - Base64 data URL of the image. null/undefined → PDF path.
 * @param onProgress  - Callback receiving OCR progress 0–100.
 */
export async function analyzeDocument(
  fileName: string,
  fileSize: number,
  profile: UserProfile | undefined,
  scholarships: Scholarship[],
  dataUrl?: string | null,
  onProgress?: (percent: number) => void,
): Promise<ExtractedDocumentData> {

  // ── PDF / no-image path ──────────────────────────────────────────────────
  const isPdf =
    !dataUrl ||
    dataUrl.startsWith('data:application/pdf') ||
    fileName.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    const docType = detectTypeFromFilename(fileName);
    const extractedFields: Record<string, string> = {
      'File Type': 'PDF — text extraction not available in-browser',
      'Detected Type': docType,
    };
    if (profile?.name) extractedFields['Profile Name'] = profile.name;
    const { inconsistencies } = checkEligibility(extractedFields, profile, scholarships);
    return {
      documentType: docType,
      extractedFields,
      confidence: 0,
      inconsistencies,
      rawText: undefined,
      ocrPerformed: false,
      parsedFields: undefined,
    };
  }

  // ── Image OCR path ───────────────────────────────────────────────────────
  onProgress?.(0);
  const { text: rawOcrText, confidence } = await performOCR(dataUrl, onProgress);
  onProgress?.(100);

  // ── Step 1: Mask Aadhaar numbers before any state is created ─────────────
  // maskedAadhaar is the XXXX-XXXX-LAST4 representation to store.
  // sanitizedText has the full number replaced — this is the text we work with.
  const { sanitizedText, maskedValue: maskedAadhaar } =
    sanitizeAndExtractAadhaar(rawOcrText);

  // ── Step 2: Determine document type ──────────────────────────────────────
  // Text detection overrides filename when it returns a confident match.
  const docType =
    detectTypeFromText(sanitizedText) ?? detectTypeFromFilename(fileName);

  // ── Step 3: Structured parsing for supported doc types ───────────────────
  const STRUCTURED_TYPES = ['Aadhaar Card', 'Mark Sheet', 'Income Certificate'];
  let parsedFields: ParsedDocumentFields | undefined;
  let extractedFields: Record<string, string>;

  if (STRUCTURED_TYPES.includes(docType)) {
    parsedFields = parseFieldsFromText(sanitizedText, docType, maskedAadhaar);
    extractedFields = buildExtractedFields(parsedFields);

    // If structured parsing found nothing useful, add a diagnostic note
    if (Object.keys(extractedFields).length === 0) {
      extractedFields['Note'] =
        'No fields detected — image quality may be low or layout is unusual';
    }
  } else {
    // Fallback for Caste / Domicile / Disability / Identity Document
    extractedFields = extractLegacyFields(sanitizedText, docType);
    if (Object.keys(extractedFields).length === 0) {
      extractedFields['Note'] =
        'No structured fields detected — image quality may be low';
    }
  }

  // ── Step 4: Cross-check extracted values against user profile ────────────
  const { inconsistencies } = checkEligibility(extractedFields, profile, scholarships);

  return {
    documentType: docType,
    extractedFields,
    confidence: Math.min(100, Math.max(0, confidence)) / 100,
    inconsistencies,
    // sanitizedText never contains an unmasked Aadhaar number
    rawText: sanitizedText.trim(),
    ocrPerformed: true,
    parsedFields,
  };
}
