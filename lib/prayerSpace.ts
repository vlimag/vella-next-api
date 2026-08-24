import type { SupabaseClient } from '@supabase/supabase-js';

type AppSupabaseClient = SupabaseClient<any, any, any, any, any>;

export const PRAYER_THEMES = [
  'peace',
  'strength',
  'guidance',
  'family',
  'gratitude',
  'rest',
  'hope',
  'healing',
  'forgiveness',
] as const;

export type PrayerTheme = (typeof PRAYER_THEMES)[number];

export const PRAYER_STATUSES = ['active', 'answered', 'archived'] as const;
export type PrayerStatus = (typeof PRAYER_STATUSES)[number];

export const PRAYER_MOMENT_LANGUAGES = ['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl'] as const;
export type PrayerMomentLanguage = (typeof PRAYER_MOMENT_LANGUAGES)[number];

export type PrayerMomentReference = {
  book: string;
  chapter: number;
  verse: number;
};

export const PRAYER_MOMENT_REFERENCES: Record<PrayerTheme, PrayerMomentReference> = {
  peace: { book: 'JHN', chapter: 14, verse: 27 },
  strength: { book: 'ISA', chapter: 41, verse: 10 },
  guidance: { book: 'PRO', chapter: 3, verse: 5 },
  family: { book: 'JOS', chapter: 24, verse: 15 },
  gratitude: { book: '1TH', chapter: 5, verse: 18 },
  rest: { book: 'PSA', chapter: 4, verse: 8 },
  hope: { book: 'ROM', chapter: 15, verse: 13 },
  healing: { book: 'PSA', chapter: 147, verse: 3 },
  forgiveness: { book: '1JN', chapter: 1, verse: 9 },
};

type LocalizedThemeCopy = {
  title: string;
  invitation: string;
};

type LocalizedMomentCopy = {
  arrive: string;
  receive: string;
  respond: string;
  closing: string;
  themes: Record<PrayerTheme, LocalizedThemeCopy>;
};

const PRAYER_MOMENT_COPY: Record<PrayerMomentLanguage, LocalizedMomentCopy> = {
  en: {
    arrive: 'Take one slow breath. You do not need perfect words to begin.',
    receive: 'Read the verse slowly. Notice one phrase you want to carry with you.',
    respond: 'Speak honestly to God, then leave a little room for silence.',
    closing: 'God, receive what I can say and what I cannot. Lead me in love. Amen.',
    themes: {
      peace: {
        title: 'A moment for peace',
        invitation: 'Name what feels heavy. Ask for peace for the next faithful step.',
      },
      healing: {
        title: 'A moment for healing',
        invitation: 'Bring the wound, illness, or grief honestly. Ask for care, endurance, and wise help.',
      },
      guidance: {
        title: 'A moment for guidance',
        invitation: 'Name the decision before you. Ask for wisdom, humility, and courage for the next step.',
      },
      family: {
        title: 'A moment for family',
        invitation: 'Hold each person before God. Ask for protection, patience, truth, and reconnection.',
      },
      gratitude: {
        title: 'A moment of gratitude',
        invitation: 'Name one grace you almost missed and offer a simple thank-you.',
      },
      rest: {
        title: 'A moment for rest',
        invitation: 'Name what is keeping you awake or hurried. Ask for enough peace to release this moment.',
      },
      forgiveness: {
        title: 'A moment for forgiveness',
        invitation: 'Bring what needs mercy. Ask for honesty, repair, and freedom from resentment.',
      },
      strength: {
        title: 'A moment for strength',
        invitation: 'Name what is asking more of you than you have. Ask for strength and faithful support.',
      },
      hope: {
        title: 'A moment for hope',
        invitation: 'Name the place where hope feels thin. Ask for light enough to keep walking.',
      },
    },
  },
  pt: {
    arrive: 'Respire devagar uma vez. Você não precisa de palavras perfeitas para começar.',
    receive: 'Leia o versículo com calma. Perceba uma frase que deseja levar com você.',
    respond: 'Fale com Deus com sinceridade e depois deixe um pequeno espaço de silêncio.',
    closing: 'Deus, recebe o que consigo dizer e o que não consigo. Guia-me em amor. Amém.',
    themes: {
      peace: {
        title: 'Um momento de paz',
        invitation: 'Nomeie o que está pesado. Peça paz para o próximo passo fiel.',
      },
      healing: {
        title: 'Um momento de cuidado e cura',
        invitation: 'Apresente com sinceridade a ferida, a doença ou o luto. Peça cuidado, perseverança e ajuda sábia.',
      },
      guidance: {
        title: 'Um momento de direção',
        invitation: 'Nomeie a decisão diante de você. Peça sabedoria, humildade e coragem para o próximo passo.',
      },
      family: {
        title: 'Um momento pela família',
        invitation: 'Coloque cada pessoa diante de Deus. Peça proteção, paciência, verdade e reconciliação.',
      },
      gratitude: {
        title: 'Um momento de gratidão',
        invitation: 'Nomeie uma graça que quase passou despercebida e ofereça um agradecimento simples.',
      },
      rest: {
        title: 'Um momento de descanso',
        invitation: 'Nomeie o que mantém você desperto ou apressado. Peça paz suficiente para entregar este momento.',
      },
      forgiveness: {
        title: 'Um momento de perdão',
        invitation: 'Apresente o que precisa de misericórdia. Peça honestidade, reparação e liberdade do ressentimento.',
      },
      strength: {
        title: 'Um momento de força',
        invitation: 'Nomeie o que exige mais do que você tem. Peça força e apoio fiel.',
      },
      hope: {
        title: 'Um momento de esperança',
        invitation: 'Nomeie onde a esperança parece pequena. Peça luz suficiente para continuar caminhando.',
      },
    },
  },
  es: {
    arrive: 'Respira despacio una vez. No necesitas palabras perfectas para comenzar.',
    receive: 'Lee el versículo con calma. Observa una frase que quieras llevar contigo.',
    respond: 'Habla con Dios con sinceridad y deja después un pequeño espacio de silencio.',
    closing: 'Dios, recibe lo que puedo decir y lo que no puedo. Guíame en amor. Amén.',
    themes: {
      peace: {
        title: 'Un momento de paz',
        invitation: 'Nombra lo que pesa. Pide paz para el próximo paso fiel.',
      },
      healing: {
        title: 'Un momento de cuidado y sanación',
        invitation: 'Presenta con honestidad la herida, la enfermedad o el duelo. Pide cuidado, perseverancia y ayuda sabia.',
      },
      guidance: {
        title: 'Un momento de dirección',
        invitation: 'Nombra la decisión que tienes delante. Pide sabiduría, humildad y valor para el próximo paso.',
      },
      family: {
        title: 'Un momento por la familia',
        invitation: 'Pon a cada persona delante de Dios. Pide protección, paciencia, verdad y reconciliación.',
      },
      gratitude: {
        title: 'Un momento de gratitud',
        invitation: 'Nombra una gracia que casi no viste y ofrece un agradecimiento sencillo.',
      },
      rest: {
        title: 'Un momento de descanso',
        invitation: 'Nombra lo que te mantiene despierto o con prisa. Pide paz suficiente para soltar este momento.',
      },
      forgiveness: {
        title: 'Un momento de perdón',
        invitation: 'Presenta lo que necesita misericordia. Pide honestidad, reparación y libertad del resentimiento.',
      },
      strength: {
        title: 'Un momento de fortaleza',
        invitation: 'Nombra lo que te pide más de lo que tienes. Pide fuerza y apoyo fiel.',
      },
      hope: {
        title: 'Un momento de esperanza',
        invitation: 'Nombra el lugar donde la esperanza parece débil. Pide luz suficiente para seguir caminando.',
      },
    },
  },
  fr: {
    arrive: 'Prends une respiration lente. Tu n’as pas besoin de mots parfaits pour commencer.',
    receive: 'Lis le verset lentement. Remarque une phrase que tu souhaites garder avec toi.',
    respond: 'Parle à Dieu avec sincérité, puis laisse un peu de place au silence.',
    closing: 'Dieu, reçois ce que je peux dire et ce que je ne peux pas dire. Conduis-moi dans l’amour. Amen.',
    themes: {
      peace: {
        title: 'Un moment de paix',
        invitation: 'Nomme ce qui est lourd. Demande la paix pour le prochain pas fidèle.',
      },
      healing: {
        title: 'Un moment de soin et de guérison',
        invitation: 'Présente honnêtement la blessure, la maladie ou le deuil. Demande du soin, de l’endurance et une aide sage.',
      },
      guidance: {
        title: 'Un moment pour être guidé',
        invitation: 'Nomme la décision devant toi. Demande sagesse, humilité et courage pour le prochain pas.',
      },
      family: {
        title: 'Un moment pour la famille',
        invitation: 'Confie chaque personne à Dieu. Demande protection, patience, vérité et réconciliation.',
      },
      gratitude: {
        title: 'Un moment de gratitude',
        invitation: 'Nomme une grâce que tu as presque manquée et offre un simple merci.',
      },
      rest: {
        title: 'Un moment de repos',
        invitation: 'Nomme ce qui te tient éveillé ou pressé. Demande assez de paix pour déposer cet instant.',
      },
      forgiveness: {
        title: 'Un moment de pardon',
        invitation: 'Présente ce qui a besoin de miséricorde. Demande honnêteté, réparation et liberté face au ressentiment.',
      },
      strength: {
        title: 'Un moment de force',
        invitation: 'Nomme ce qui te demande plus que tu ne possèdes. Demande de la force et un soutien fidèle.',
      },
      hope: {
        title: 'Un moment d’espérance',
        invitation: 'Nomme l’endroit où l’espérance semble fragile. Demande assez de lumière pour continuer à marcher.',
      },
    },
  },
  de: {
    arrive: 'Atme einmal langsam ein und aus. Du brauchst keine perfekten Worte, um zu beginnen.',
    receive: 'Lies den Vers langsam. Achte auf einen Satz, den du mitnehmen möchtest.',
    respond: 'Sprich ehrlich mit Gott und lass danach ein wenig Raum für Stille.',
    closing: 'Gott, nimm auf, was ich sagen kann und was nicht. Führe mich in Liebe. Amen.',
    themes: {
      peace: {
        title: 'Ein Moment des Friedens',
        invitation: 'Benenne, was schwer ist. Bitte um Frieden für den nächsten treuen Schritt.',
      },
      healing: {
        title: 'Ein Moment für Fürsorge und Heilung',
        invitation: 'Bring Verletzung, Krankheit oder Trauer ehrlich vor Gott. Bitte um Fürsorge, Ausdauer und weise Hilfe.',
      },
      guidance: {
        title: 'Ein Moment der Führung',
        invitation: 'Benenne die Entscheidung vor dir. Bitte um Weisheit, Demut und Mut für den nächsten Schritt.',
      },
      family: {
        title: 'Ein Moment für die Familie',
        invitation: 'Bring jeden Menschen vor Gott. Bitte um Schutz, Geduld, Wahrheit und Versöhnung.',
      },
      gratitude: {
        title: 'Ein Moment der Dankbarkeit',
        invitation: 'Benenne eine Gnade, die du beinahe übersehen hast, und sage schlicht Danke.',
      },
      rest: {
        title: 'Ein Moment der Ruhe',
        invitation: 'Benenne, was dich wach oder in Eile hält. Bitte um genug Frieden, um diesen Moment loszulassen.',
      },
      forgiveness: {
        title: 'Ein Moment der Vergebung',
        invitation: 'Bring vor Gott, was Barmherzigkeit braucht. Bitte um Ehrlichkeit, Wiedergutmachung und Freiheit von Groll.',
      },
      strength: {
        title: 'Ein Moment der Kraft',
        invitation: 'Benenne, was mehr von dir verlangt, als du hast. Bitte um Kraft und verlässliche Unterstützung.',
      },
      hope: {
        title: 'Ein Moment der Hoffnung',
        invitation: 'Benenne, wo Hoffnung schwach wirkt. Bitte um genug Licht, um weiterzugehen.',
      },
    },
  },
  it: {
    arrive: 'Fai un respiro lento. Non servono parole perfette per cominciare.',
    receive: 'Leggi lentamente il versetto. Nota una frase che desideri portare con te.',
    respond: 'Parla con Dio con sincerità, poi lascia un piccolo spazio al silenzio.',
    closing: 'Dio, accogli ciò che riesco a dire e ciò che non riesco a dire. Guidami nell’amore. Amen.',
    themes: {
      peace: {
        title: 'Un momento di pace',
        invitation: 'Dai un nome a ciò che pesa. Chiedi pace per il prossimo passo fedele.',
      },
      healing: {
        title: 'Un momento di cura e guarigione',
        invitation: 'Porta con sincerità la ferita, la malattia o il lutto. Chiedi cura, perseveranza e un aiuto saggio.',
      },
      guidance: {
        title: 'Un momento di guida',
        invitation: 'Dai un nome alla decisione davanti a te. Chiedi saggezza, umiltà e coraggio per il prossimo passo.',
      },
      family: {
        title: 'Un momento per la famiglia',
        invitation: 'Affida ogni persona a Dio. Chiedi protezione, pazienza, verità e riconciliazione.',
      },
      gratitude: {
        title: 'Un momento di gratitudine',
        invitation: 'Dai un nome a una grazia che stavi per non vedere e offri un semplice grazie.',
      },
      rest: {
        title: 'Un momento di riposo',
        invitation: 'Dai un nome a ciò che ti tiene sveglio o di fretta. Chiedi pace sufficiente per affidare questo momento.',
      },
      forgiveness: {
        title: 'Un momento di perdono',
        invitation: 'Porta ciò che ha bisogno di misericordia. Chiedi sincerità, riparazione e libertà dal rancore.',
      },
      strength: {
        title: 'Un momento di forza',
        invitation: 'Dai un nome a ciò che ti chiede più di quanto possiedi. Chiedi forza e sostegno fedele.',
      },
      hope: {
        title: 'Un momento di speranza',
        invitation: 'Dai un nome al luogo in cui la speranza sembra fragile. Chiedi luce sufficiente per continuare il cammino.',
      },
    },
  },
  ru: {
    arrive: 'Сделайте один медленный вдох. Для начала не нужны идеальные слова.',
    receive: 'Прочитайте стих медленно. Заметьте одну фразу, которую хотите сохранить.',
    respond: 'Говорите с Богом искренне, а затем оставьте немного места для тишины.',
    closing: 'Боже, прими то, что я могу сказать, и то, чего не могу. Веди меня в любви. Аминь.',
    themes: {
      peace: {
        title: 'Минута мира',
        invitation: 'Назовите то, что лежит тяжестью. Просите мира для следующего верного шага.',
      },
      healing: {
        title: 'Минута заботы и исцеления',
        invitation: 'Честно принесите рану, болезнь или скорбь. Просите заботы, стойкости и мудрой помощи.',
      },
      guidance: {
        title: 'Минута для поиска пути',
        invitation: 'Назовите решение, которое стоит перед вами. Просите мудрости, смирения и мужества для следующего шага.',
      },
      family: {
        title: 'Минута для семьи',
        invitation: 'Представьте каждого человека перед Богом. Просите защиты, терпения, истины и примирения.',
      },
      gratitude: {
        title: 'Минута благодарности',
        invitation: 'Назовите благодать, которую едва не пропустили, и просто поблагодарите.',
      },
      rest: {
        title: 'Минута покоя',
        invitation: 'Назовите то, что не даёт уснуть или заставляет спешить. Просите мира, чтобы отпустить этот момент.',
      },
      forgiveness: {
        title: 'Минута прощения',
        invitation: 'Принесите то, что нуждается в милости. Просите честности, восстановления и свободы от обиды.',
      },
      strength: {
        title: 'Минута силы',
        invitation: 'Назовите то, что требует больше, чем у вас есть. Просите силы и верной поддержки.',
      },
      hope: {
        title: 'Минута надежды',
        invitation: 'Назовите место, где надежда ослабла. Просите света, достаточного для дальнейшего пути.',
      },
    },
  },
  pl: {
    arrive: 'Weź jeden spokojny oddech. Nie potrzebujesz doskonałych słów, aby zacząć.',
    receive: 'Przeczytaj werset powoli. Zauważ jedno zdanie, które chcesz zachować.',
    respond: 'Mów do Boga szczerze, a potem zostaw trochę miejsca na ciszę.',
    closing: 'Boże, przyjmij to, co potrafię powiedzieć, i to, czego nie potrafię. Prowadź mnie w miłości. Amen.',
    themes: {
      peace: {
        title: 'Chwila pokoju',
        invitation: 'Nazwij to, co ciąży. Proś o pokój na kolejny wierny krok.',
      },
      healing: {
        title: 'Chwila troski i uzdrowienia',
        invitation: 'Szczerze przynieś ranę, chorobę lub żałobę. Proś o troskę, wytrwałość i mądrą pomoc.',
      },
      guidance: {
        title: 'Chwila prowadzenia',
        invitation: 'Nazwij decyzję, która jest przed tobą. Proś o mądrość, pokorę i odwagę na kolejny krok.',
      },
      family: {
        title: 'Chwila dla rodziny',
        invitation: 'Powierz Bogu każdą osobę. Proś o ochronę, cierpliwość, prawdę i pojednanie.',
      },
      gratitude: {
        title: 'Chwila wdzięczności',
        invitation: 'Nazwij łaskę, której niemal nie zauważyłeś, i po prostu podziękuj.',
      },
      rest: {
        title: 'Chwila odpoczynku',
        invitation: 'Nazwij to, co nie pozwala ci zasnąć lub każe się spieszyć. Proś o pokój, by oddać tę chwilę.',
      },
      forgiveness: {
        title: 'Chwila przebaczenia',
        invitation: 'Przynieś to, co potrzebuje miłosierdzia. Proś o szczerość, naprawę i wolność od urazy.',
      },
      strength: {
        title: 'Chwila siły',
        invitation: 'Nazwij to, co wymaga więcej, niż masz. Proś o siłę i wierne wsparcie.',
      },
      hope: {
        title: 'Chwila nadziei',
        invitation: 'Nazwij miejsce, w którym nadzieja osłabła. Proś o dość światła, by iść dalej.',
      },
    },
  },
};

export type PrayerMomentGuidance = {
  title: string;
  reflection: string;
  prayer_prompt: string;
  action: string;
};

export function prayerMomentGuidance(
  theme: PrayerTheme,
  language: PrayerMomentLanguage,
): PrayerMomentGuidance {
  const copy = PRAYER_MOMENT_COPY[language];
  const themeCopy = copy.themes[theme];
  return {
    title: themeCopy.title,
    reflection: themeCopy.invitation,
    prayer_prompt: copy.closing,
    action: `${copy.arrive} ${copy.receive} ${copy.respond}`,
  };
}

export function localDayInTimeZone(timeZone: string, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Invalid or unavailable time zones safely use UTC below.
  }
  return now.toISOString().slice(0, 10);
}

export type PrayerMomentVerseRow = {
  id: string;
  text_content: string;
  language_code: string;
  chapter: number;
  verse: number;
  bible_books: { code: string } | Array<{ code: string }>;
  bible_versions:
    | { code: string; name: string; is_active: boolean }
    | Array<{ code: string; name: string; is_active: boolean }>;
};

function firstRelation<T>(value: T | T[]): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isPrayerMomentLanguage(value: string): value is PrayerMomentLanguage {
  return (PRAYER_MOMENT_LANGUAGES as readonly string[]).includes(value);
}

export function normalizePrayerMomentScripture(
  row: PrayerMomentVerseRow,
  requestedLanguage: PrayerMomentLanguage,
) {
  const book = firstRelation(row.bible_books);
  const version = firstRelation(row.bible_versions);
  if (!isPrayerMomentLanguage(row.language_code) || !book || !version || version.is_active !== true) return null;

  return {
    id: row.id,
    text_content: row.text_content,
    language_code: row.language_code,
    chapter: row.chapter,
    verse: row.verse,
    bible_books: { code: book.code },
    bible_versions: { code: version.code, name: version.name },
    fallback_language: row.language_code === requestedLanguage ? null : row.language_code,
  };
}

export async function resolvePrayerMomentVerse(
  requestedLanguage: PrayerMomentLanguage,
  load: (language: PrayerMomentLanguage) => Promise<PrayerMomentVerseRow | null>,
) {
  const localized = await load(requestedLanguage);
  if (localized) return localized;
  if (requestedLanguage === 'en') return null;
  return load('en');
}

export async function isApprovedPrayerVerse(
  supabase: AppSupabaseClient,
  verseId: string,
) {
  const { data, error } = await supabase
    .from('bible_verses')
    .select('id, bible_versions!inner(is_active)')
    .eq('id', verseId)
    .eq('bible_versions.is_active', true)
    .limit(1)
    .maybeSingle();

  return !error && Boolean(data?.id);
}

export const PRAYER_INTENTION_SELECT = [
  'id',
  'title',
  'body',
  'theme',
  'status',
  'verse_id',
  'prayed_count',
  'last_prayed_on',
  'answered_at',
  'answer_note',
  'created_at',
  'updated_at',
  'bible_verses(id, chapter, verse, text_content, language_code, bible_books(code), bible_versions(code, name, is_active))',
].join(', ');
