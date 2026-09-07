export const LONG_JOURNEY_LOCALES = ['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl'] as const;
export const LONG_JOURNEY_STEP_TYPES = ['verse', 'reflection', 'prayer', 'action'] as const;

export type LongJourneyLocale = (typeof LONG_JOURNEY_LOCALES)[number];
export type LongJourneyStepType = (typeof LONG_JOURNEY_STEP_TYPES)[number];
type LocalizedCopy = { title: string; body: string; cta: string };

export type LongJourneyManifest = {
  slug: string;
  version: 1;
  sessionCount: number;
  localizations: Record<LongJourneyLocale, { title: string; subtitle: string; description: string }>;
  badge: { code: string; tier: string; assetKey: string; targetValue: number };
  sessions: Array<{
    number: number;
    theme: string;
    estimatedSeconds: number;
    steps: Array<{
      type: LongJourneyStepType;
      blockId: string;
      poolTag: string;
      estimatedSeconds: number;
      scriptureRef: string | null;
      localizations: Record<LongJourneyLocale, LocalizedCopy>;
    }>;
  }>;
};

const STEP_COPY: Record<LongJourneyLocale, {
  verse: [string, string]; reflection: [string, string, string]; prayer: [string, string, string]; action: [string, string, string];
}> = {
  en: { verse: ['Scripture for today', 'Read slowly'], reflection: ['Pause and notice', 'Notice what this theme awakens in you today. Name it honestly without judging it.', 'Reflect'], prayer: ['A prayer to begin', 'God, meet me in this moment and form a steady, faithful response in me.', 'Pray'], action: ['One gentle next step', 'Choose one small action today that gives this session a place in ordinary life.', 'Practice'] },
  pt: { verse: ['Escritura de hoje', 'Leia devagar'], reflection: ['Pausa e atenção', 'Perceba o que este tema desperta em você hoje. Dê um nome honesto, sem julgamento.', 'Refletir'], prayer: ['Uma oração para começar', 'Deus, encontra-me neste momento e forma em mim uma resposta firme e fiel.', 'Orar'], action: ['Um próximo passo gentil', 'Escolha hoje uma pequena ação que leve esta sessão para a vida cotidiana.', 'Praticar'] },
  es: { verse: ['Escritura de hoy', 'Lee despacio'], reflection: ['Pausa y observa', 'Observa lo que este tema despierta hoy en ti. Nómbralo con sinceridad y sin juzgarlo.', 'Reflexionar'], prayer: ['Una oración para comenzar', 'Dios, encuéntrame en este momento y forma en mí una respuesta firme y fiel.', 'Orar'], action: ['Un siguiente paso amable', 'Elige hoy una pequeña acción que lleve esta sesión a la vida cotidiana.', 'Practicar'] },
  fr: { verse: ['Écriture du jour', 'Lire lentement'], reflection: ['Faire une pause', 'Observe ce que ce thème éveille en toi aujourd’hui. Nomme-le avec sincérité, sans jugement.', 'Réfléchir'], prayer: ['Une prière pour commencer', 'Dieu, rejoins-moi en cet instant et forme en moi une réponse fidèle et stable.', 'Prier'], action: ['Un prochain pas simple', 'Choisis aujourd’hui une petite action qui inscrira cette séance dans la vie quotidienne.', 'Pratiquer'] },
  de: { verse: ['Heutige Schriftstelle', 'Langsam lesen'], reflection: ['Innehalten', 'Nimm wahr, was dieses Thema heute in dir weckt. Benenne es ehrlich und ohne Urteil.', 'Nachdenken'], prayer: ['Ein Gebet zum Beginn', 'Gott, begegne mir in diesem Moment und forme in mir eine beständige, treue Antwort.', 'Beten'], action: ['Ein sanfter nächster Schritt', 'Wähle heute eine kleine Handlung, die diese Einheit in deinen Alltag trägt.', 'Üben'] },
  it: { verse: ['Scrittura di oggi', 'Leggi lentamente'], reflection: ['Fermati e osserva', 'Nota ciò che questo tema risveglia oggi in te. Dagli un nome sincero, senza giudicarlo.', 'Rifletti'], prayer: ['Una preghiera per iniziare', 'Dio, incontrami in questo momento e forma in me una risposta salda e fedele.', 'Prega'], action: ['Un piccolo passo', 'Scegli oggi una piccola azione che porti questa sessione nella vita quotidiana.', 'Pratica'] },
  ru: { verse: ['Писание на сегодня', 'Читайте медленно'], reflection: ['Остановитесь и заметьте', 'Заметьте, что эта тема пробуждает в вас сегодня. Назовите это честно и без осуждения.', 'Размышлять'], prayer: ['Молитва для начала', 'Боже, встреть меня в этот момент и сформируй во мне верный и устойчивый ответ.', 'Молиться'], action: ['Один мягкий шаг', 'Выберите сегодня небольшое действие, которое перенесёт эту встречу в обычную жизнь.', 'Практиковать'] },
  pl: { verse: ['Pismo na dziś', 'Czytaj powoli'], reflection: ['Zatrzymaj się', 'Zauważ, co ten temat budzi dziś w tobie. Nazwij to szczerze i bez osądzania.', 'Rozważ'], prayer: ['Modlitwa na początek', 'Boże, spotkaj mnie w tej chwili i kształtuj we mnie wierną, wytrwałą odpowiedź.', 'Módl się'], action: ['Jeden łagodny krok', 'Wybierz dziś małe działanie, które przeniesie tę sesję do codziennego życia.', 'Praktykuj'] },
};

const REFERENCES = ['John 3:16', 'Jeremiah 29:11', 'Psalm 46:10', 'Psalm 23:1', 'John 14:27', 'Psalm 55:22', 'Jeremiah 33:3', 'Psalm 119:105', 'John 15:5', 'Psalm 30:5', 'John 8:12', 'Psalm 34:18', 'John 10:10', 'Psalm 121:1'] as const;

export function buildLongJourneyManifest(input: {
  slug: string;
  themes: readonly string[];
  titles: Record<LongJourneyLocale, [string, string, string]>;
  badge: LongJourneyManifest['badge'];
}): LongJourneyManifest {
  const sessionCount = input.themes.length;
  return {
    slug: input.slug,
    version: 1,
    sessionCount,
    localizations: Object.fromEntries(LONG_JOURNEY_LOCALES.map((locale) => {
      const [title, subtitle, description] = input.titles[locale];
      return [locale, { title, subtitle, description }];
    })) as LongJourneyManifest['localizations'],
    badge: input.badge,
    sessions: input.themes.map((theme, index) => {
      const number = index + 1;
      const padded = String(number).padStart(2, '0');
      const poolTag = `${input.slug}_v1_s${padded}`;
      const stepSeconds = [60, 90, 90, 60] as const;
      return {
        number,
        theme,
        estimatedSeconds: 300,
        steps: LONG_JOURNEY_STEP_TYPES.map((type, stepIndex) => ({
          type,
          blockId: `${poolTag}_${type}`,
          poolTag,
          estimatedSeconds: stepSeconds[stepIndex],
          scriptureRef: type === 'verse' ? REFERENCES[index % REFERENCES.length] : null,
          localizations: Object.fromEntries(LONG_JOURNEY_LOCALES.map((locale) => {
            const copy = STEP_COPY[locale][type];
            const sessionLabel = locale === 'en' ? ` · ${theme} · ${number}` : ` · ${number}`;
            if (type === 'verse') return [locale, { title: `${copy[0]}${sessionLabel}`, body: '', cta: copy[1] }];
            return [locale, { title: `${copy[0]}${sessionLabel}`, body: `${copy[1]} (${number})`, cta: copy[2] }];
          })) as Record<LongJourneyLocale, LocalizedCopy>,
        })),
      };
    }),
  };
}

export const steadyFlame14 = buildLongJourneyManifest({
  slug: 'steady_flame_14',
  themes: ['Begin again', 'Make room', 'Receive peace', 'Practice trust', 'Name gratitude', 'Release control', 'Rest without guilt', 'Return to Scripture', 'Choose kindness', 'Stay present', 'Ask for guidance', 'Carry hope', 'Serve quietly', 'Keep the flame'],
  titles: {
    en: ['Steady Flame', 'Fourteen days to deepen a gentle rhythm', 'A two-week path of Scripture, honest reflection, prayer, and one practical response each day.'],
    pt: ['Chama Constante', 'Quatorze dias para aprofundar um ritmo gentil', 'Um caminho de duas semanas com Escritura, reflexão honesta, oração e uma resposta prática por dia.'],
    es: ['Llama Constante', 'Catorce días para profundizar un ritmo amable', 'Un camino de dos semanas con Escritura, reflexión sincera, oración y una respuesta práctica cada día.'],
    fr: ['Flamme Fidèle', 'Quatorze jours pour approfondir un rythme paisible', 'Un parcours de deux semaines avec Écriture, réflexion, prière et une réponse concrète chaque jour.'],
    de: ['Beständige Flamme', 'Vierzehn Tage für einen ruhigen Glaubensrhythmus', 'Ein zweiwöchiger Weg mit Schrift, ehrlicher Reflexion, Gebet und einem praktischen Schritt pro Tag.'],
    it: ['Fiamma Costante', 'Quattordici giorni per approfondire un ritmo gentile', 'Un percorso di due settimane con Scrittura, riflessione, preghiera e una risposta pratica al giorno.'],
    ru: ['Ровное Пламя', 'Четырнадцать дней для спокойного ритма', 'Двухнедельный путь с Писанием, честным размышлением, молитвой и одним практическим шагом в день.'],
    pl: ['Stały Płomień', 'Czternaście dni pogłębiania łagodnego rytmu', 'Dwutygodniowa droga z Pismem, refleksją, modlitwą i jednym praktycznym krokiem każdego dnia.'],
  },
  badge: { code: 'journey_steady_flame_14', tier: 'steady_flame', assetKey: 'flame.steady', targetValue: 14 },
});
