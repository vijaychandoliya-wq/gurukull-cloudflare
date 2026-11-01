export const messages = {
  en: {
    language: 'Language',
    appearance: 'Appearance',
    saveLanguage: 'Save language preference',
    languageSaved: 'Language preference saved.',
    languageHelp: 'Choose the language used on this device. Save it here to use the same preference after signing in on another device.',
    welcomeBack: 'Welcome back',
    signInSubtitle: 'Sign in once to continue to your role-based Gurukul portal.',
    schoolCode: 'School code',
    identifier: 'Mobile number or email address',
    password: 'Password or administrator access key',
    signIn: 'Sign in securely',
    profileLanguage: 'Language preference',
  },
  hi: {
    language: 'भाषा', appearance: 'रूप', saveLanguage: 'भाषा वरीयता सहेजें', languageSaved: 'भाषा वरीयता सहेजी गई।',
    languageHelp: 'इस डिवाइस पर उपयोग होने वाली भाषा चुनें। अन्य डिवाइस पर साइन इन करने पर भी यही विकल्प पाने के लिए इसे सहेजें।',
    welcomeBack: 'वापसी पर स्वागत है', signInSubtitle: 'अपनी भूमिका के अनुसार गुरुकुल पोर्टल में जाने के लिए साइन इन करें।',
    schoolCode: 'विद्यालय कोड', identifier: 'मोबाइल नंबर या ईमेल पता', password: 'पासवर्ड या व्यवस्थापक एक्सेस कुंजी', signIn: 'सुरक्षित रूप से साइन इन करें', profileLanguage: 'भाषा वरीयता',
  },
  ta: {
    language: 'மொழி', appearance: 'தோற்றம்', saveLanguage: 'மொழி விருப்பத்தைச் சேமி', languageSaved: 'மொழி விருப்பம் சேமிக்கப்பட்டது.',
    languageHelp: 'இந்தச் சாதனத்தில் பயன்படுத்த வேண்டிய மொழியைத் தேர்ந்தெடுக்கவும். பிற சாதனங்களிலும் இதே விருப்பத்தைப் பயன்படுத்த இங்கே சேமிக்கவும்.',
    welcomeBack: 'மீண்டும் வரவேற்கிறோம்', signInSubtitle: 'உங்கள் பங்கிற்கான குருகுல் தளத்தைத் தொடர உள்நுழையவும்.',
    schoolCode: 'பள்ளிக் குறியீடு', identifier: 'மொபைல் எண் அல்லது மின்னஞ்சல் முகவரி', password: 'கடவுச்சொல் அல்லது நிர்வாக அணுகல் விசை', signIn: 'பாதுகாப்பாக உள்நுழைக', profileLanguage: 'மொழி விருப்பம்',
  },
  ur: {
    language: 'زبان', appearance: 'ظاہری شکل', saveLanguage: 'زبان کی ترجیح محفوظ کریں', languageSaved: 'زبان کی ترجیح محفوظ ہو گئی۔',
    languageHelp: 'اس آلے پر استعمال ہونے والی زبان منتخب کریں۔ دوسرے آلے پر سائن ان کرنے کے بعد بھی یہی ترجیح رکھنے کے لیے اسے محفوظ کریں۔',
    welcomeBack: 'دوبارہ خوش آمدید', signInSubtitle: 'اپنے کردار کے مطابق گروکل پورٹل جاری رکھنے کے لیے سائن ان کریں۔',
    schoolCode: 'اسکول کوڈ', identifier: 'موبائل نمبر یا ای میل پتہ', password: 'پاس ورڈ یا منتظم رسائی کلید', signIn: 'محفوظ طور پر سائن ان کریں', profileLanguage: 'زبان کی ترجیح',
  },
} as const;

export type MessageKey = keyof typeof messages.en;
