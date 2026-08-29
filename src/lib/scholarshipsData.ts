import type { Scholarship } from '@/lib/supabase';

// Local scholarship data derived from scholarships.json
// All eligibility fields are populated for accurate profile-based matching.
const SCHOLARSHIPS_RAW: Scholarship[] = [
  {
    id: 'merit-cum-means-minority',
    name: 'Merit-cum-Means Scholarship for Minority Communities',
    name_hindi: 'अल्पसंख्यक समुदायों के लिए मेरिट-कम-मीन्स छात्रवृत्ति',
    description:
      'Support meritorious students from minority communities (Muslim, Christian, Sikh, Buddhist, Jain, Parsi) who have financial need. 30% of seats are reserved for girl students.',
    category: 'Minority',
    eligibility_criteria:
      'Minimum 50% marks in the previous exam. Family income must not exceed ₹2.5 lakh/year. Must be enrolled in a professional/technical course (e.g. B.Tech). 30% of seats reserved for girl students.',
    required_documents: [
      'Minority/community-related proof (where required)',
      'Income certificate',
      'Marksheets',
      'Aadhaar',
      'Fee receipt',
      'Bank details',
      'Admission/bonafide proof',
    ],
    funding_amount:
      'Up to ₹20,000/year (course fee) + ₹10,000/year (hostel) or ₹5,000/year (day scholar)',
    deadline: 'Check NSP portal',
    min_income: '2,50,000',
    min_percentage: 50,
    education_level: 'Undergraduate',
    provider: 'Ministry of Minority Affairs',
    region: 'All India',
    keywords: [
      'Minority', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Parsi',
      'Merit-Cum-Means', 'B.Tech', 'NSP', 'National Scholarship Portal',
    ],
    created_at: '2024-01-01T00:00:00.000Z',
    // Eligibility
    max_income_num: 250000,
    target_gender: null,               // all genders
    target_categories: ['Minority'],
    min_age: null,
    max_age: null,
  },
  {
    id: 'aicte-pragati',
    name: 'AICTE Pragati Scholarship',
    name_hindi: 'एआईसीटीई प्रगति छात्रवृत्ति',
    description:
      'Support girl students pursuing technical education in AICTE-approved B.Tech programs. Provides annual financial assistance of ₹50,000/year toward tuition and incidentals.',
    category: 'Gender-based',
    eligibility_criteria:
      'Girl students in the 1st year of an AICTE-approved B.Tech program. Family income must not exceed ₹8 lakh/year.',
    required_documents: [
      'Aadhaar',
      'Income certificate',
      'Class 10/12 marksheets',
      'Fee receipt',
      'Bank passbook',
      'Admission/bonafide proof',
      'Photograph',
    ],
    funding_amount: '₹50,000/year',
    deadline: '2026-10-31',
    min_income: '8,00,000',
    min_percentage: null,
    education_level: 'Undergraduate',
    provider: 'AICTE',
    region: 'All India',
    keywords: [
      'Girl Student', 'B.Tech', '1st Year', 'AICTE', 'Income < 8 Lakh',
      'Technical Education', 'Pragati', 'NSP', 'National Scholarship Portal',
    ],
    created_at: '2024-01-01T00:00:00.000Z',
    // Eligibility
    max_income_num: 800000,
    target_gender: 'female',           // girls only
    target_categories: [],             // all categories
    min_age: null,
    max_age: null,
  },
  {
    id: 'ffe-scholarship',
    name: 'Foundation for Excellence (FFE) Scholarship',
    name_hindi: 'फाउंडेशन फॉर एक्सेलेंस (FFE) छात्रवृत्ति',
    description:
      'Provide merit-based financial assistance to talented B.E./B.Tech students with financial need. Minimum 60% in Class 10 and 12 required.',
    category: 'Merit-cum-Means',
    eligibility_criteria:
      'Minimum 60% marks in Class 10 and Class 12. Family income must not exceed ₹4 lakh/year. Must be pursuing B.E./B.Tech.',
    required_documents: [
      'Income proof',
      'Class 10/12 marksheets',
      'Current academic records',
      'Admission/fee documents',
      'Bank details',
      'Other documents requested during application',
    ],
    funding_amount: 'Amount varies (merit-based)',
    deadline: 'Check FFE website',
    min_income: '4,00,000',
    min_percentage: 60,
    education_level: 'Undergraduate',
    provider: 'Foundation for Excellence',
    region: 'All India',
    keywords: [
      'B.Tech', 'Engineering', 'Merit-Cum-Means', 'Income < 4 Lakh',
      'General', 'Financial Need', 'FFE', 'B.E.',
    ],
    created_at: '2024-01-01T00:00:00.000Z',
    // Eligibility
    max_income_num: 400000,
    target_gender: null,               // all genders
    target_categories: [],             // all categories
    min_age: null,
    max_age: null,
  },
  {
    id: 'aicte-swanath',
    name: 'AICTE Swanath Scholarship',
    name_hindi: 'एआईसीटीई स्वनाथ छात्रवृत्ति',
    description:
      'Financial support for orphans, students whose parents died due to COVID-19, wards of Armed Forces/CAPF martyrs, or students with a critically ill/disabled parent (80%+ disability) pursuing AICTE-approved B.Tech programs.',
    category: 'Need-based',
    eligibility_criteria:
      'Must be one of: Orphan, student whose parent died due to COVID-19, ward of Armed Forces/CAPF martyr, or student with a parent having critical illness or more than 80% disability. Family income must not exceed ₹8 lakh/year. Must be enrolled in AICTE-approved B.Tech program.',
    required_documents: [
      'Relevant proof of the special circumstance',
      'Income certificate',
      'Aadhaar',
      'Academic records',
      'Fee receipt',
      'Bank details',
      'Admission/bonafide proof',
    ],
    funding_amount: '₹50,000/year (up to 4 years)',
    deadline: '2026-10-31',
    min_income: '8,00,000',
    min_percentage: null,
    education_level: 'Undergraduate',
    provider: 'AICTE',
    region: 'All India',
    keywords: [
      'AICTE', 'B.Tech', 'Orphan', 'COVID-19 Parent Loss', 'Armed Forces', 'CAPF',
      'Critical Illness', 'Disability', 'Income < 8 Lakh', 'Swanath', 'NSP',
    ],
    created_at: '2024-01-01T00:00:00.000Z',
    // Eligibility
    max_income_num: 800000,
    target_gender: null,               // all genders
    target_categories: [],             // all categories (special circumstance required)
    min_age: null,
    max_age: null,
  },
  {
    id: 'aicte-saksham',
    name: 'AICTE Saksham Scholarship',
    name_hindi: 'एआईसीटीई सक्षम छात्रवृत्ति',
    description:
      'Provide financial assistance to specially-abled (PwD) students pursuing technical education in AICTE-approved B.Tech programs. Requires minimum 40% disability certificate.',
    category: 'Disability',
    eligibility_criteria:
      'Students with at least 40% disability pursuing 1st year of an AICTE-approved B.Tech program. Family income must not exceed ₹8 lakh/year.',
    required_documents: [
      'Disability certificate',
      'Income certificate',
      'Aadhaar',
      'Marksheets',
      'Fee receipt',
      'Bank details',
      'Admission/bonafide proof',
      'Photograph',
    ],
    funding_amount: '₹50,000/year',
    deadline: '2026-10-31',
    min_income: '8,00,000',
    min_percentage: null,
    education_level: 'Undergraduate',
    provider: 'AICTE',
    region: 'All India',
    keywords: [
      'PwD', '40% Disability', 'B.Tech', '1st Year', 'AICTE', 'Income < 8 Lakh',
      'Saksham', 'Differently Abled', 'Special', 'NSP',
    ],
    created_at: '2024-01-01T00:00:00.000Z',
    // Eligibility
    max_income_num: 800000,
    target_gender: null,               // all genders
    target_categories: ['Differently-Abled'],
    min_age: null,
    max_age: null,
  },
  {
    id: 'ggsipu-ews',
    name: 'GGSIPU EWS Financial Assistance',
    name_hindi: 'जीजीएसआईपीयू ईडब्ल्यूएस वित्तीय सहायता',
    description:
      'Financial assistance for Economically Weaker Section (EWS) students studying at GGSIPU, including USICT students, toward tuition/fees.',
    category: 'Need-based',
    eligibility_criteria:
      'Must be a regular student of GGSIPU/USS/Centres/Affiliated Institutes (including USICT) and meet EWS (Economically Weaker Section) criteria.',
    required_documents: [
      'EWS certificate',
      'Aadhaar',
      'Academic records',
      'Fee documents',
      'Bank details',
      'Admission/bonafide proof',
    ],
    funding_amount: 'Varies (institute-determined)',
    deadline: 'Check GGSIPU website',
    min_income: null,
    min_percentage: null,
    education_level: 'Undergraduate',
    provider: 'GGSIPU',
    region: 'Delhi',
    keywords: [
      'EWS', 'USICT', 'GGSIPU', 'Economically Weaker', 'Tuition Assistance',
      'Delhi', 'Guru Gobind Singh',
    ],
    created_at: '2024-01-01T00:00:00.000Z',
    // Eligibility — EWS income limit is ₹8 lakh/year per Central Govt definition
    max_income_num: 800000,
    target_gender: null,
    target_categories: ['General', 'EBC'],  // EWS is for General/EBC who are economically weak
    min_age: null,
    max_age: null,
  },
  {
    id: 'pms-obc',
    name: 'Post-Matric Scholarship for OBC Students',
    name_hindi: 'ओबीसी छात्रों के लिए पोस्ट-मैट्रिक छात्रवृत्ति',
    description:
      'Support OBC students financially so they can continue higher education. Applicable for professional/technical courses with minimum 60% marks and family income not exceeding ₹1 lakh/year.',
    category: 'Caste-based',
    eligibility_criteria:
      'OBC students with at least 60% marks in previous exam. Family income must not exceed ₹1 lakh/year. Must be pursuing a professional/technical post-matric course.',
    required_documents: [
      'OBC certificate/NCL (where applicable)',
      'Income certificate',
      'Aadhaar',
      'Marksheets',
      'Fee receipt',
      'Bank details',
      'Admission/bonafide proof',
      'Photograph',
    ],
    funding_amount: '₹8,000–₹24,000/year',
    deadline: 'Check NSP / e-District Delhi portal',
    min_income: '1,00,000',
    min_percentage: 60,
    education_level: 'Undergraduate',
    provider: 'Ministry of Social Justice & Empowerment',
    region: 'All India',
    keywords: [
      'OBC', 'NCL', '60% Marks', 'Post-Matric', 'B.Tech', 'Income-Based',
      'NSP', 'Other Backward Class',
    ],
    created_at: '2024-01-01T00:00:00.000Z',
    // Eligibility
    max_income_num: 100000,
    target_gender: null,
    target_categories: ['OBC'],
    min_age: null,
    max_age: null,
  },
  {
    id: 'pms-st',
    name: 'Post-Matric Scholarship for ST Students',
    name_hindi: 'एसटी छात्रों के लिए पोस्ट-मैट्रिक छात्रवृत्ति',
    description:
      'Financial assistance for Scheduled Tribe (ST) students continuing education after Class 10 in Delhi institutions, covering tuition fees plus maintenance allowance.',
    category: 'Caste-based',
    eligibility_criteria:
      'ST students pursuing higher/professional education in Delhi institutions. Income conditions apply.',
    required_documents: [
      'ST certificate',
      'Income certificate',
      'Aadhaar',
      'Academic marksheets',
      'Fee receipt',
      'Bank passbook',
      'Admission/bonafide proof',
      'Photograph',
    ],
    funding_amount: 'Tuition fee + maintenance allowance',
    deadline: 'Check e-District Delhi portal',
    min_income: null,
    min_percentage: null,
    education_level: 'Undergraduate',
    provider: 'Government of Delhi',
    region: 'Delhi',
    keywords: [
      'ST', 'Scheduled Tribe', 'Post-Matric', 'Delhi', 'B.Tech',
      'Income-Based', 'e-District Delhi', 'Government',
    ],
    created_at: '2024-01-01T00:00:00.000Z',
    // Eligibility
    max_income_num: null,              // income not specified in source
    target_gender: null,
    target_categories: ['ST'],
    min_age: null,
    max_age: null,
  },
  {
    id: 'top-class-sc',
    name: 'Central Sector Scheme of Top Class Education for SC Students',
    name_hindi: 'एससी छात्रों के लिए टॉप क्लास शिक्षा की केंद्रीय क्षेत्र योजना',
    description:
      'Provide substantial financial support to SC students pursuing higher education in top institutions. Covers full tuition fees plus allowances.',
    category: 'Caste-based',
    eligibility_criteria:
      'SC students pursuing professional/technical higher education at a top institution. Applicable income conditions apply.',
    required_documents: [
      'SC caste certificate',
      'Income certificate',
      'Aadhaar',
      'Class 10/12 marksheets',
      'Fee receipt',
      'Bank details',
      'Admission/bonafide certificate',
      'Photograph',
    ],
    funding_amount: 'Full tuition fee + allowances',
    deadline: '2026-10-31',
    min_income: null,
    min_percentage: null,
    education_level: 'Undergraduate',
    provider: 'Ministry of Social Justice & Empowerment',
    region: 'All India',
    keywords: [
      'SC', 'Scheduled Caste', 'Top Class', 'Government', 'B.Tech',
      'Professional Course', 'Income-Based', 'NSP',
    ],
    created_at: '2024-01-01T00:00:00.000Z',
    // Eligibility
    max_income_num: null,
    target_gender: null,
    target_categories: ['SC'],
    min_age: null,
    max_age: null,
  },
  {
    id: 'csss',
    name: 'Central Sector Scheme of Scholarship (CSSS)',
    name_hindi: 'केंद्रीय क्षेत्र छात्रवृत्ति योजना (CSSS)',
    description:
      'Provide financial support to academically strong undergraduate students with Class 12 score above the 80th percentile and family income up to ₹8 lakh/year.',
    category: 'Merit',
    eligibility_criteria:
      'Class 12 score must be above the 80th percentile. Family income must not exceed ₹8 lakh/year. Must be pursuing an undergraduate program.',
    required_documents: [
      'Aadhaar',
      'Income certificate',
      'Class 10 & 12 marksheets',
      'Current fee receipt',
      'Bank passbook',
      'Admission/bonafide proof',
      'Photograph',
    ],
    funding_amount: '₹10,000–₹20,000/year',
    deadline: 'Check NSP portal',
    min_income: '8,00,000',
    min_percentage: null,
    education_level: 'Undergraduate',
    provider: 'Ministry of Education',
    region: 'All India',
    keywords: [
      'General', 'Merit-Based', 'Class 12', 'Income < 8 Lakh', 'UG', 'B.Tech',
      'CSSS', 'NSP', 'Central Sector',
    ],
    created_at: '2024-01-01T00:00:00.000Z',
    // Eligibility — open to all categories with merit + income constraint
    max_income_num: 800000,
    target_gender: null,
    target_categories: [],             // all categories
    min_age: null,
    max_age: null,
  },
];

export function getLocalScholarships(): Scholarship[] {
  return SCHOLARSHIPS_RAW;
}
