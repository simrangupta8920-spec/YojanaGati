import type { UserProfile } from '@/lib/types';
import type { Scholarship } from '@/lib/supabase';
import { evaluateEligibility } from '@/lib/eligibility';

export interface RAGResult {
  matchedScholarships: Scholarship[];
  answer: string;
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

  let hasKeywordMatch = false;
  for (const token of queryTokens) {
    let match = false;
    if (scholarship.keywords.some((k) => k.toLowerCase().includes(token))) {
      score += 5;
      match = true;
    }
    if (searchableText.includes(token)) {
      score += 2;
      match = true;
    }
    if (match) {
      hasKeywordMatch = true;
    }
  }

  // If search query is provided, but none of the words matched this scholarship, score is 0.
  if (queryTokens.length > 0 && !hasKeywordMatch) {
    return 0;
  }

  if (profile) {
    // Category match
    if (
      profile.category &&
      profile.category !== 'General' &&
      scholarship.category.toLowerCase().includes(profile.category.toLowerCase())
    ) {
      score += 8;
    }

    // State / Region match
    if (profile.state) {
      const stateLower = profile.state.toLowerCase();
      if (
        scholarship.region.toLowerCase().includes(stateLower) ||
        scholarship.region.toLowerCase() === 'all india'
      ) {
        score += 4;
      }
    }

    // Education level match
    if (profile.educationLevel) {
      const eduLower = profile.educationLevel.toLowerCase();
      if (
        scholarship.education_level.toLowerCase().includes('any') ||
        scholarship.education_level.toLowerCase().includes(eduLower)
      ) {
        score += 4;
      }
    }

    // Income eligibility check
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

    // Academic performance match
    if (profile.percentage && scholarship.min_percentage) {
      const pct = parseInt(profile.percentage, 10);
      if (!isNaN(pct) && pct >= scholarship.min_percentage) {
        score += 5;
      }
    }

    // Gender targeting match
    if (profile.gender) {
      const genderLower = profile.gender.toLowerCase();
      if (scholarship.target_gender === genderLower) {
        score += 6;
      } else if (scholarship.target_gender === null) {
        score += 2;
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

  // 1. Evaluate eligibility and score each scholarship
  const evaluated = allScholarships.map((s) => {
    const eligibility = profile ? evaluateEligibility(s, profile) : null;
    const score = scoreScholarship(s, queryTokens, profile);
    return {
      scholarship: s,
      score,
      isEligible: eligibility ? eligibility.isEligible : true,
    };
  });

  // 2. Sort by search score descending
  evaluated.sort((a, b) => b.score - a.score);

  // 3. Filter candidates:
  // If the query is generic eligibility questions, we ONLY return eligible ones.
  // If they are asking about a specific scholarship, keep the top matches even if ineligible.
  const queryLower = query.toLowerCase();
  const isGenericQuery =
    queryTokens.length === 0 ||
    queryLower.includes('eligible') ||
    queryLower.includes('eligibility') ||
    queryLower.includes('can i') ||
    queryLower.includes('qualify') ||
    queryLower.includes('fit') ||
    queryLower.includes('match') ||
    queryLower.includes('what are') ||
    queryLower.includes('list') ||
    queryLower.includes('show me') ||
    queryLower.includes('any') ||
    queryLower.includes('पात्र') || // Hindi "eligible"
    queryLower.includes('योग्यता') || // Hindi "eligibility"
    queryLower.includes('लायक');

  let results: typeof evaluated = [];
  if (profile && isGenericQuery) {
    // Only return eligible ones for generic queries
    results = evaluated.filter((s) => s.isEligible && s.score > 0);
  } else {
    // For specific queries, keep the top matches even if ineligible
    results = evaluated.filter((s) => s.score > 0);
  }

  // Limit to topK
  const finalResults = results.slice(0, topK);

  return finalResults.length > 0
    ? finalResults.map((s) => s.scholarship)
    : (profile ? allScholarships.filter(s => evaluateEligibility(s, profile).isEligible).slice(0, topK) : allScholarships.slice(0, topK));
}

/**
 * Checks how a specific scholarship matches a user profile and returns a friendly list of matching reasons.
 */
function getMatchDetails(scholarship: Scholarship, profile: UserProfile): string[] {
  const matches: string[] = [];

  // State match
  if (profile.state) {
    if (scholarship.region.toLowerCase() === 'all india') {
      matches.push(`available pan-India`);
    } else if (scholarship.region.toLowerCase().includes(profile.state.toLowerCase())) {
      matches.push(`open to residents of ${profile.state}`);
    }
  }

  // Gender match
  if (profile.gender && scholarship.target_gender) {
    if (profile.gender.toLowerCase() === scholarship.target_gender.toLowerCase()) {
      matches.push(`specifically supports ${profile.gender} applicants`);
    }
  }

  // Category match
  if (profile.category && profile.category !== 'General') {
    const isCategoryTargeted = scholarship.category.toLowerCase().includes(profile.category.toLowerCase()) ||
      scholarship.eligibility_criteria.toLowerCase().includes(profile.category.toLowerCase());
    if (isCategoryTargeted) {
      matches.push(`tailored for ${profile.category} category students`);
    }
  }

  // Marks match
  if (profile.percentage && scholarship.min_percentage) {
    const userPct = parseFloat(profile.percentage);
    if (!isNaN(userPct) && userPct >= scholarship.min_percentage) {
      matches.push(`your academic score (${profile.percentage}%) meets the required ${scholarship.min_percentage}%`);
    }
  }

  // Income match
  if (profile.income && scholarship.min_income) {
    const userIncome = parseInt(profile.income.replace(/[^0-9]/g, ''), 10);
    const limitIncome = parseInt(scholarship.min_income.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(userIncome) && !isNaN(limitIncome) && userIncome <= limitIncome) {
      matches.push(`your family income (₹${userIncome.toLocaleString('en-IN')}) is below the ₹${scholarship.min_income} limit`);
    }
  }

  return matches;
}

export function generateAnswer(
  query: string,
  matched: Scholarship[],
  profile?: UserProfile,
): string {
  const lowerQuery = query.toLowerCase();
  const trimmed = lowerQuery.trim();
  
  const greetingKeywords = [
    'hi', 'hello', 'hey', 'namaste', 'hola', 'greetings', 'pranam', 
    'pranams', 'vanakkam', 'satsriakal', 'adaab', 'yo', 'good morning', 
    'good afternoon', 'good evening'
  ];
  
  const isCasualGreeting = greetingKeywords.some(g => {
    return trimmed === g || 
           trimmed === `${g}!` || 
           trimmed === `${g}.` || 
           trimmed === `${g} there` || 
           trimmed === `${g} friend`;
  });

  if (isCasualGreeting) {
    const userName = profile?.name ? profile.name.trim() : null;
    const casualReplies = [
      userName 
        ? `Hi ${userName}! How can I help you today?` 
        : `Hi! How can I help you today?`,
      userName 
        ? `Hello ${userName}! How can I help you with your scholarship search today?` 
        : `Hello! How can I help you with your scholarship search today?`,
      userName 
        ? `Namaste ${userName}! How can I assist you today?` 
        : `Namaste! How can I assist you with your scholarship search today?`,
    ];
    return casualReplies[Math.floor(Math.random() * casualReplies.length)];
  }
  
  // 1. Check if user has completed onboarding profile
  const userName = profile?.name ? profile.name.trim() : null;
  const greetings = [
    userName ? `Hello ${userName}! ` : 'Hello! ',
    userName ? `Hi ${userName}, ` : 'Hi there! ',
    userName ? `Sure, ${userName}. ` : 'Sure! ',
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  if (!profile) {
    return `${greeting}I noticed you haven't filled out your eligibility profile yet. Completing onboarding helps me verify matching requirements accurately. In the meantime, here are ${matched.length} scholarships matching your search:\n\n` +
      matched.map(s => `• **${s.name}**: ${s.funding_amount} (${s.eligibility_criteria.substring(0, 100)}...)`).join('\n') +
      `\n\nWould you like to complete onboarding or ask about specific deadlines, eligibility, or documents?`;
  }

  // 2. Identify the core intent of the user query
  const isDeadlineQuery   = lowerQuery.includes('deadline') || lowerQuery.includes('last date') || lowerQuery.includes('when');
  const isDocumentQuery   = lowerQuery.includes('document') || lowerQuery.includes('paper') || lowerQuery.includes('proof') || lowerQuery.includes('upload');
  const isAmountQuery     = lowerQuery.includes('amount') || lowerQuery.includes('money') || lowerQuery.includes('funding') || lowerQuery.includes('how much') || lowerQuery.includes('stipend');
  const isEligibilityQuery= lowerQuery.includes('eligible') || lowerQuery.includes('eligibility') || lowerQuery.includes('can i') || lowerQuery.includes('qualify') || lowerQuery.includes('fit') || lowerQuery.includes('match');
  const isApplyQuery      = lowerQuery.includes('apply') || lowerQuery.includes('application') || lowerQuery.includes('register') || lowerQuery.includes('how to get') || lowerQuery.includes('apply online') || lowerQuery.includes('nsp') || lowerQuery.includes('portal');
  const isHelpQuery       = trimmed === 'help' || trimmed === 'help me' || lowerQuery.includes('what can you do') || lowerQuery.includes('what can you help') || lowerQuery.includes('tell me about yourself') || lowerQuery.includes('what are you');
  const isThanksQuery     = lowerQuery.includes('thank') || trimmed === 'thanks' || trimmed === 'ty' || lowerQuery.includes('dhanyawad') || lowerQuery.includes('shukriya') || lowerQuery.includes('bahut') || trimmed === 'great' || trimmed === 'awesome' || trimmed === 'perfect';
  const isGoodbyeQuery    = trimmed === 'bye' || trimmed === 'goodbye' || trimmed === 'see you' || trimmed === 'ok bye' || lowerQuery.includes('alvida');
  const isDenialQuery     = trimmed === 'no' || trimmed === 'nah' || trimmed === 'no thanks' || trimmed === 'no thank you' || trimmed === 'nothing' || trimmed === 'nothing else' || lowerQuery.includes('no i am good') || lowerQuery.includes('no i\'m good') || lowerQuery.includes('no that is all') || lowerQuery.includes('no that\'s all') || lowerQuery.includes('no that is it') || lowerQuery.includes('no that\'s it');

  // Intent: Goodbye
  if (isGoodbyeQuery) {
    const userName = profile?.name ? profile.name.trim() : null;
    return userName
      ? `Goodbye ${userName}! Best of luck with your applications. Come back anytime! 👋`
      : `Goodbye! Best of luck with your scholarship applications. Come back anytime! 👋`;
  }

  // Intent: Denial ("no thanks", "nothing else")
  if (isDenialQuery) {
    const userName = profile?.name ? profile.name.trim() : null;
    const denialReplies = [
      userName ? `No problem, ${userName}! Let me know if you need anything else in the future. Have a great day! 👋` : `No problem! Let me know if you need anything else in the future. Have a great day! 👋`,
      userName ? `Alright, ${userName}! Feel free to ask if you have any questions later. Take care! 👋` : `Alright! Feel free to ask if you have any questions later. Take care! 👋`,
      userName ? `Understood, ${userName}. Best of luck with your studies and applications! 👋` : `Understood. Best of luck with your studies and applications! 👋`,
    ];
    return denialReplies[Math.floor(Math.random() * denialReplies.length)];
  }

  // Intent: Thank you
  if (isThanksQuery) {
    const userName = profile?.name ? profile.name.trim() : null;
    const thankReplies = [
      userName ? `You're welcome, ${userName}! Is there anything else I can help you with?` : `You're welcome! Is there anything else I can help you with?`,
      userName ? `Happy to help, ${userName}! Feel free to ask anything else.` : `Happy to help! Feel free to ask anything else.`,
      userName ? `Anytime, ${userName}! All the best with your scholarship applications! 🎓` : `Anytime! All the best with your scholarship applications! 🎓`,
    ];
    return thankReplies[Math.floor(Math.random() * thankReplies.length)];
  }

  // Intent: Dry / one-word acknowledgement ("ok", "okay", "k", "cool", "alright", "got it", "noted", "sure", "fine", "hmm", "nice")
  const dryResponses = ['ok', 'okay', 'k', 'cool', 'alright', 'alrite', 'got it', 'gotit', 'noted', 'sure', 'fine', 'hmm', 'nice', 'right', 'ohk', 'ohkay', 'oh ok', 'i see', 'understood', 'makes sense'];
  const isDryResponse = dryResponses.some(d => trimmed === d || trimmed === `${d}.` || trimmed === `${d}!`);

  if (isDryResponse) {
    const userName = profile?.name ? profile.name.trim() : null;
    // Pick the nearest deadline from matched scholarships as a helpful nudge
    const deadlineNudge = matched.length > 0
      ? `\n\nBy the way, the nearest deadline I see for your profile is **${matched[0].name}** on **${matched[0].deadline}** — don't miss it!`
      : '';
    const followUps = [
      `Is there anything else you'd like to know?${deadlineNudge}`,
      `Anything else I can help with? I can share **deadlines**, **required documents**, or **funding amounts** for your matched scholarships.`,
      `Let me know if you want more details — like how to apply, or which documents to prepare!`,
    ];
    const reply = followUps[Math.floor(Math.random() * followUps.length)];
    return userName ? `${reply}` : reply;
  }

  // Intent: Help / capability question
  if (isHelpQuery) {
    const userName = profile?.name ? profile.name.trim() : null;
    return `${userName ? `Hi ${userName}! ` : `Hi! `}I'm your YojanaGati scholarship assistant. Here's what I can help you with:\n\n• 🎓 **Which scholarships am I eligible for?** — I'll match against your profile.\n• 📅 **Scholarship deadlines** — I'll tell you what's coming up.\n• 📄 **What documents do I need?** — I'll list the required papers.\n• 💰 **How much funding will I get?** — I'll share the amounts.\n• 🌐 **How do I apply?** — I'll point you to the right portal.\n\nJust type your question naturally and I'll do my best to help!`;
  }

  // Intent: Application process / how to apply
  if (isApplyQuery) {
    const topScholarship = matched[0];
    const portalHint = topScholarship
      ? `For **${topScholarship.name}**, the provider is **${topScholarship.provider}**. `
      : '';
    return `${greeting}${portalHint}Most central government scholarships are applied for through the **National Scholarship Portal (NSP)** at scholarships.gov.in. State scholarships usually have their own portals — check your state education board's website.\n\nGeneral steps to apply:\n1. Register on the NSP or state portal with your Aadhaar and bank details.\n2. Fill in your academic and family income details.\n3. Upload scanned copies of required documents.\n4. Submit before the deadline and note your application ID.\n\n💡 Use the **Document Check** tab to prepare and verify your documents before applying!`;
  }

  // Filter matched scholarships to find the best profile matches
  const profileMatches = matched.map(s => {
    const evalResult = evaluateEligibility(s, profile);
    return {
      scholarship: s,
      isEligible: evalResult.isEligible,
      reasons: evalResult.matchReasons,
      mismatches: evalResult.mismatchReasons,
    };
  });

  // Intent A: Deadlines query
  if (isDeadlineQuery) {
    if (matched.length === 0) {
      return `${greeting}You are not currently eligible for any scholarships in our database, so there are no upcoming deadlines to track.\n\nDoes this look correct, or would you like to update your details?`;
    }
    const list = matched.map(s => `• **${s.name}**\n  📅 Deadline: **${s.deadline}**`).join('\n\n');
    return `${greeting}Here are the key deadlines for the opportunities that line up with your profile:\n\n${list}\n\nMake sure to gather your documents and apply before these dates!`;
  }

  // Intent B: Documents query
  if (isDocumentQuery) {
    if (matched.length === 0) {
      return `${greeting}You are not currently eligible for any scholarships in our database, so there are no specific required documents to prepare.\n\nDoes this look correct, or would you like to update your details?`;
    }
    const allDocs = new Set<string>();
    matched.forEach((s) => s.required_documents.forEach((d) => allDocs.add(d)));
    const docList = Array.from(allDocs).map(d => `• ${d}`).join('\n');
    return `${greeting}Based on the scholarships matching your profile, you will generally need to prepare the following documents:\n\n${docList}\n\n💡 *Tip:* You can upload these in the **Document Check** tab for instant OCR validation and verification!`;
  }

  // Intent C: Funding Amount query
  if (isAmountQuery) {
    if (matched.length === 0) {
      return `${greeting}You are not currently eligible for any scholarships in our database, so there are no funding details to display.\n\nDoes this look correct, or would you like to update your details?`;
    }
    const list = matched.map(s => `• **${s.name}**\n  💰 Funding: **${s.funding_amount}**`).join('\n\n');
    return `${greeting}Here is the financial assistance details for the scholarships matching your profile:\n\n${list}\n\nWould you like guidance on the application process for any of these?`;
  }

  // Intent D: Eligibility detail check
  if (isEligibilityQuery) {
    if (profileMatches.length === 0) {
      return `${greeting}I checked your profile (${profile.category} category, ${profile.educationLevel}, ${profile.state} state, ${profile.percentage}% marks) against our database, and it looks like you are not eligible for any scholarships at the moment.\n\nDoes this look correct, or would you like to update your details?`;
    }

    const matchAnalysis = profileMatches.map(m => {
      const header = `• **${m.scholarship.name}** (${m.scholarship.funding_amount})`;
      let details = '';
      if (m.isEligible) {
        details = `  ✅ **Eligible** — Meets criteria: ${m.reasons.slice(0, 3).join(', ')}.`;
      } else {
        details = `  ❌ **Not Eligible** — mismatches:\n` + m.mismatches.map(r => `     - ${r}`).join('\n');
      }
      return `${header}\n${details}`;
    }).join('\n\n');

    return `${greeting}I checked your profile (${profile.category} category, ${profile.educationLevel}, ${profile.state} state, ${profile.percentage}% marks) against the criteria. Here is how you match up:\n\n${matchAnalysis}\n\nDoes this look correct, or would you like to update your details?`;
  }

  // Intent E: General / fallback query
  if (matched.length === 0) {
    return `${greeting}Based on your profile details (Academic score: ${profile.percentage}%, State: ${profile.state}, Category: ${profile.category}), you do not currently qualify for any of the scholarships in our database. You can try updating your profile if any information is incorrect.`;
  }

  const matchSummary = profileMatches.map(m => {
    let matchReason = '';
    if (m.isEligible) {
      matchReason = m.reasons.length > 0 
        ? `\n  *(Meets: ${m.reasons.slice(0, 2).join(' & ')})*`
        : '';
    } else {
      matchReason = `\n  *(Not Eligible: ${m.mismatches.slice(0, 2).join(' & ')})*`;
    }
    return `• **${m.scholarship.name}** — ${m.scholarship.funding_amount}${matchReason}`;
  }).join('\n');

  return `${greeting}Based on your profile details (Academic score: ${profile.percentage}%, State: ${profile.state}, Income: ₹${parseInt(profile.income.replace(/[^0-9]/g, ''), 10).toLocaleString('en-IN')}), here are the most relevant scholarships for you:\n\n${matchSummary}\n\nYou can ask me specific questions about their **eligibility**, **deadlines**, **required documents**, or **funding amounts**!`;
}

export function ragQuery(
  query: string,
  allScholarships: Scholarship[],
  profile?: UserProfile,
): RAGResult {
  const matched = retrieveScholarships(query, allScholarships, profile);
  const answer = generateAnswer(query, matched, profile);
  return { matchedScholarships: matched, answer };
}
