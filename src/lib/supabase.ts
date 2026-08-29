import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Scholarship {
  id: string;
  name: string;
  name_hindi: string | null;
  description: string;
  category: string;
  eligibility_criteria: string;
  required_documents: string[];
  funding_amount: string;
  deadline: string;
  /** Maximum family annual income in INR (null = no income cap) */
  min_income: string | null;
  min_percentage: number | null;
  education_level: string;
  provider: string;
  region: string;
  keywords: string[];
  created_at: string;
  // --- Extended eligibility fields for profile matching ---
  /** Maximum annual family income in INR as a number (null = no cap) */
  max_income_num: number | null;
  /** Specific genders eligible: 'female' | 'male' | null (null = all genders) */
  target_gender: 'female' | 'male' | null;
  /** Which user profile categories qualify (empty = all) */
  target_categories: string[];
  /** Min age requirement (null = no min) */
  min_age: number | null;
  /** Max age requirement (null = no max) */
  max_age: number | null;
}

export async function fetchScholarships(): Promise<Scholarship[]> {
  const { data, error } = await supabase
    .from('scholarships')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch scholarships:', error.message);
    return [];
  }

  return (data as Scholarship[]) ?? [];
}
