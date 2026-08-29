const fs = require('fs');
let content = fs.readFileSync('src/lib/i18n.ts', 'utf8');

content = content.replace(/\|\s*'landingTrustTitle';/, "| 'landingTrustTitle'\n  | 'profile';");

const translations = {
  en: 'Profile',
  hi: 'प्रोफ़ाइल',
  pa: 'ਪ੍ਰੋਫਾਈਲ',
  bn: 'প্রোফাইল',
  ta: 'சுயவிவரம்',
  te: 'ప్రొఫైల్',
  mr: 'प्रोफाइल'
};

for (const [lang, trans] of Object.entries(translations)) {
  const regex = new RegExp(`(${lang}: \\{[\\s\\S]*?landingTrustTitle: '[^']+',)(\\n  \\},?)`);
  content = content.replace(regex, `$1\n    profile: '${trans}',$2`);
}

fs.writeFileSync('src/lib/i18n.ts', content);
