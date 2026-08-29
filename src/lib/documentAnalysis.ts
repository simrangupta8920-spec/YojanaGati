import type { ExtractedDocumentData, UserProfile, Scholarship } from '@/lib/types';

function detectDocumentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('aadhaar') || lower.includes('aadhar') || lower.includes('uid'))
    return 'Aadhaar Card';
  if (lower.includes('income') || lower.includes('salary')) return 'Income Certificate';
  if (lower.includes('mark') || lower.includes('result') || lower.includes('score'))
    return 'Mark Sheet';
  if (lower.includes('caste') || lower.includes('category')) return 'Caste Certificate';
  if (lower.includes('domicile') || lower.includes('residence')) return 'Domicile Certificate';
  if (lower.includes('disability')) return 'Disability Certificate';
  return 'Identity Document';
}

function generateMockFields(
  docType: string,
  fileSize: number,
): Record<string, string> {
  const fields: Record<string, string> = {};

  if (docType === 'Aadhaar Card') {
    fields['Name'] = 'Sample Applicant';
    fields['Aadhaar Number'] = 'XXXX-XXXX-1234';
    fields['Date of Birth'] = '15/08/2003';
    fields['Gender'] = 'Male';
    fields['Address'] = 'Sample District, State';
  } else if (docType === 'Income Certificate') {
    fields['Name'] = 'Sample Applicant';
    fields['Annual Income'] = '₹2,50,000';
    fields['Issuing Authority'] = 'Tehsildar Office';
    fields['Certificate Number'] = 'IC-2026-XXXX';
    fields['Date of Issue'] = '10/01/2026';
  } else if (docType === 'Mark Sheet') {
    fields['Name'] = 'Sample Applicant';
    fields['Examination'] = 'Class 12 Board Exam';
    fields['Total Marks'] = '472/500';
    fields['Percentage'] = '94.4%';
    fields['Year'] = '2025';
  } else if (docType === 'Caste Certificate') {
    fields['Name'] = 'Sample Applicant';
    fields['Category'] = 'SC';
    fields['Certificate Number'] = 'CC-2026-XXXX';
    fields['Issuing Authority'] = 'SDM Office';
  } else if (docType === 'Domicile Certificate') {
    fields['Name'] = 'Sample Applicant';
    fields['State'] = 'Punjab';
    fields['Certificate Number'] = 'DC-2026-XXXX';
  } else {
    fields['Name'] = 'Sample Applicant';
    fields['Document ID'] = `DOC-${fileSize}`;
  }

  return fields;
}

function checkEligibility(
  extracted: Record<string, string>,
  profile: UserProfile | undefined,
  scholarships: Scholarship[],
): { inconsistencies: string[]; matchedScholarships: string[] } {
  const inconsistencies: string[] = [];
  const matchedScholarships: string[] = [];

  if (!profile) {
    return { inconsistencies, matchedScholarships };
  }

  const incomeStr = extracted['Annual Income'];
  if (incomeStr) {
    const incomeNum = parseInt(incomeStr.replace(/[^0-9]/g, ''), 10);
    const profileIncome = parseInt(profile.income?.replace(/[^0-9]/g, '') || '0', 10);
    if (!isNaN(incomeNum) && !isNaN(profileIncome)) {
      if (Math.abs(incomeNum - profileIncome) > 100000) {
        inconsistencies.push(
          `Income mismatch: Document shows ${incomeStr}, profile states ${profile.income}`,
        );
      }
    }
  }

  const percentageStr = extracted['Percentage'];
  if (percentageStr) {
    const pctNum = parseFloat(percentageStr.replace(/[^0-9.]/g, ''));
    const profilePct = parseInt(profile.percentage || '0', 10);
    if (!isNaN(pctNum) && !isNaN(profilePct)) {
      if (Math.abs(pctNum - profilePct) > 5) {
        inconsistencies.push(
          `Marks mismatch: Document shows ${percentageStr}, profile states ${profile.percentage}%`,
        );
      }
    }
  }

  const nameInDoc = extracted['Name'];
  if (nameInDoc && profile.name) {
    if (
      !nameInDoc.toLowerCase().includes(profile.name.toLowerCase().split(' ')[0])
    ) {
      inconsistencies.push(
        `Name mismatch: Document shows "${nameInDoc}", profile name is "${profile.name}"`,
      );
    }
  }

  scholarships.forEach((s) => {
    let eligible = true;

    if (s.min_percentage && profile.percentage) {
      const pct = parseInt(profile.percentage, 10);
      if (!isNaN(pct) && pct < s.min_percentage) {
        eligible = false;
      }
    }

    if (s.min_income && profile.income) {
      const income = parseInt(profile.income.replace(/[^0-9]/g, ''), 10);
      const minIncome = parseInt(s.min_income.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(income) && !isNaN(minIncome) && income > minIncome) {
        eligible = false;
      }
    }

    if (eligible) {
      matchedScholarships.push(s.name);
    }
  });

  return { inconsistencies, matchedScholarships };
}

export async function analyzeDocument(
  fileName: string,
  fileSize: number,
  profile: UserProfile | undefined,
  scholarships: Scholarship[],
): Promise<ExtractedDocumentData> {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const docType = detectDocumentType(fileName);
  const extractedFields = generateMockFields(docType, fileSize);
  const { inconsistencies, matchedScholarships } = checkEligibility(
    extractedFields,
    profile,
    scholarships,
  );

  const confidence = inconsistencies.length === 0 ? 0.92 : 0.78;

  return {
    documentType: docType,
    extractedFields,
    confidence,
    inconsistencies,
  };
}
