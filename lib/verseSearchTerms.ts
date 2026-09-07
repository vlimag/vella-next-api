export type SearchIntent =
  | 'strength'
  | 'peace'
  | 'hope'
  | 'fear'
  | 'love'
  | 'wisdom'
  | 'prayer'
  | 'faith'
  | 'gratitude'
  | 'family'
  | 'purpose'
  | 'healing'
  | 'forgiveness'
  | 'deception'
  | 'grief';

export type SearchLanguage = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'it' | 'ru' | 'pl';

type VerseReference = { bookCode: string; chapter: number; verse: number };

const STOPWORDS: Record<string, Set<string>> = {
  en: new Set(['some', 'verse', 'verses', 'about', 'the', 'and', 'for', 'with', 'that', 'this', 'what', 'which', 'find', 'show']),
  pt: new Set(['algum', 'versiculo', 'versiculos', 'verso', 'versos', 'sobre', 'com', 'para', 'que', 'este', 'esta', 'qual', 'encontre', 'mostre']),
  es: new Set(['algun', 'versiculo', 'versiculos', 'verso', 'versos', 'sobre', 'con', 'para', 'que', 'este', 'esta', 'cual']),
  fr: new Set(['quelque', 'verset', 'versets', 'sur', 'avec', 'pour', 'que', 'ce', 'cette', 'quel']),
  de: new Set(['einige', 'vers', 'verse', 'uber', 'mit', 'fur', 'dass', 'dies', 'welche']),
  it: new Set(['alcuni', 'versetto', 'versetti', 'su', 'con', 'per', 'che', 'questo', 'quale']),
  ru: new Set(['стих', 'стихи', 'стихотворение', 'о', 'об', 'про', 'с', 'для', 'что', 'какой']),
  pl: new Set(['jakis', 'werset', 'wersety', 'o', 'z', 'dla', 'ze', 'jaki']),
};

const LANGUAGE_MARKERS: Record<SearchLanguage, Set<string>> = {
  en: new Set(['verse', 'verses', 'about', 'strength', 'courage', 'hope', 'wisdom', 'prayer', 'faith', 'healing', 'forgiveness', 'grief', 'liar', 'liars', 'lying']),
  pt: new Set(['versiculo', 'versiculos', 'forca', 'coragem', 'esperanca', 'sabedoria', 'oracao', 'gratidao', 'proposito', 'perdao', 'socorro', 'refugio', 'deus', 'nao', 'mentira', 'mentiroso', 'mentirosa', 'mentirosos', 'mentirosas']),
  es: new Set(['fuerza', 'valentia', 'esperanza', 'sabiduria', 'oracion', 'gratitud', 'sanidad', 'perdon', 'duelo', 'dios', 'miedo', 'mentira', 'mentiroso', 'mentirosa', 'mentirosos', 'mentirosas']),
  fr: new Set(['verset', 'versets', 'force', 'paix', 'espoir', 'sagesse', 'priere', 'guerison', 'pardon', 'deuil', 'dieu', 'mensonge', 'menteur', 'menteurs', 'menteuse', 'menteuses']),
  de: new Set(['vers', 'uber', 'starke', 'kraft', 'frieden', 'hoffnung', 'weisheit', 'gebet', 'glaube', 'heilung', 'vergebung', 'trauer', 'gott', 'luge', 'lugen', 'lugner', 'tauschung']),
  it: new Set(['versetto', 'versetti', 'sulla', 'forza', 'coraggio', 'pace', 'speranza', 'saggezza', 'preghiera', 'guarigione', 'perdono', 'lutto', 'dio', 'bugia', 'bugie', 'bugiardo', 'bugiarda', 'bugiardi', 'bugiarde']),
  ru: new Set(['стих', 'стихи', 'сила', 'мужество', 'надежда', 'мудрость', 'молитва', 'вера', 'исцеление', 'прощении', 'горе', 'бог', 'ложь', 'лжи', 'лжец', 'лжецы', 'лжецах', 'обман']),
  pl: new Set(['werset', 'wersety', 'sila', 'sile', 'odwaga', 'nadzieja', 'madrosc', 'modlitwa', 'wiara', 'uzdrowienie', 'przebaczeniu', 'zaloba', 'bog', 'klamstwo', 'klamca', 'klamcy', 'kłamstwo', 'kłamca', 'kłamcy', 'kłamcach']),
};

const TRIGGERS: Record<SearchIntent, string[]> = {
  strength: ['strength', 'strong', 'courage', 'forca', 'fortaleza', 'coragem', 'fuerza', 'fortaleza', 'valentia', 'force', 'courage', 'starke', 'kraft', 'mut', 'forza', 'coraggio', 'сила', 'силы', 'силе', 'мужество', 'sila', 'odwaga'],
  peace: ['peace', 'calm', 'anxiety', 'paz', 'calma', 'ansiedade', 'ansiedad', 'paix', 'anxiete', 'frieden', 'angst', 'pace', 'ansia', 'мир', 'тревога', 'pokoj', 'lek'],
  hope: ['hope', 'encouragement', 'esperanca', 'esperanza', 'espoir', 'hoffnung', 'speranza', 'надежда', 'nadzieja'],
  fear: ['fear', 'afraid', 'medo', 'miedo', 'peur', 'furcht', 'paura', 'страх', 'strach'],
  love: ['love', 'amor', 'amour', 'liebe', 'amore', 'любовь', 'milosc'],
  wisdom: ['wisdom', 'sabedoria', 'sabiduria', 'sagesse', 'weisheit', 'saggezza', 'мудрость', 'madrosc'],
  prayer: ['prayer', 'pray', 'oracao', 'orar', 'oracion', 'prier', 'priere', 'gebet', 'beten', 'preghiera', 'pregare', 'молитва', 'modlitwa'],
  faith: ['faith', 'trust god', 'fe', 'confianca', 'confianza', 'foi', 'glaube', 'fede', 'вера', 'wiara'],
  gratitude: ['gratitude', 'thankful', 'gratidao', 'agradecimento', 'gratitud', 'reconnaissance', 'dankbarkeit', 'gratitudine', 'благодарность', 'wdziecznosc'],
  family: ['family', 'marriage', 'familia', 'casamento', 'matrimonio', 'famille', 'mariage', 'familie', 'ehe', 'famiglia', 'семья', 'rodzina'],
  purpose: ['purpose', 'direction', 'guidance', 'proposito', 'direcao', 'direccion', 'but', 'direction', 'zweck', 'fuhrung', 'scopo', 'direzione', 'цель', 'направление', 'cel', 'kierunek'],
  healing: ['healing', 'sickness', 'cura', 'doenca', 'sanidad', 'maladie', 'heilung', 'krankheit', 'guarigione', 'malattia', 'исцеление', 'choroba', 'uzdrowienie'],
  forgiveness: ['forgiveness', 'forgive', 'forgiving', 'pardon', 'perdao', 'perdoar', 'perdoe', 'perdon', 'perdonar', 'pardonner', 'vergebung', 'vergeben', 'perdono', 'perdonare', 'прощение', 'прощении', 'простить', 'прощать', 'przebaczenie', 'przebaczeniu', 'przebaczyc'],
  deception: ['liar', 'liars', 'lying', 'lie', 'lies', 'deceit', 'deception', 'dishonesty', 'mentira', 'mentiras', 'mentiroso', 'mentirosa', 'mentirosos', 'mentirosas', 'engano', 'mentiroso', 'mentirosa', 'mentirosos', 'mentirosas', 'engaño', 'mensonge', 'mensonges', 'menteur', 'menteurs', 'menteuse', 'menteuses', 'tromperie', 'luge', 'lugen', 'lugner', 'tauschung', 'bugia', 'bugie', 'bugiardo', 'bugiarda', 'bugiardi', 'bugiarde', 'menzogna', 'ложь', 'лжи', 'лжец', 'лжецы', 'лжецах', 'обман', 'kłamstwo', 'kłamstwa', 'kłamca', 'kłamcy', 'kłamcach', 'oszustwo'],
  grief: ['grief', 'loss', 'mourning', 'luto', 'perda', 'duelo', 'perdida', 'deuil', 'perte', 'trauer', 'verlust', 'lutto', 'perdita', 'горе', 'потеря', 'zaloba', 'strata'],
};

const TERMS: Record<string, Partial<Record<SearchIntent, string[]>>> = {
  en: {
    strength: ['strength', 'strong', 'strengthen', 'courage', 'power', 'help', 'refuge'], peace: ['peace', 'calm', 'rest', 'anxious', 'still'], hope: ['hope', 'encourage', 'promise', 'wait'], fear: ['fear', 'afraid', 'courage', 'do not fear'], love: ['love', 'beloved', 'kindness', 'compassion'], wisdom: ['wisdom', 'understanding', 'knowledge', 'discern'], prayer: ['pray', 'prayer', 'ask', 'seek'], faith: ['faith', 'believe', 'trust', 'faithful'], gratitude: ['thanks', 'thankful', 'gratitude', 'praise'], family: ['family', 'children', 'husband', 'wife', 'household'], purpose: ['purpose', 'path', 'guide', 'will'], healing: ['heal', 'healing', 'sick', 'restore'], forgiveness: ['forgive', 'forgiveness', 'pardon', 'mercy'], deception: ['liar', 'lie', 'lying', 'deceit'], grief: ['grief', 'mourn', 'comfort', 'brokenhearted'],
  },
  pt: {
    strength: ['força', 'fortaleza', 'coragem', 'poder', 'socorro', 'refúgio'], peace: ['paz', 'descanso', 'ansiedade', 'quietude'], hope: ['esperança', 'promessa', 'esperar', 'ânimo'], fear: ['medo', 'temor', 'coragem', 'não temas'], love: ['amor', 'amado', 'bondade', 'compaixão'], wisdom: ['sabedoria', 'entendimento', 'conhecimento', 'discernimento'], prayer: ['oração', 'orar', 'pedir', 'buscar'], faith: ['fé', 'crer', 'confiar', 'fiel'], gratitude: ['graças', 'gratidão', 'agradecer', 'louvor'], family: ['família', 'filhos', 'marido', 'esposa', 'casa'], purpose: ['propósito', 'caminho', 'direção', 'vontade'], healing: ['cura', 'curar', 'doente', 'restaurar'], forgiveness: ['perdoar', 'perdão', 'misericórdia', 'reconciliar'], deception: ['mentira', 'mentiroso', 'engano', 'falsidade'], grief: ['luto', 'chorar', 'consolo', 'quebrantado'],
  },
  es: {
    strength: ['fuerza', 'fortaleza', 'valentía', 'poder', 'socorro', 'refugio'], peace: ['paz', 'descanso', 'ansiedad', 'quietud'], hope: ['esperanza', 'promesa', 'esperar', 'ánimo'], fear: ['miedo', 'temor', 'valor', 'no temas'], love: ['amor', 'amado', 'bondad', 'compasión'], wisdom: ['sabiduría', 'entendimiento', 'conocimiento', 'discernimiento'], prayer: ['oración', 'orar', 'pedir', 'buscar'], faith: ['fe', 'creer', 'confiar', 'fiel'], gratitude: ['gracias', 'gratitud', 'agradecer', 'alabanza'], family: ['familia', 'hijos', 'esposo', 'esposa', 'casa'], purpose: ['propósito', 'camino', 'dirección', 'voluntad'], healing: ['sanidad', 'sanar', 'enfermo', 'restaurar'], forgiveness: ['perdonar', 'perdón', 'misericordia', 'reconciliar'], deception: ['mentira', 'mentiroso', 'engaño', 'falsedad'], grief: ['duelo', 'llorar', 'consuelo', 'quebrantado'],
  },
  fr: { forgiveness: ['pardonner', 'pardon', 'miséricorde', 'réconciliation'], deception: ['mensonge', 'menteur', 'tromperie', 'fausseté'] },
  de: { forgiveness: ['vergeben', 'Vergebung', 'Barmherzigkeit', 'Versöhnung'], deception: ['Lüge', 'Lügner', 'Täuschung', 'Falschheit'] },
  it: { forgiveness: ['perdonare', 'perdono', 'misericordia', 'riconciliazione'], deception: ['bugia', 'bugiardo', 'inganno', 'falsità'] },
  ru: { forgiveness: ['простить', 'прощение', 'милосердие', 'примирение'], deception: ['ложь', 'лжец', 'обман', 'неправда'] },
  pl: { forgiveness: ['przebaczyć', 'przebaczenie', 'miłosierdzie', 'pojednanie'], deception: ['kłamstwo', 'kłamca', 'oszustwo', 'fałsz'] },
};

const REFERENCES: Record<SearchIntent, VerseReference[]> = {
  strength: [{ bookCode: 'PSA', chapter: 46, verse: 1 }, { bookCode: 'ISA', chapter: 41, verse: 10 }, { bookCode: 'PHP', chapter: 4, verse: 13 }, { bookCode: 'JOS', chapter: 1, verse: 9 }, { bookCode: '2CO', chapter: 12, verse: 9 }],
  peace: [{ bookCode: 'JHN', chapter: 14, verse: 27 }, { bookCode: 'PHP', chapter: 4, verse: 7 }, { bookCode: 'PSA', chapter: 4, verse: 8 }],
  hope: [{ bookCode: 'ROM', chapter: 15, verse: 13 }, { bookCode: 'JER', chapter: 29, verse: 11 }, { bookCode: 'PSA', chapter: 42, verse: 11 }],
  fear: [{ bookCode: 'ISA', chapter: 41, verse: 10 }, { bookCode: 'PSA', chapter: 56, verse: 3 }, { bookCode: '2TI', chapter: 1, verse: 7 }],
  love: [{ bookCode: '1CO', chapter: 13, verse: 4 }, { bookCode: 'JHN', chapter: 3, verse: 16 }, { bookCode: '1JN', chapter: 4, verse: 19 }],
  wisdom: [{ bookCode: 'JAS', chapter: 1, verse: 5 }, { bookCode: 'PRO', chapter: 3, verse: 5 }, { bookCode: 'PRO', chapter: 4, verse: 7 }],
  prayer: [{ bookCode: 'PHP', chapter: 4, verse: 6 }, { bookCode: '1TH', chapter: 5, verse: 17 }, { bookCode: 'MAT', chapter: 6, verse: 6 }],
  faith: [{ bookCode: 'HEB', chapter: 11, verse: 1 }, { bookCode: 'PRO', chapter: 3, verse: 5 }, { bookCode: '2CO', chapter: 5, verse: 7 }],
  gratitude: [{ bookCode: '1TH', chapter: 5, verse: 18 }, { bookCode: 'PSA', chapter: 107, verse: 1 }, { bookCode: 'COL', chapter: 3, verse: 15 }],
  family: [{ bookCode: 'JOS', chapter: 24, verse: 15 }, { bookCode: 'PRO', chapter: 22, verse: 6 }, { bookCode: 'COL', chapter: 3, verse: 13 }],
  purpose: [{ bookCode: 'PRO', chapter: 3, verse: 6 }, { bookCode: 'ROM', chapter: 8, verse: 28 }, { bookCode: 'EPH', chapter: 2, verse: 10 }],
  healing: [{ bookCode: 'PSA', chapter: 147, verse: 3 }, { bookCode: 'JAS', chapter: 5, verse: 15 }, { bookCode: 'ISA', chapter: 53, verse: 5 }],
  forgiveness: [{ bookCode: 'MAT', chapter: 18, verse: 22 }, { bookCode: 'EPH', chapter: 4, verse: 32 }, { bookCode: 'COL', chapter: 3, verse: 13 }, { bookCode: 'MAT', chapter: 6, verse: 14 }, { bookCode: '1JN', chapter: 1, verse: 9 }],
  deception: [{ bookCode: 'PSA', chapter: 116, verse: 11 }, { bookCode: 'PSA', chapter: 34, verse: 13 }, { bookCode: 'PSA', chapter: 101, verse: 7 }, { bookCode: 'PRO', chapter: 12, verse: 22 }, { bookCode: 'EPH', chapter: 4, verse: 25 }],
  grief: [{ bookCode: 'MAT', chapter: 5, verse: 4 }, { bookCode: 'PSA', chapter: 34, verse: 18 }, { bookCode: 'REV', chapter: 21, verse: 4 }],
};

const REFERENCE_OVERRIDES: Partial<Record<SearchLanguage, Partial<Record<SearchIntent, VerseReference[]>>>> = {
  // Russian Synodal numbering places the equivalent of Psalm 116:11 at Psalm 115:2.
  ru: {
    deception: [{ bookCode: 'PSA', chapter: 115, verse: 2 }, { bookCode: 'PSA', chapter: 5, verse: 7 }, { bookCode: 'PSA', chapter: 11, verse: 3 }, { bookCode: 'PRO', chapter: 12, verse: 22 }, { bookCode: 'EPH', chapter: 4, verse: 25 }],
  },
};

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectSearchLanguage(query: string, fallbackLanguage: string): SearchLanguage {
  const fallback = fallbackLanguage.split('-')[0] as SearchLanguage;
  const safeFallback = Object.hasOwn(LANGUAGE_MARKERS, fallback) ? fallback : 'en';
  const normalized = normalizeSearchText(query);
  const tokens = new Set(normalized.split(' ').filter(Boolean));

  if (/[\u0400-\u04ff]/u.test(query)) return 'ru';

  const scores = (Object.keys(LANGUAGE_MARKERS) as SearchLanguage[])
    .map((language) => ({
      language,
      score: [...tokens].reduce((total, token) => total + (LANGUAGE_MARKERS[language].has(token) ? 1 : 0), 0),
    }))
    .sort((left, right) => right.score - left.score);

  if (scores[0].score > 0 && scores[0].score > scores[1].score) return scores[0].language;
  return safeFallback;
}

function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }
  return row[right.length];
}

export function resolveSearchIntent(query: string): SearchIntent | null {
  const normalized = normalizeSearchText(query);
  const tokens = normalized.split(' ').filter(Boolean);
  const triggers = (Object.entries(TRIGGERS) as Array<[SearchIntent, string[]]>).map(([intent, rawTriggers]) => ({
    intent,
    triggers: rawTriggers.map(normalizeSearchText),
  }));

  for (const { intent, triggers: intentTriggers } of triggers) {
    for (const trigger of intentTriggers) {
      if (trigger.includes(' ') ? normalized.includes(trigger) : tokens.includes(trigger)) return intent;
    }
  }

  for (const { intent, triggers: intentTriggers } of triggers) {
    for (const trigger of intentTriggers) {
      if (trigger.length >= 5 && tokens.some((token) => token.length >= 5 && editDistance(token, trigger) <= 1)) return intent;
    }
  }
  return null;
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeSearchText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function fallbackTermsFromQuery(query: string, lang: string) {
  const stopwords = STOPWORDS[lang] ?? STOPWORDS.en;
  const compact = normalizeSearchText(query).split(' ').filter((token) => token.length >= 3 && !stopwords.has(token));
  const intent = resolveSearchIntent(query);
  const localizedTerms = intent ? (TERMS[lang]?.[intent] ?? []) : [];
  const englishTerms = intent && lang !== 'en' ? (TERMS.en[intent] ?? []) : [];
  return unique([query, ...localizedTerms, ...englishTerms, ...compact]).slice(0, 24);
}

export function referencesForIntent(intent: SearchIntent | null, language?: string) {
  if (!intent) return [];
  const normalizedLanguage = language?.split('-')[0] as SearchLanguage | undefined;
  return (normalizedLanguage ? REFERENCE_OVERRIDES[normalizedLanguage]?.[intent] : undefined) ?? REFERENCES[intent];
}
