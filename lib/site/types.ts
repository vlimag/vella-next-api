import type { Locale } from './config';

export type LinkItem = {
  label: string;
  href: string;
};

export type FeatureItem = {
  eyebrow: string;
  title: string;
  body: string;
};

export type StepItem = {
  number: string;
  title: string;
  body: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type SiteCopy = {
  locale: Locale;
  seo: {
    title: string;
    description: string;
    featuresTitle: string;
    featuresDescription: string;
    blogTitle: string;
    blogDescription: string;
    supportTitle: string;
    supportDescription: string;
    privacyTitle: string;
    privacyDescription: string;
    termsTitle: string;
    termsDescription: string;
    guidelinesTitle: string;
    guidelinesDescription: string;
  };
  nav: {
    features: string;
    howItWorks: string;
    blog: string;
    support: string;
    download: string;
    menu: string;
    language: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
    note: string;
  };
  preview: {
    greeting: string;
    title: string;
    verse: string;
    reference: string;
    journey: string;
    journeyTitle: string;
    minutes: string;
    reflection: string;
  };
  proof: string[];
  intro: {
    eyebrow: string;
    title: string;
    body: string;
  };
  features: FeatureItem[];
  rhythm: {
    eyebrow: string;
    title: string;
    body: string;
    steps: StepItem[];
  };
  ai: {
    eyebrow: string;
    title: string;
    body: string;
    points: string[];
    trust: string;
  };
  community: {
    eyebrow: string;
    title: string;
    body: string;
    points: string[];
  };
  story: {
    quote: string;
    body: string;
  };
  blog: {
    eyebrow: string;
    title: string;
    body: string;
    readAll: string;
    readArticle: string;
    minRead: string;
    latest: string;
    back: string;
    share: string;
  };
  download: {
    eyebrow: string;
    title: string;
    body: string;
    appStore: string;
    appStoreSoon: string;
    playStore: string;
    availability: string;
    desktopHint: string;
    contextualEyebrow: string;
    contextualTitle: string;
    contextualBody: string;
  };
  footer: {
    mission: string;
    product: string;
    company: string;
    legal: string;
    languages: string;
    home: string;
    features: string;
    blog: string;
    support: string;
    about: string;
    privacy: string;
    terms: string;
    guidelines: string;
    rights: string;
    madeWith: string;
  };
  featuresPage: {
    eyebrow: string;
    title: string;
    body: string;
    sections: Array<{
      title: string;
      body: string;
      bullets: string[];
    }>;
    safetyTitle: string;
    safetyBody: string;
  };
  support: {
    eyebrow: string;
    title: string;
    body: string;
    emailCta: string;
    faqTitle: string;
    faqs: FaqItem[];
    deleteTitle: string;
    deleteBody: string;
    deleteSteps: string[];
    eligibilityNotice: string;
    partialDeletionTitle: string;
    partialDeletionBody: string;
    partialDeletionSteps: string[];
    responseNote: string;
  };
  legal: {
    updated: string;
    privacyIntro: string;
    privacySections: LegalSection[];
    termsIntro: string;
    termsSections: LegalSection[];
    guidelinesIntro: string;
    guidelinesSections: LegalSection[];
  };
};
