import type { UserProfile, LanguageCode } from '@/lib/types';
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
    queryLower.includes('eligible') || queryLower.includes('eligibility') || queryLower.includes('can i') ||
    queryLower.includes('qualify') || queryLower.includes('fit') || queryLower.includes('match') ||
    queryLower.includes('what are') || queryLower.includes('list') || queryLower.includes('show me') || queryLower.includes('any') ||
    // Hindi
    queryLower.includes('पात्र') || queryLower.includes('योग्य') || queryLower.includes('लायक') ||
    queryLower.includes('एलिजिबल') || queryLower.includes('योग्यता') || queryLower.includes('पात्रता') ||
    queryLower.includes('किसी') || queryLower.includes('कोई') ||
    // Punjabi
    queryLower.includes('ਯੋਗ') || queryLower.includes('ਪਾਤਰ') ||
    // Bengali
    queryLower.includes('যোগ্য') || queryLower.includes('উপযুক্ত') ||
    // Tamil
    queryLower.includes('தகுதி') || queryLower.includes('தகுதியான') ||
    // Telugu
    queryLower.includes('అర్హత') || queryLower.includes('అర్హులు') ||
    // Marathi
    queryLower.includes('पात्रता') || queryLower.includes('योग्यता');

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


// ─── Localized response strings ───────────────────────────────────────────────
// Key phrases translated for each supported language.
// Scholarship names, amounts, and proper nouns stay in English.
type L10nKey =
  | 'greetingHi' | 'greetingHello' | 'greetingSure'
  | 'notEligibleAny'
  | 'noDeadlines' | 'noDocuments' | 'noFunding' | 'noMatch'
  | 'updateProfile'
  | 'eligible' | 'notEligible'
  | 'deadlineIntro' | 'deadlineOutro'
  | 'documentIntro' | 'documentOutro'
  | 'amountIntro' | 'amountOutro'
  | 'eligibilityIntro' | 'eligibilityOutro'
  | 'generalIntro' | 'generalOutro'
  | 'goodbye' | 'noThanks' | 'youreWelcome' | 'happyToHelp' | 'anytime'
  | 'followUp1' | 'followUp2' | 'followUp3'
  | 'deadlineNudge';

const L10N: Record<LanguageCode, Record<L10nKey, string>> = {
  en: {
    greetingHi: 'Hi {name}! ', greetingHello: 'Hello {name}! ', greetingSure: 'Sure, {name}. ',
    notEligibleAny: 'it looks like you are not eligible for any scholarships at the moment.',
    noDeadlines: 'You are not currently eligible for any scholarships, so there are no upcoming deadlines to track.',
    noDocuments: 'You are not currently eligible for any scholarships, so there are no specific required documents to prepare.',
    noFunding: 'You are not currently eligible for any scholarships, so there are no funding details to display.',
    noMatch: "I couldn't find any scholarships closely matching your query. Could you try rephrasing? For example:\n• \"Which scholarships am I eligible for?\"\n• \"What documents do I need?\"\n• \"Show me deadlines for my state\"",
    updateProfile: 'Does this look correct, or would you like to update your details?',
    eligible: '✅ **Eligible** — Meets criteria: ', notEligible: '❌ **Not Eligible** — mismatches:\n',
    deadlineIntro: 'Here are the key deadlines for the opportunities that line up with your profile:',
    deadlineOutro: 'Make sure to gather your documents and apply before these dates!',
    documentIntro: 'Based on the scholarships matching your profile, you will generally need to prepare the following documents:',
    documentOutro: '💡 *Tip:* You can upload these in the **Document Check** tab for instant OCR validation and verification!',
    amountIntro: 'Here is the financial assistance details for the scholarships matching your profile:',
    amountOutro: 'Would you like guidance on the application process for any of these?',
    eligibilityIntro: 'I checked your profile against the criteria. Here is how you match up:',
    eligibilityOutro: 'Does this look correct, or would you like to update your details?',
    generalIntro: 'Based on your profile details, here are the most relevant scholarships for you:',
    generalOutro: 'You can ask me specific questions about their **eligibility**, **deadlines**, **required documents**, or **funding amounts**!',
    goodbye: 'Goodbye{name}! Best of luck with your applications. Come back anytime! 👋',
    noThanks: 'No problem{name}! Let me know if you need anything in the future. Have a great day! 👋',
    youreWelcome: "You're welcome{name}! Is there anything else I can help you with?",
    happyToHelp: 'Happy to help{name}! Feel free to ask anything else.',
    anytime: 'Anytime{name}! All the best with your scholarship applications! 🎓',
    followUp1: 'Is there anything else you\'d like to know?',
    followUp2: 'Anything else I can help with? I can share **deadlines**, **required documents**, or **funding amounts** for your matched scholarships.',
    followUp3: 'Let me know if you want more details — like how to apply, or which documents to prepare!',
    deadlineNudge: '\n\nBy the way, the nearest deadline I see for your profile is **{name}** on **{date}** — don\'t miss it!',
  },
  hi: {
    greetingHi: 'नमस्ते {name}! ', greetingHello: 'हाय {name}, ', greetingSure: 'ज़रूर, {name}। ',
    notEligibleAny: 'ऐसा लगता है कि आप अभी किसी भी छात्रवृत्ति के लिए पात्र नहीं हैं।',
    noDeadlines: 'आप वर्तमान में किसी भी छात्रवृत्ति के लिए पात्र नहीं हैं, इसलिए कोई आगामी समयसीमा नहीं है।',
    noDocuments: 'आप वर्तमान में किसी भी छात्रवृत्ति के लिए पात्र नहीं हैं, इसलिए कोई विशेष दस्तावेज़ की ज़रूरत नहीं है।',
    noFunding: 'आप वर्तमान में किसी भी छात्रवृत्ति के लिए पात्र नहीं हैं, इसलिए कोई फंडिंग विवरण नहीं है।',
    noMatch: 'मुझे आपके प्रश्न से मेल खाती कोई छात्रवृत्ति नहीं मिली। कृपया दूसरे शब्दों में पूछें, जैसे:\n• "मैं किस छात्रवृत्ति के लिए पात्र हूँ?"\n• "मुझे कौन से दस्तावेज़ चाहिए?"\n• "मेरे राज्य की समयसीमाएँ दिखाएं"',
    updateProfile: 'क्या यह सही है, या आप अपनी जानकारी अपडेट करना चाहेंगे?',
    eligible: '✅ **पात्र** — मापदंड पूरे: ', notEligible: '❌ **अपात्र** — बेमेल:\n',
    deadlineIntro: 'आपकी प्रोफाइल से मेल खाती छात्रवृत्तियों की महत्वपूर्ण समयसीमाएँ:',
    deadlineOutro: 'समय रहते दस्तावेज़ तैयार करें और आवेदन करें!',
    documentIntro: 'आपकी प्रोफाइल से मेल खाती छात्रवृत्तियों के लिए आमतौर पर ये दस्तावेज़ चाहिए:',
    documentOutro: '💡 *सुझाव:* इन्हें **Document Check** टैब में अपलोड करें — तुरंत OCR सत्यापन होगा!',
    amountIntro: 'आपकी प्रोफाइल से मेल खाती छात्रवृत्तियों की वित्तीय सहायता:',
    amountOutro: 'क्या आप इनमें से किसी के आवेदन की प्रक्रिया जानना चाहेंगे?',
    eligibilityIntro: 'मैंने आपकी प्रोफाइल मापदंडों से जाँची। यहाँ परिणाम है:',
    eligibilityOutro: 'क्या यह सही है, या आप विवरण अपडेट करना चाहेंगे?',
    generalIntro: 'आपकी प्रोफाइल के अनुसार सबसे उपयुक्त छात्रवृत्तियाँ:',
    generalOutro: 'आप **पात्रता**, **समयसीमा**, **दस्तावेज़**, या **राशि** के बारे में विशेष प्रश्न पूछ सकते हैं!',
    goodbye: 'अलविदा{name}! अपने आवेदन के लिए शुभकामनाएँ। फिर मिलें! 👋',
    noThanks: 'कोई बात नहीं{name}! भविष्य में ज़रूरत पड़े तो बताएं। आपका दिन शुभ हो! 👋',
    youreWelcome: 'आपका स्वागत है{name}! क्या कुछ और मदद चाहिए?',
    happyToHelp: 'मदद करके खुशी हुई{name}! कुछ और पूछना हो तो बताएं।',
    anytime: 'जब चाहें{name}! छात्रवृत्ति के लिए शुभकामनाएँ! 🎓',
    followUp1: 'क्या कुछ और जानना चाहते हैं?',
    followUp2: 'कुछ और मदद चाहिए? मैं **समयसीमा**, **दस्तावेज़**, या **राशि** की जानकारी दे सकता हूँ।',
    followUp3: 'अधिक जानकारी चाहिए तो बताएं — जैसे आवेदन कैसे करें, या कौन से दस्तावेज़ तैयार करें!',
    deadlineNudge: '\n\nवैसे, आपकी प्रोफाइल के लिए सबसे नज़दीकी समयसीमा **{name}** की है — **{date}** तक — चूकें नहीं!',
  },
  pa: {
    greetingHi: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ {name}! ', greetingHello: 'ਹੈਲੋ {name}, ', greetingSure: 'ਜ਼ਰੂਰ, {name}। ',
    notEligibleAny: 'ਲੱਗਦਾ ਹੈ ਕਿ ਤੁਸੀਂ ਇਸ ਵੇਲੇ ਕਿਸੇ ਵੀ ਸਕਾਲਰਸ਼ਿਪ ਲਈ ਯੋਗ ਨਹੀਂ ਹੋ।',
    noDeadlines: 'ਤੁਸੀਂ ਇਸ ਵੇਲੇ ਕਿਸੇ ਵੀ ਸਕਾਲਰਸ਼ਿਪ ਲਈ ਯੋਗ ਨਹੀਂ, ਇਸ ਲਈ ਕੋਈ ਡੈੱਡਲਾਈਨ ਨਹੀਂ।',
    noDocuments: 'ਤੁਸੀਂ ਇਸ ਵੇਲੇ ਕਿਸੇ ਵੀ ਸਕਾਲਰਸ਼ਿਪ ਲਈ ਯੋਗ ਨਹੀਂ, ਇਸ ਲਈ ਕੋਈ ਵਿਸ਼ੇਸ਼ ਦਸਤਾਵੇਜ਼ ਦੀ ਲੋੜ ਨਹੀਂ।',
    noFunding: 'ਤੁਸੀਂ ਇਸ ਵੇਲੇ ਕਿਸੇ ਵੀ ਸਕਾਲਰਸ਼ਿਪ ਲਈ ਯੋਗ ਨਹੀਂ, ਇਸ ਲਈ ਕੋਈ ਫੰਡਿੰਗ ਵੇਰਵਾ ਨਹੀਂ ਹੈ।',
    noMatch: 'ਮੈਨੂੰ ਤੁਹਾਡੇ ਸਵਾਲ ਨਾਲ ਮੇਲ ਖਾਂਦੀ ਕੋਈ ਸਕਾਲਰਸ਼ਿਪ ਨਹੀਂ ਮਿਲੀ। ਕਿਰਪਾ ਕਰਕੇ ਵੱਖਰੇ ਢੰਗ ਨਾਲ ਪੁੱਛੋ।',
    updateProfile: 'ਕੀ ਇਹ ਸਹੀ ਹੈ, ਜਾਂ ਤੁਸੀਂ ਆਪਣੀ ਜਾਣਕਾਰੀ ਅੱਪਡੇਟ ਕਰਨਾ ਚਾਹੋਗੇ?',
    eligible: '✅ **ਯੋਗ** — ਮਾਪਦੰਡ ਪੂਰੇ: ', notEligible: '❌ **ਅਯੋਗ** — ਅਸੰਗਤ:\n',
    deadlineIntro: 'ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਨਾਲ ਮੇਲ ਖਾਂਦੀਆਂ ਸਕਾਲਰਸ਼ਿਪਾਂ ਦੀਆਂ ਡੈੱਡਲਾਈਨਾਂ:',
    deadlineOutro: 'ਸਮੇਂ ਸਿਰ ਦਸਤਾਵੇਜ਼ ਤਿਆਰ ਕਰੋ ਅਤੇ ਅਪਲਾਈ ਕਰੋ!',
    documentIntro: "ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਨਾਲ ਮੇਲ ਖਾਂਦੀਆਂ ਸਕਾਲਰਸ਼ਿਪਾਂ ਲਈ ਆਮ ਤੌਰ \u2018ਤੇ ਇਹ ਦਸਤਾਵੇਜ਼ ਚਾਹੀਦੇ ਹਨ:",
    documentOutro: '💡 *ਸੁਝਾਅ:* ਇਹਨਾਂ ਨੂੰ **Document Check** ਟੈਬ ਵਿੱਚ ਅਪਲੋਡ ਕਰੋ!',
    amountIntro: 'ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਨਾਲ ਮੇਲ ਖਾਂਦੀਆਂ ਸਕਾਲਰਸ਼ਿਪਾਂ ਦੀ ਵਿੱਤੀ ਸਹਾਇਤਾ:',
    amountOutro: 'ਕੀ ਤੁਸੀਂ ਇਹਨਾਂ ਵਿੱਚੋਂ ਕਿਸੇ ਲਈ ਅਰਜ਼ੀ ਦੇਣ ਦੀ ਪ੍ਰਕਿਰਿਆ ਜਾਣਨਾ ਚਾਹੋਗੇ?',
    eligibilityIntro: 'ਮੈਂ ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਮਾਪਦੰਡਾਂ ਨਾਲ ਜਾਂਚੀ। ਨਤੀਜਾ ਇਹ ਹੈ:',
    eligibilityOutro: 'ਕੀ ਇਹ ਸਹੀ ਹੈ, ਜਾਂ ਤੁਸੀਂ ਵੇਰਵੇ ਅੱਪਡੇਟ ਕਰਨਾ ਚਾਹੋਗੇ?',
    generalIntro: "ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਦੇ ਅਧਾਰ \u2018ਤੇ ਸਭ ਤੋਂ ਢੁੱਕਵੀਆਂ ਸਕਾਲਰਸ਼ਿਪਾਂ:",
    generalOutro: 'ਤੁਸੀਂ **ਯੋਗਤਾ**, **ਡੈੱਡਲਾਈਨ**, **ਦਸਤਾਵੇਜ਼**, ਜਾਂ **ਰਕਮ** ਬਾਰੇ ਸਵਾਲ ਪੁੱਛ ਸਕਦੇ ਹੋ!',
    goodbye: 'ਅਲਵਿਦਾ{name}! ਤੁਹਾਡੀਆਂ ਅਰਜ਼ੀਆਂ ਲਈ ਸ਼ੁਭਕਾਮਨਾਵਾਂ। 👋',
    noThanks: 'ਕੋਈ ਗੱਲ ਨਹੀਂ{name}! ਭਵਿੱਖ ਵਿੱਚ ਲੋੜ ਪਵੇ ਤਾਂ ਦੱਸੋ। ਚੰਗਾ ਦਿਨ ਹੋਵੇ! 👋',
    youreWelcome: 'ਜੀ ਆਇਆਂ ਨੂੰ{name}! ਕੁਝ ਹੋਰ ਮਦਦ ਚਾਹੀਦੀ ਹੈ?',
    happyToHelp: 'ਮਦਦ ਕਰਕੇ ਖੁਸ਼ੀ ਹੋਈ{name}!',
    anytime: 'ਜਦੋਂ ਚਾਹੋ{name}! ਸਕਾਲਰਸ਼ਿਪ ਲਈ ਸ਼ੁਭਕਾਮਨਾਵਾਂ! 🎓',
    followUp1: 'ਕੀ ਕੁਝ ਹੋਰ ਜਾਣਨਾ ਚਾਹੁੰਦੇ ਹੋ?',
    followUp2: 'ਕੁਝ ਹੋਰ ਮਦਦ ਚਾਹੀਦੀ ਹੈ? ਮੈਂ **ਡੈੱਡਲਾਈਨ**, **ਦਸਤਾਵੇਜ਼**, ਜਾਂ **ਰਕਮ** ਦੀ ਜਾਣਕਾਰੀ ਦੇ ਸਕਦਾ ਹਾਂ।',
    followUp3: 'ਹੋਰ ਵੇਰਵੇ ਚਾਹੀਦੇ ਹਨ ਤਾਂ ਦੱਸੋ!',
    deadlineNudge: '\n\nਵੈਸੇ, **{name}** ਦੀ ਸਭ ਤੋਂ ਨੇੜੇ ਦੀ ਅੰਤਿਮ ਮਿਤੀ **{date}** ਹੈ — ਖੁੰਝਾਓ ਨਾ!',
  },
  bn: {
    greetingHi: 'নমস্কার {name}! ', greetingHello: 'হ্যালো {name}, ', greetingSure: 'অবশ্যই, {name}। ',
    notEligibleAny: 'মনে হচ্ছে আপনি এখন কোনো বৃত্তির জন্য যোগ্য নন।',
    noDeadlines: 'আপনি এখন কোনো বৃত্তির যোগ্য নন, তাই কোনো শেষ তারিখ নেই।',
    noDocuments: 'আপনি এখন কোনো বৃত্তির যোগ্য নন, তাই কোনো নির্দিষ্ট নথির প্রয়োজন নেই।',
    noFunding: 'আপনি এখন কোনো বৃত্তির যোগ্য নন, তাই কোনো তহবিল বিবরণ নেই।',
    noMatch: 'আপনার প্রশ্নের সাথে মিলে এমন কোনো বৃত্তি পাইনি। অন্যভাবে জিজ্ঞেস করুন।',
    updateProfile: 'এটা কি ঠিক আছে, নাকি আপনি তথ্য আপডেট করতে চান?',
    eligible: '✅ **যোগ্য** — মানদণ্ড পূরণ: ', notEligible: '❌ **অযোগ্য** — অসঙ্গতি:\n',
    deadlineIntro: 'আপনার প্রোফাইলের সাথে মিলে এমন বৃত্তির গুরুত্বপূর্ণ শেষ তারিখসমূহ:',
    deadlineOutro: 'সময়মতো নথি প্রস্তুত করুন এবং আবেদন করুন!',
    documentIntro: 'আপনার প্রোফাইলের সাথে মিলে এমন বৃত্তির জন্য সাধারণত এই নথিগুলো দরকার:',
    documentOutro: '💡 *টিপস:* এগুলো **Document Check** ট্যাবে আপলোড করুন!',
    amountIntro: 'আপনার প্রোফাইলের সাথে মিলে এমন বৃত্তির আর্থিক সহায়তা:',
    amountOutro: 'এর মধ্যে কোনোটির আবেদন প্রক্রিয়া জানতে চান?',
    eligibilityIntro: 'আমি আপনার প্রোফাইল মানদণ্ডের সাথে যাচাই করেছি। ফলাফল:',
    eligibilityOutro: 'এটা কি ঠিক আছে, নাকি বিবরণ আপডেট করতে চান?',
    generalIntro: 'আপনার প্রোফাইল অনুযায়ী সবচেয়ে প্রাসঙ্গিক বৃত্তি:',
    generalOutro: 'আপনি **যোগ্যতা**, **শেষ তারিখ**, **নথি**, বা **পরিমাণ** সম্পর্কে প্রশ্ন করতে পারেন!',
    goodbye: 'বিদায়{name}! আপনার আবেদনে শুভকামনা। আবার আসুন! 👋',
    noThanks: 'কোনো ব্যাপার না{name}! ভবিষ্যতে দরকার হলে জানাবেন। শুভ দিন! 👋',
    youreWelcome: 'স্বাগতম{name}! আর কোনো সাহায্য দরকার?',
    happyToHelp: 'সাহায্য করতে পেরে খুশি{name}!',
    anytime: 'যেকোনো সময়{name}! বৃত্তির জন্য শুভকামনা! 🎓',
    followUp1: 'আর কিছু জানতে চান?',
    followUp2: 'আর কোনো সাহায্য দরকার? আমি **শেষ তারিখ**, **নথি**, বা **পরিমাণ** জানাতে পারি।',
    followUp3: 'আরও বিবরণ জানতে চাইলে জানাবেন!',
    deadlineNudge: '\n\nওহ হ্যাঁ, **{name}** এর সবচেয়ে কাছের শেষ তারিখ **{date}** — মিস করবেন না!',
  },
  ta: {
    greetingHi: 'வணக்கம் {name}! ', greetingHello: 'ஹலோ {name}, ', greetingSure: 'நிச்சயமாக, {name}। ',
    notEligibleAny: 'தற்போது நீங்கள் எந்த உதவித்தொகைக்கும் தகுதியற்றவராக இருக்கிறீர்கள்.',
    noDeadlines: 'நீங்கள் தற்போது எந்த உதவித்தொகைக்கும் தகுதியற்றவர், எனவே கடைசி தேதிகள் இல்லை.',
    noDocuments: 'நீங்கள் தற்போது எந்த உதவித்தொகைக்கும் தகுதியற்றவர், எனவே ஆவணங்கள் தேவையில்லை.',
    noFunding: 'நீங்கள் தற்போது எந்த உதவித்தொகைக்கும் தகுதியற்றவர், எனவே நிதி விவரங்கள் இல்லை.',
    noMatch: 'உங்கள் கேள்விக்கு பொருந்தும் உதவித்தொகை எதுவும் கிடைக்கவில்லை. வேறு வகையில் கேட்கவும்.',
    updateProfile: 'இது சரியா, அல்லது உங்கள் விவரங்களை புதுப்பிக்க விரும்புகிறீர்களா?',
    eligible: '✅ **தகுதியான** — அளவுகோல்கள் பூர்த்தி: ', notEligible: '❌ **தகுதியற்ற** — பொருந்தாதவை:\n',
    deadlineIntro: 'உங்கள் சுயவிவரத்திற்கு பொருந்தும் உதவித்தொகைகளின் கடைசி தேதிகள்:',
    deadlineOutro: 'கடைசி தேதிக்கு முன் ஆவணங்களை தயார் செய்து விண்ணப்பிக்கவும்!',
    documentIntro: 'உங்கள் சுயவிவரத்திற்கு பொருந்தும் உதவித்தொகைகளுக்கு பொதுவாக தேவையான ஆவணங்கள்:',
    documentOutro: '💡 *குறிப்பு:* இவற்றை **Document Check** தாவலில் பதிவேற்றவும்!',
    amountIntro: 'உங்கள் சுயவிவரத்திற்கு பொருந்தும் உதவித்தொகைகளின் நிதி உதவி விவரங்கள்:',
    amountOutro: 'இவற்றில் ஏதாவது ஒன்றுக்கு விண்ணப்பிக்கும் முறை அறிய விரும்புகிறீர்களா?',
    eligibilityIntro: 'உங்கள் சுயவிவரத்தை அளவுகோல்களுடன் சரிபார்த்தேன். முடிவு:',
    eligibilityOutro: 'இது சரியா, அல்லது விவரங்களை மாற்ற விரும்புகிறீர்களா?',
    generalIntro: 'உங்கள் சுயவிவரத்தின்படி மிகவும் பொருத்தமான உதவித்தொகைகள்:',
    generalOutro: 'நீங்கள் **தகுதி**, **கடைசி தேதி**, **ஆவணங்கள்**, அல்லது **தொகை** பற்றி கேட்கலாம்!',
    goodbye: 'வணக்கம்{name}! உங்கள் விண்ணப்பங்களில் வெற்றி பெறுங்கள். மீண்டும் வாருங்கள்! 👋',
    noThanks: 'பரவாயில்லை{name}! தேவை ஏற்பட்டால் தெரியப்படுத்துங்கள். நல்ல நாள்! 👋',
    youreWelcome: 'மகிழ்ச்சி{name}! வேறு ஏதாவது உதவி வேண்டுமா?',
    happyToHelp: 'உதவி செய்ய மகிழ்ச்சி{name}!',
    anytime: 'எப்போதும்{name}! உதவித்தொகைக்கு வாழ்த்துகள்! 🎓',
    followUp1: 'வேறு ஏதாவது தெரிந்துகொள்ள விரும்புகிறீர்களா?',
    followUp2: 'வேறு உதவி வேண்டுமா? **கடைசி தேதி**, **ஆவணங்கள்**, அல்லது **தொகை** பற்றி சொல்லலாம்.',
    followUp3: 'மேலும் விவரங்கள் வேண்டுமா? கேட்கவும்!',
    deadlineNudge: '\n\nமேலும், **{name}** இன் நெருங்கிய கடைசி தேதி **{date}** — தவறாதீர்கள்!',
  },
  te: {
    greetingHi: 'నమస్కారం {name}! ', greetingHello: 'హలో {name}, ', greetingSure: 'తప్పకుండా, {name}। ',
    notEligibleAny: 'మీరు ప్రస్తుతం ఏ స్కాలర్‌షిప్‌కూ అర్హులు కాదు.',
    noDeadlines: 'మీరు ప్రస్తుతం ఏ స్కాలర్‌షిప్‌కూ అర్హులు కాదు, కాబట్టి ఆఖరి తేదీలు లేవు.',
    noDocuments: 'మీరు ప్రస్తుతం ఏ స్కాలర్‌షిప్‌కూ అర్హులు కాదు, కాబట్టి ప్రత్యేక పత్రాలు అవసరం లేదు.',
    noFunding: 'మీరు ప్రస్తుతం ఏ స్కాలర్‌షిప్‌కూ అర్హులు కాదు, కాబట్టి ఫండింగ్ వివరాలు లేవు.',
    noMatch: 'మీ ప్రశ్నకు సరిపోయే స్కాలర్‌షిప్ ఏదీ కనుగొనలేదు. వేరే విధంగా అడగండి.',
    updateProfile: 'ఇది సరైనదా, లేదా మీ వివరాలు అప్‌డేట్ చేయాలనుకుంటున్నారా?',
    eligible: '✅ **అర్హులు** — ప్రమాణాలు తీర్చారు: ', notEligible: '❌ **అర్హులు కారు** — అసంగత:\n',
    deadlineIntro: 'మీ ప్రొఫైల్‌కు సరిపోయే స్కాలర్‌షిప్‌ల చివరి తేదీలు:',
    deadlineOutro: 'గడువు తేదీకి ముందే పత్రాలు సిద్ధం చేసి దరఖాస్తు చేయండి!',
    documentIntro: 'మీ ప్రొఫైల్‌కు సరిపోయే స్కాలర్‌షిప్‌లకు సాధారణంగా అవసరమైన పత్రాలు:',
    documentOutro: '💡 *చిట్కా:* వాటిని **Document Check** టాబ్‌లో అప్‌లోడ్ చేయండి!',
    amountIntro: 'మీ ప్రొఫైల్‌కు సరిపోయే స్కాలర్‌షిప్‌ల ఆర్థిక సహాయ వివరాలు:',
    amountOutro: 'వీటిలో దేనికైనా దరఖాస్తు ప్రక్రియ తెలుసుకోవాలా?',
    eligibilityIntro: 'మీ ప్రొఫైల్‌ను ప్రమాణాలతో తనిఖీ చేశాను. ఫలితం:',
    eligibilityOutro: 'ఇది సరైనదా, లేదా వివరాలు మార్చాలా?',
    generalIntro: 'మీ ప్రొఫైల్ వివరాల ఆధారంగా అత్యంత సంబంధిత స్కాలర్‌షిప్‌లు:',
    generalOutro: 'మీరు **అర్హత**, **గడువు తేదీ**, **పత్రాలు**, లేదా **మొత్తం** గురించి అడగవచ్చు!',
    goodbye: 'వీడ్కోలు{name}! మీ దరఖాస్తులు విజయవంతంగా ఉండాలి. మళ్ళీ రండి! 👋',
    noThanks: 'పర్వాలేదు{name}! భవిష్యత్తులో అవసరమైతే తెలియజేయండి. శుభ దినం! 👋',
    youreWelcome: 'స్వాగతం{name}! వేరే సహాయం కావాలా?',
    happyToHelp: 'సహాయం చేయడం సంతోషం{name}!',
    anytime: 'ఎప్పుడైనా{name}! స్కాలర్‌షిప్‌కు శుభాకాంక్షలు! 🎓',
    followUp1: 'మరి ఏదైనా తెలుసుకోవాలా?',
    followUp2: 'మరి సహాయం కావాలా? **గడువు తేదీ**, **పత్రాలు**, లేదా **మొత్తం** చెప్పగలను.',
    followUp3: 'మరిన్ని వివరాలు కావాలంటే అడగండి!',
    deadlineNudge: '\n\nమీ ప్రొఫైల్‌కు **{name}** యొక్క సమీప గడువు తేదీ **{date}** — మర్చిపోకండి!',
  },
  mr: {
    greetingHi: 'नमस्कार {name}! ', greetingHello: 'हॅलो {name}, ', greetingSure: 'नक्कीच, {name}। ',
    notEligibleAny: 'सध्या तुम्ही कोणत्याही शिष्यवृत्तीसाठी पात्र नाही असे दिसते.',
    noDeadlines: 'तुम्ही सध्या कोणत्याही शिष्यवृत्तीसाठी पात्र नाही, त्यामुळे कोणत्याही अंतिम तारखा नाहीत.',
    noDocuments: 'तुम्ही सध्या कोणत्याही शिष्यवृत्तीसाठी पात्र नाही, त्यामुळे विशेष कागदपत्रांची गरज नाही.',
    noFunding: 'तुम्ही सध्या कोणत्याही शिष्यवृत्तीसाठी पात्र नाही, त्यामुळे निधी तपशील नाहीत.',
    noMatch: 'तुमच्या प्रश्नाशी जुळणारी कोणतीही शिष्यवृत्ती सापडली नाही. वेगळ्या प्रकारे विचारा.',
    updateProfile: 'हे बरोबर आहे का, किंवा तुम्हाला माहिती अद्यतनित करायची आहे का?',
    eligible: '✅ **पात्र** — निकष पूर्ण: ', notEligible: '❌ **अपात्र** — विसंगती:\n',
    deadlineIntro: 'तुमच्या प्रोफाइलशी जुळणाऱ्या शिष्यवृत्तींच्या महत्त्वाच्या अंतिम तारखा:',
    deadlineOutro: 'वेळेत कागदपत्रे तयार करा आणि अर्ज करा!',
    documentIntro: 'तुमच्या प्रोफाइलशी जुळणाऱ्या शिष्यवृत्तींसाठी सामान्यतः हे कागदपत्रे लागतात:',
    documentOutro: '💡 *टीप:* हे **Document Check** टॅबमध्ये अपलोड करा!',
    amountIntro: 'तुमच्या प्रोफाइलशी जुळणाऱ्या शिष्यवृत्तींचे आर्थिक सहाय्य तपशील:',
    amountOutro: 'यापैकी कोणत्याही शिष्यवृत्तीसाठी अर्ज प्रक्रिया जाणून घ्यायची आहे का?',
    eligibilityIntro: 'मी तुमची प्रोफाइल निकषांशी तपासली. निकाल:',
    eligibilityOutro: 'हे बरोबर आहे का, किंवा तपशील बदलायचे आहेत का?',
    generalIntro: 'तुमच्या प्रोफाइल तपशीलांनुसार सर्वात संबंधित शिष्यवृत्ती:',
    generalOutro: 'तुम्ही **पात्रता**, **अंतिम तारीख**, **कागदपत्रे**, किंवा **रक्कम** बद्दल प्रश्न विचारू शकता!',
    goodbye: 'निरोप{name}! तुमच्या अर्जांना शुभेच्छा. पुन्हा या! 👋',
    noThanks: 'ठीक आहे{name}! भविष्यात गरज पडल्यास सांगा. शुभ दिन! 👋',
    youreWelcome: 'आपले स्वागत आहे{name}! आणखी काही मदत हवी आहे का?',
    happyToHelp: 'मदत करून आनंद झाला{name}!',
    anytime: 'केव्हाही{name}! शिष्यवृत्तीसाठी शुभेच्छा! 🎓',
    followUp1: 'आणखी काही जाणून घ्यायचे आहे का?',
    followUp2: 'आणखी मदत हवी आहे का? मी **अंतिम तारीख**, **कागदपत्रे**, किंवा **रक्कम** सांगू शकतो.',
    followUp3: 'अधिक तपशील हवे असल्यास विचारा!',
    deadlineNudge: '\n\nवैसे, **{name}** ची सर्वात जवळची अंतिम तारीख **{date}** आहे — चुकवू नका!',
  },
};

function l10n(lang: LanguageCode, key: L10nKey, vars: Record<string, string> = {}): string {
  const strings = L10N[lang] ?? L10N.en;
  let str = strings[key] ?? (L10N.en[key] as string);
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

export function generateAnswer(
  query: string,
  matched: Scholarship[],
  profile?: UserProfile,
  lang: LanguageCode = 'en',
): string {
  const lowerQuery = query.toLowerCase();
  const trimmed = lowerQuery.trim();
  // Name token — used in greetings across all intents
  const n = profile?.name ? ` ${profile.name.trim()}` : '';

  const greetingKeywords = [
    'hi', 'hello', 'hey', 'namaste', 'hola', 'greetings', 'pranam',
    'pranams', 'vanakkam', 'satsriakal', 'adaab', 'yo', 'good morning',
    'good afternoon', 'good evening',
    'नमस्ते', 'नमस्कार', 'हाय', 'सुप्रभात',        // Hindi
    'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', 'ਹੈਲੋ',                          // Punjabi
    'নমস্কার', 'হ্যালো',                              // Bengali
    'வணக்கம்', 'ஹலோ',                                // Tamil
    'నమస్కారం', 'హలో',                               // Telugu
    'नमस्कार', 'हॅलो',                               // Marathi
  ];
  
  const isCasualGreeting = greetingKeywords.some(g => {
    return trimmed === g || 
           trimmed === `${g}!` || 
           trimmed === `${g}.` || 
           trimmed === `${g} there` || 
           trimmed === `${g} friend`;
  });

  if (isCasualGreeting) {
    const greet = l10n(lang, 'greetingHi', { name: n.trim() || '' }).replace('  ', 'Hi! ');
    const helpLine: Record<LanguageCode, string[]> = {
      en: [
        'How can I help you with your scholarship search? 😊',
        'Ready to help you find the right scholarship! 🎓',
        'What would you like to know — eligibility, deadlines, or documents? 😊',
      ],
      hi: [
        'छात्रवृत्ति के बारे में क्या जानना है? 😊',
        'आपकी छात्रवृत्ति खोज में मदद के लिए तैयार हूँ! 🎓',
        'पात्रता, समयसीमा, या दस्तावेज़ — क्या जानना चाहते हैं? 😊',
      ],
      pa: [
        'ਸਕਾਲਰਸ਼ਿਪ ਬਾਰੇ ਕੀ ਜਾਣਨਾ ਚਾਹੁੰਦੇ ਹੋ? 😊',
        'ਤੁਹਾਡੀ ਸਕਾਲਰਸ਼ਿਪ ਖੋਜ ਵਿੱਚ ਮਦਦ ਲਈ ਤਿਆਰ! 🎓',
        'ਯੋਗਤਾ, ਡੈੱਡਲਾਈਨ, ਜਾਂ ਦਸਤਾਵੇਜ਼ — ਕੀ ਜਾਣਨਾ ਹੈ? 😊',
      ],
      bn: [
        'বৃত্তি সম্পর্কে কী জানতে চান? 😊',
        'আপনার বৃত্তি খোঁজতে সাহায্য করতে প্রস্তুত! 🎓',
        'যোগ্যতা, সময়সীমা, বা নথি — কী জানতে চান? 😊',
      ],
      ta: [
        'உதவித்தொகை பற்றி என்ன தெரிந்துகொள்ள விரும்புகிறீர்கள்? 😊',
        'உதவித்தொகை தேடலில் உதவ தயாராக இருக்கிறேன்! 🎓',
        'தகுதி, கடைசி தேதி, அல்லது ஆவணங்கள் — என்ன கேட்கிறீர்கள்? 😊',
      ],
      te: [
        'స్కాలర్‌షిప్ గురించి ఏమి తెలుసుకోవాలనుకుంటున్నారు? 😊',
        'మీ స్కాలర్‌షిప్ వెతుకులాటలో సహాయపడటానికి సిద్ధంగా ఉన్నాను! 🎓',
        'అర్హత, గడువు తేదీ, లేదా పత్రాలు — ఏమి అడగాలనుకుంటున్నారు? 😊',
      ],
      mr: [
        'शिष्यवृत्तीबद्दल काय जाणून घ्यायचे आहे? 😊',
        'तुमच्या शिष्यवृत्ती शोधात मदत करण्यास तयार! 🎓',
        'पात्रता, अंतिम तारीख, किंवा कागदपत्रे — काय विचारायचे आहे? 😊',
      ],
    };
    const opts = helpLine[lang] ?? helpLine.en;
    return `${greet}${opts[Math.floor(Math.random() * opts.length)]}`;
  }
  
  // 1. Check if user has completed onboarding profile
  if (!profile) {
    return `Hi! I noticed you haven't filled out your eligibility profile yet. Completing onboarding helps me verify matching requirements accurately. In the meantime, here are ${matched.length} scholarships matching your search:\n\n` +
      matched.map(s => `• **${s.name}**: ${s.funding_amount} (${s.eligibility_criteria.substring(0, 100)}...)`).join('\n') +
      `\n\nWould you like to complete onboarding or ask about specific deadlines, eligibility, or documents?`;
  }



  // 2. Identify the core intent — English + Hindi + Punjabi + Bengali + Tamil + Telugu + Marathi
  const isDeadlineQuery =
    lowerQuery.includes('deadline') || lowerQuery.includes('last date') || lowerQuery.includes('when') ||
    lowerQuery.includes('अंतिम तिथि') || lowerQuery.includes('समयसीमा') || lowerQuery.includes('कब') || lowerQuery.includes('तारीख') ||
    lowerQuery.includes('ਡੈੱਡਲਾਈਨ') || lowerQuery.includes('ਅੰਤਿਮ ਮਿਤੀ') ||
    lowerQuery.includes('শেষ তারিখ') || lowerQuery.includes('কখন') ||
    lowerQuery.includes('கடைசி தேதி') || lowerQuery.includes('எப்போது') ||
    lowerQuery.includes('గడువు') || lowerQuery.includes('ఆఖరి తేదీ') ||
    lowerQuery.includes('अंतिम तारीख') || lowerQuery.includes('अंतिम तारखा');

  const isDocumentQuery =
    lowerQuery.includes('document') || lowerQuery.includes('paper') || lowerQuery.includes('proof') || lowerQuery.includes('upload') ||
    lowerQuery.includes('दस्तावेज') || lowerQuery.includes('कागज') || lowerQuery.includes('प्रमाण') ||
    lowerQuery.includes('ਦਸਤਾਵੇਜ਼') || lowerQuery.includes('ਕਾਗਜ਼') ||
    lowerQuery.includes('নথি') || lowerQuery.includes('কাগজ') ||
    lowerQuery.includes('ஆவணம்') || lowerQuery.includes('ஆவணங்கள்') ||
    lowerQuery.includes('పత్రాలు') || lowerQuery.includes('పత్రం') ||
    lowerQuery.includes('कागदपत्र') || lowerQuery.includes('कागदपत्रे');

  const isAmountQuery =
    lowerQuery.includes('amount') || lowerQuery.includes('money') || lowerQuery.includes('funding') || lowerQuery.includes('how much') || lowerQuery.includes('stipend') ||
    lowerQuery.includes('राशि') || lowerQuery.includes('पैसे') || lowerQuery.includes('कितना') || lowerQuery.includes('धनराशि') ||
    lowerQuery.includes('ਰਕਮ') || lowerQuery.includes('ਪੈਸੇ') || lowerQuery.includes('ਕਿੰਨੇ') ||
    lowerQuery.includes('পরিমাণ') || lowerQuery.includes('কত') || lowerQuery.includes('টাকা') ||
    lowerQuery.includes('தொகை') || lowerQuery.includes('எவ்வளவு') ||
    lowerQuery.includes('మొత్తం') || lowerQuery.includes('ఎంత') ||
    lowerQuery.includes('रक्कम') || lowerQuery.includes('किती');

  const isEligibilityQuery =
    lowerQuery.includes('eligible') || lowerQuery.includes('eligibility') || lowerQuery.includes('can i') || lowerQuery.includes('qualify') || lowerQuery.includes('fit') || lowerQuery.includes('match') ||
    lowerQuery.includes('पात्र') || lowerQuery.includes('योग्य') || lowerQuery.includes('लायक') || lowerQuery.includes('एलिजिबल') || lowerQuery.includes('योग्यता') ||
    lowerQuery.includes('ਯੋਗ') || lowerQuery.includes('ਪਾਤਰ') ||
    lowerQuery.includes('যোগ্য') || lowerQuery.includes('উপযুক্ত') ||
    lowerQuery.includes('தகுதி') || lowerQuery.includes('தகுதியான') ||
    lowerQuery.includes('అర్హత') || lowerQuery.includes('అర్హులు') ||
    lowerQuery.includes('पात्रता') || lowerQuery.includes('योग्यता');

  const isApplyQuery =
    lowerQuery.includes('apply') || lowerQuery.includes('application') || lowerQuery.includes('register') || lowerQuery.includes('how to get') || lowerQuery.includes('apply online') || lowerQuery.includes('nsp') || lowerQuery.includes('portal') ||
    lowerQuery.includes('आवेदन') || lowerQuery.includes('अप्लाई') || lowerQuery.includes('अर्जी') || lowerQuery.includes('कैसे मिलेगा') ||
    lowerQuery.includes('ਅਰਜ਼ੀ') || lowerQuery.includes('ਅਪਲਾਈ') ||
    lowerQuery.includes('আবেদন') || lowerQuery.includes('আবেদন করুন') ||
    lowerQuery.includes('விண்ணப்பி') || lowerQuery.includes('விண்ணப்பம்') ||
    lowerQuery.includes('దరఖాస్తు') || lowerQuery.includes('అప్లై') ||
    lowerQuery.includes('अर्ज') || lowerQuery.includes('अर्ज करा');

  const isHelpQuery =
    trimmed === 'help' || trimmed === 'help me' || lowerQuery.includes('what can you do') || lowerQuery.includes('what can you help') || lowerQuery.includes('tell me about yourself') || lowerQuery.includes('what are you') ||
    lowerQuery.includes('मदद') || lowerQuery.includes('सहायता') || lowerQuery.includes('क्या कर सकते') ||
    lowerQuery.includes('ਮਦਦ') || lowerQuery.includes('ਸਹਾਇਤਾ') ||
    lowerQuery.includes('সাহায্য') || lowerQuery.includes('সহায়তা') ||
    lowerQuery.includes('உதவி') || lowerQuery.includes('ஆதரவு') ||
    lowerQuery.includes('సహాయం') || lowerQuery.includes('మీరు') ||
    lowerQuery.includes('मदत') || lowerQuery.includes('सहाय्य');

  const isThanksQuery =
    lowerQuery.includes('thank') || trimmed === 'thanks' || trimmed === 'ty' ||
    lowerQuery.includes('dhanyawad') || lowerQuery.includes('shukriya') ||
    lowerQuery.includes('धन्यवाद') || lowerQuery.includes('शुक्रिया') || lowerQuery.includes('शुक्र') ||
    lowerQuery.includes('ਧੰਨਵਾਦ') || lowerQuery.includes('ਸ਼ੁਕਰੀਆ') ||
    lowerQuery.includes('ধন্যবাদ') || lowerQuery.includes('শুক্রিয়া') ||
    lowerQuery.includes('நன்றி') || lowerQuery.includes('நன்றிகள்') ||
    lowerQuery.includes('ధన్యవాదాలు') || lowerQuery.includes('థాంక్స్') ||
    lowerQuery.includes('धन्यवाद') || lowerQuery.includes('आभार') ||
    trimmed === 'great' || trimmed === 'awesome' || trimmed === 'perfect';

  const isGoodbyeQuery =
    trimmed === 'bye' || trimmed === 'goodbye' || trimmed === 'see you' || trimmed === 'ok bye' ||
    lowerQuery.includes('alvida') || lowerQuery.includes('अलविदा') || lowerQuery.includes('बाय') ||
    lowerQuery.includes('ਅਲਵਿਦਾ') || lowerQuery.includes('ਬਾਅ') ||
    lowerQuery.includes('বিদায়') || lowerQuery.includes('আলবিদা') ||
    lowerQuery.includes('விடை') || lowerQuery.includes('சலோ') ||
    lowerQuery.includes('వీడ్కోలు') || lowerQuery.includes('బై') ||
    lowerQuery.includes('निरोप') || lowerQuery.includes('बाय');

  const isDenialQuery =
    trimmed === 'no' || trimmed === 'nah' || trimmed === 'no thanks' || trimmed === 'no thank you' || trimmed === 'nothing' || trimmed === 'nothing else' ||
    lowerQuery.includes('no i am good') || lowerQuery.includes("no i'm good") || lowerQuery.includes('no that is all') || lowerQuery.includes("no that's all") ||
    lowerQuery.includes('नहीं') || trimmed === 'नही' || lowerQuery.includes('नहीं चाहिए') ||
    lowerQuery.includes('ਨਹੀਂ') || lowerQuery.includes('ਕੋਈ ਗੱਲ ਨਹੀਂ') ||
    lowerQuery.includes('না') || lowerQuery.includes('দরকার নেই') ||
    lowerQuery.includes('வேண்டாம்') || lowerQuery.includes('இல்லை') ||
    lowerQuery.includes('వద్దు') || lowerQuery.includes('లేదు') ||
    lowerQuery.includes('नको') || lowerQuery.includes('नाही');

  // ── Name token for greeting ──────────────────────────────────────────────────
  const greeting = (() => {
    const pick = Math.floor(Math.random() * 3);
    if (pick === 0) return l10n(lang, 'greetingHi',     { name: n.trim() || '' }).replace('  ', ' ');
    if (pick === 1) return l10n(lang, 'greetingHello',  { name: n.trim() || '' }).replace('  ', ' ');
    return               l10n(lang, 'greetingSure',  { name: n.trim() || '' }).replace('  ', ' ');
  })();

  // Intent: Goodbye
  if (isGoodbyeQuery) return l10n(lang, 'goodbye', { name: n });

  // Intent: Denial
  if (isDenialQuery) {
    const replies = ['noThanks', 'noThanks', 'goodbye'] as const;
    return l10n(lang, replies[Math.floor(Math.random() * replies.length)], { name: n });
  }

  // Intent: Thank you
  if (isThanksQuery) {
    const replies = ['youreWelcome', 'happyToHelp', 'anytime'] as const;
    return l10n(lang, replies[Math.floor(Math.random() * replies.length)], { name: n });
  }

  // Intent: Dry / one-word acknowledgement
  const dryResponses = ['ok', 'okay', 'k', 'cool', 'alright', 'alrite', 'got it', 'gotit', 'noted', 'sure', 'fine', 'hmm', 'nice', 'right', 'ohk', 'ohkay', 'oh ok', 'i see', 'understood', 'makes sense',
    'ठीक', 'अच्छा', 'समझ गया', 'बढ़िया', // Hindi dry
    'ਠੀਕ', 'ਚੰਗਾ', // Punjabi dry
    'ঠিক', 'ভালো', // Bengali dry
    'சரி', 'நல்லது', // Tamil dry
    'సరే', 'అర్థమైంది', // Telugu dry
    'ठीक आहे', 'बरं', // Marathi dry
  ];
  const isDryResponse = dryResponses.some(d => trimmed === d || trimmed === `${d}.` || trimmed === `${d}!`);

  if (isDryResponse) {
    const deadlineNudge = matched.length > 0
      ? l10n(lang, 'deadlineNudge', { name: matched[0].name, date: matched[0].deadline })
      : '';
    const followUps = [
      l10n(lang, 'followUp1') + deadlineNudge,
      l10n(lang, 'followUp2'),
      l10n(lang, 'followUp3'),
    ];
    return followUps[Math.floor(Math.random() * followUps.length)];
  }

  // Intent: Help
  if (isHelpQuery) {
    const greet = n.trim() ? l10n(lang, 'greetingHi', { name: n.trim() }) : l10n(lang, 'greetingHi', { name: '' }).replace('  ', 'Hi! ');
    return `${greet}I'm your YojanaGati scholarship assistant. Here's what I can help you with:\n\n• 🎓 **Which scholarships am I eligible for?** — I'll match against your profile.\n• 📅 **Scholarship deadlines** — I'll tell you what's coming up.\n• 📄 **What documents do I need?** — I'll list the required papers.\n• 💰 **How much funding will I get?** — I'll share the amounts.\n• 🌐 **How do I apply?** — I'll point you to the right portal.\n\nJust type your question naturally and I'll do my best to help!`;
  }

  // Intent: Apply
  if (isApplyQuery) {
    const topScholarship = matched[0];
    const portalHint = topScholarship ? `For **${topScholarship.name}**, the provider is **${topScholarship.provider}**. ` : '';
    return `${greeting}${portalHint}Most central government scholarships are applied for through the **National Scholarship Portal (NSP)** at scholarships.gov.in. State scholarships usually have their own portals.\n\nGeneral steps to apply:\n1. Register on the NSP or state portal with your Aadhaar and bank details.\n2. Fill in your academic and family income details.\n3. Upload scanned copies of required documents.\n4. Submit before the deadline and note your application ID.\n\n💡 Use the **Document Check** tab to prepare and verify your documents before applying!`;
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
    if (matched.length === 0) return `${greeting}${l10n(lang, 'noDeadlines')}\n\n${l10n(lang, 'updateProfile')}`;
    const list = matched.map(s => `• **${s.name}**\n  📅 Deadline: **${s.deadline}**`).join('\n\n');
    return `${greeting}${l10n(lang, 'deadlineIntro')}\n\n${list}\n\n${l10n(lang, 'deadlineOutro')}`;
  }

  // Intent B: Documents query
  if (isDocumentQuery) {
    if (matched.length === 0) return `${greeting}${l10n(lang, 'noDocuments')}\n\n${l10n(lang, 'updateProfile')}`;
    const allDocs = new Set<string>();
    matched.forEach((s) => s.required_documents.forEach((d) => allDocs.add(d)));
    const docList = Array.from(allDocs).map(d => `• ${d}`).join('\n');
    return `${greeting}${l10n(lang, 'documentIntro')}\n\n${docList}\n\n${l10n(lang, 'documentOutro')}`;
  }

  // Intent C: Funding Amount query
  if (isAmountQuery) {
    if (matched.length === 0) return `${greeting}${l10n(lang, 'noFunding')}\n\n${l10n(lang, 'updateProfile')}`;
    const list = matched.map(s => `• **${s.name}**\n  💰 Funding: **${s.funding_amount}**`).join('\n\n');
    return `${greeting}${l10n(lang, 'amountIntro')}\n\n${list}\n\n${l10n(lang, 'amountOutro')}`;
  }

  // Intent D: Eligibility detail check
  if (isEligibilityQuery) {
    if (profileMatches.length === 0) {
      return `${greeting}${l10n(lang, 'notEligibleAny')}\n\n${l10n(lang, 'updateProfile')}`;
    }
    const matchAnalysis = profileMatches.map(m => {
      const header = `• **${m.scholarship.name}** (${m.scholarship.funding_amount})`;
      const details = m.isEligible
        ? `  ${l10n(lang, 'eligible')}${m.reasons.slice(0, 3).join(', ')}.`
        : `  ${l10n(lang, 'notEligible')}` + m.mismatches.map(r => `     - ${r}`).join('\n');
      return `${header}\n${details}`;
    }).join('\n\n');
    return `${greeting}${l10n(lang, 'eligibilityIntro')}\n\n${matchAnalysis}\n\n${l10n(lang, 'eligibilityOutro')}`;
  }

  // Intent E: General / fallback query
  if (matched.length === 0) {
    return `${greeting}${l10n(lang, 'notEligibleAny')}\n\n${l10n(lang, 'updateProfile')}`;
  }

  const matchSummary = profileMatches.map(m => {
    const matchReason = m.isEligible
      ? (m.reasons.length > 0 ? `\n  *(Meets: ${m.reasons.slice(0, 2).join(' & ')})*` : '')
      : `\n  *(Not Eligible: ${m.mismatches.slice(0, 2).join(' & ')})*`;
    return `• **${m.scholarship.name}** — ${m.scholarship.funding_amount}${matchReason}`;
  }).join('\n');

  return `${greeting}${l10n(lang, 'generalIntro')}\n\n${matchSummary}\n\n${l10n(lang, 'generalOutro')}`;
}

export function ragQuery(
  query: string,
  allScholarships: Scholarship[],
  profile?: UserProfile,
  lang: LanguageCode = 'en',
): RAGResult {
  const matched = retrieveScholarships(query, allScholarships, profile);
  const answer = generateAnswer(query, matched, profile, lang);
  return { matchedScholarships: matched, answer };
}

