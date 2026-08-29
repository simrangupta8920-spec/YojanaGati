import type { Scholarship, UserProfile } from '@/lib/types';

export interface RAGResult {
  answer: string;
  matchedScholarships: Scholarship[];
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[\s,;.!?]+/)
    .filter((t) => t.length > 1);
}

function scoreScholarship(
  scholarship: Scholarship,
  queryTokens: string[],
  profile?: UserProfile,
): number {
  let score = 0;

  const searchableText = [
    scholarship.name,
    scholarship.name_hindi ?? '',
    scholarship.description,
    scholarship.category,
    scholarship.eligibility_criteria,
    scholarship.provider,
    scholarship.region,
    scholarship.keywords.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  for (const token of queryTokens) {
    if (scholarship.keywords.some((k) => k.toLowerCase().includes(token))) {
      score += 5;
    }
    if (searchableText.includes(token)) {
      score += 2;
    }
  }

  if (profile) {
    if (
      profile.category &&
      profile.category !== 'General' &&
      scholarship.category.toLowerCase().includes(profile.category.toLowerCase())
    ) {
      score += 8;
    }

    if (profile.state) {
      const stateLower = profile.state.toLowerCase();
      if (
        scholarship.region.toLowerCase().includes(stateLower) ||
        scholarship.region === 'All India'
      ) {
        score += 4;
      }
    }

    if (profile.educationLevel) {
      const eduLower = profile.educationLevel.toLowerCase();
      if (
        scholarship.education_level.toLowerCase().includes('any') ||
        scholarship.education_level.toLowerCase().includes('school') ===
          eduLower.includes('school')
      ) {
        score += 4;
      }
    }

    if (profile.income && scholarship.min_income) {
      const incomeNum = parseInt(profile.income.replace(/[^0-9]/g, ''), 10);
      const minIncomeNum = parseInt(
        scholarship.min_income.replace(/[^0-9]/g, ''),
        10,
      );
      if (!isNaN(incomeNum) && !isNaN(minIncomeNum) && incomeNum <= minIncomeNum) {
        score += 5;
      }
    }

    if (profile.percentage && scholarship.min_percentage) {
      const pct = parseInt(profile.percentage, 10);
      if (!isNaN(pct) && pct >= scholarship.min_percentage) {
        score += 5;
      }
    }

    if (profile.gender === 'female') {
      const femaleKeywords = ['girl', 'women', 'kanya', 'kanyashree', 'female'];
      if (
        femaleKeywords.some((k) =>
          scholarship.keywords.some((sk) => sk.toLowerCase().includes(k)),
        )
      ) {
        score += 6;
      }
    }
  }

  return score;
}

export function retrieveScholarships(
  query: string,
  allScholarships: Scholarship[],
  profile?: UserProfile,
  topK = 5,
): Scholarship[] {
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0 && !profile) {
    return allScholarships.slice(0, topK);
  }

  const scored = allScholarships.map((s) => ({
    scholarship: s,
    score: scoreScholarship(s, queryTokens, profile),
  }));

  scored.sort((a, b) => b.score - a.score);

  const results = scored.filter((s) => s.score > 0).slice(0, topK);

  return results.length > 0
    ? results.map((s) => s.scholarship)
    : allScholarships.slice(0, topK);
}

export function generateAnswer(
  query: string,
  matched: Scholarship[],
  profile?: UserProfile,
): string {
  if (matched.length === 0) {
    return "I couldn't find any scholarships matching your query. Could you tell me more about your education level, state, or category?";
  }

  const lowerQuery = query.toLowerCase();

  if (
    lowerQuery.includes('deadline') ||
    lowerQuery.includes('date') ||
    lowerQuery.includes('last date')
  ) {
    const deadlines = matched
      .map((s) => `${s.name}: ${s.deadline}`)
      .join('\n');
    return `Here are the upcoming deadlines for scholarships you may be eligible for:\n\n${deadlines}\n\nMake sure to apply before the deadline!`;
  }

  if (
    lowerQuery.includes('document') ||
    lowerQuery.includes('paper') ||
    lowerQuery.includes('proof')
  ) {
    const allDocs = new Set<string>();
    matched.forEach((s) =>
      s.required_documents.forEach((d) => allDocs.add(d)),
    );
    return `Based on the scholarships you're eligible for, you'll typically need these documents:\n\n${Array.from(allDocs)
      .map((d) => `• ${d}`)
      .join('\n')}\n\nUpload them in the Document Check section for instant verification.`;
  }

  if (
    lowerQuery.includes('eligible') ||
    lowerQuery.includes('eligibility') ||
    lowerQuery.includes('can i') ||
    lowerQuery.includes('qualify')
  ) {
    const profileContext = profile
      ? `Based on your profile (${profile.category}, ${profile.educationLevel}, ${profile.state})`
      : 'Based on your query';
    const eligible = matched
      .map(
        (s) =>
          `• ${s.name} — ${s.funding_amount}. ${s.eligibility_criteria.substring(0, 120)}...`,
      )
      .join('\n');
    return `${profileContext}, here are scholarships you may qualify for:\n\n${eligible}\n\nWould you like more details on any of these?`;
  }

  if (
    lowerQuery.includes('amount') ||
    lowerQuery.includes('money') ||
    lowerQuery.includes('funding') ||
    lowerQuery.includes('how much')
  ) {
    const amounts = matched
      .map((s) => `${s.name}: ${s.funding_amount}`)
      .join('\n');
    return `Here are the funding amounts for scholarships you may be eligible for:\n\n${amounts}`;
  }

  const summary = matched
    .map(
      (s) =>
        `• ${s.name} — ${s.funding_amount} — Deadline: ${s.deadline}`,
    )
    .join('\n');

  return `I found ${matched.length} scholarships relevant to your query:\n\n${summary}\n\nYou can ask me about eligibility, documents, deadlines, or funding amounts for any of these.`;
}

export function ragQuery(
  query: string,
  allScholarships: Scholarship[],
  profile?: UserProfile,
): RAGResult {
  const matched = retrieveScholarships(query, allScholarships, profile);
  const answer = generateAnswer(query, matched, profile);
  return { answer, matchedScholarships: matched };
}
