import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureDailyVersesForDay } from '@/lib/dailyVerse';
import { getExpoPushReceipts, sendExpoPushMessages, type ExpoPushMessage } from '@/lib/expoPush';

type AppSupabaseClient = SupabaseClient<any, any, any, any, any>;

export type DueDailyVerseNotification = {
  user_id: string;
  slot: 1 | 2;
  local_day: string;
  language_code: SupportedLanguage;
  reminder_style: 'scripture' | 'gentle';
  goal: string | null;
  focus: string | null;
};

type VerseReference = { book: string; chapter: number; verse: number };
type VerseResult = { id: string; text_content: string; chapter: number; verse: number; bible_books: { code: string } | Array<{ code: string }> };
type PushToken = { id: string; user_id: string; expo_push_token: string };
type LoadedDailyVerse = { verse: VerseResult; localized: boolean };

export const SUPPORTED_LANGUAGES = ['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
type NotificationTheme =
  | 'habit'
  | 'peace'
  | 'prayer'
  | 'study'
  | 'relationships'
  | 'gratitude'
  | 'purpose'
  | 'hope';

const THEME_REFERENCES: Record<NotificationTheme, VerseReference[]> = {
  habit: [
    { book: 'PSA', chapter: 119, verse: 105 },
    { book: 'JAS', chapter: 1, verse: 22 },
    { book: 'JOS', chapter: 1, verse: 8 },
    { book: 'MAT', chapter: 7, verse: 24 },
  ],
  peace: [
    { book: 'PHP', chapter: 4, verse: 6 },
    { book: 'JHN', chapter: 14, verse: 27 },
    { book: 'PSA', chapter: 4, verse: 8 },
    { book: 'ISA', chapter: 26, verse: 3 },
  ],
  prayer: [
    { book: '1TH', chapter: 5, verse: 17 },
    { book: 'PHP', chapter: 4, verse: 6 },
    { book: 'MAT', chapter: 6, verse: 6 },
    { book: 'ROM', chapter: 12, verse: 12 },
  ],
  study: [
    { book: 'PSA', chapter: 119, verse: 105 },
    { book: '2TI', chapter: 3, verse: 16 },
    { book: 'HEB', chapter: 4, verse: 12 },
    { book: 'JAS', chapter: 1, verse: 5 },
  ],
  relationships: [
    { book: 'COL', chapter: 3, verse: 13 },
    { book: '1CO', chapter: 13, verse: 4 },
    { book: 'EPH', chapter: 4, verse: 2 },
    { book: 'PRO', chapter: 15, verse: 1 },
  ],
  gratitude: [
    { book: '1TH', chapter: 5, verse: 18 },
    { book: 'PSA', chapter: 100, verse: 4 },
    { book: 'COL', chapter: 3, verse: 15 },
    { book: 'PHP', chapter: 4, verse: 4 },
  ],
  purpose: [
    { book: 'PRO', chapter: 3, verse: 5 },
    { book: 'JAS', chapter: 1, verse: 5 },
    { book: 'PSA', chapter: 32, verse: 8 },
    { book: 'ROM', chapter: 12, verse: 2 },
  ],
  hope: [
    { book: 'ROM', chapter: 15, verse: 13 },
    { book: 'ISA', chapter: 41, verse: 10 },
    { book: 'PSA', chapter: 42, verse: 11 },
    { book: 'JER', chapter: 29, verse: 11 },
  ],
};

const TITLES: Record<SupportedLanguage, { scripture: string; gentle: string }> = {
  en: { scripture: 'A verse for your day', gentle: 'A quiet word for you' },
  pt: { scripture: 'Um versículo para o seu dia', gentle: 'Uma palavra serena para você' },
  es: { scripture: 'Un versículo para tu día', gentle: 'Una palabra serena para ti' },
  fr: { scripture: 'Un verset pour ta journée', gentle: 'Une parole paisible pour toi' },
  de: { scripture: 'Ein Vers für deinen Tag', gentle: 'Ein stilles Wort für dich' },
  it: { scripture: 'Un versetto per la tua giornata', gentle: 'Una parola serena per te' },
  ru: { scripture: 'Стих для вашего дня', gentle: 'Спокойное слово для вас' },
  pl: { scripture: 'Werset na Twój dzień', gentle: 'Spokojne słowo dla Ciebie' },
};

const FALLBACK_PROMPTS: Record<SupportedLanguage, string> = {
  en: 'Your verse is ready in Vella',
  pt: 'Seu versículo está pronto na Vella',
  es: 'Tu versículo está listo en Vella',
  fr: 'Ton verset est prêt dans Vella',
  de: 'Dein Vers ist in Vella bereit',
  it: 'Il tuo versetto è pronto su Vella',
  ru: 'Ваш стих готов в Vella',
  pl: 'Twój werset jest gotowy w Vella',
};

const GENTLE_MESSAGES: Record<SupportedLanguage, Record<NotificationTheme, string>> = {
  en: {
    habit: 'One faithful step today is already a beginning.',
    peace: 'Breathe slowly. You do not have to carry everything at once.',
    prayer: 'This moment can become a simple, honest prayer.',
    study: 'Read slowly; one truth can stay with you all day.',
    relationships: 'Choose the word that brings people closer, welcomes, and heals.',
    gratitude: 'Notice one small grace that is already here.',
    purpose: 'Your next step does not need to be big; it needs to be true.',
    hope: 'This season is not the whole story. Keep walking with hope.',
  },
  pt: {
    habit: 'Um pequeno passo fiel hoje já é um começo.',
    peace: 'Respire devagar. Você não precisa carregar tudo de uma vez.',
    prayer: 'Este momento pode se tornar uma oração simples e sincera.',
    study: 'Leia com calma; uma verdade pode acompanhar todo o seu dia.',
    relationships: 'Escolha hoje a palavra que aproxima, acolhe e cura.',
    gratitude: 'Perceba uma pequena graça que já está presente.',
    purpose: 'Seu próximo passo não precisa ser grande; precisa ser verdadeiro.',
    hope: 'Esta fase não é a história inteira. Continue caminhando com esperança.',
  },
  es: {
    habit: 'Un pequeño paso fiel hoy ya es un comienzo.',
    peace: 'Respira despacio. No tienes que cargar con todo a la vez.',
    prayer: 'Este momento puede convertirse en una oración sencilla y sincera.',
    study: 'Lee con calma; una verdad puede acompañarte todo el día.',
    relationships: 'Elige hoy la palabra que acerca, acoge y sana.',
    gratitude: 'Reconoce una pequeña gracia que ya está presente.',
    purpose: 'Tu próximo paso no tiene que ser grande; tiene que ser verdadero.',
    hope: 'Esta etapa no es toda la historia. Sigue caminando con esperanza.',
  },
  fr: {
    habit: 'Un petit pas fidèle aujourd’hui est déjà un commencement.',
    peace: 'Respire doucement. Tu n’as pas à tout porter en même temps.',
    prayer: 'Cet instant peut devenir une prière simple et sincère.',
    study: 'Lis lentement ; une vérité peut t’accompagner toute la journée.',
    relationships: 'Choisis aujourd’hui la parole qui rapproche, accueille et guérit.',
    gratitude: 'Remarque une petite grâce qui est déjà présente.',
    purpose: 'Ton prochain pas n’a pas besoin d’être grand, mais d’être vrai.',
    hope: 'Cette saison n’est pas toute l’histoire. Continue d’avancer avec espérance.',
  },
  de: {
    habit: 'Ein kleiner treuer Schritt heute ist bereits ein Anfang.',
    peace: 'Atme langsam. Du musst nicht alles auf einmal tragen.',
    prayer: 'Dieser Moment kann zu einem einfachen, ehrlichen Gebet werden.',
    study: 'Lies in Ruhe; eine Wahrheit kann dich den ganzen Tag begleiten.',
    relationships: 'Wähle heute das Wort, das verbindet, annimmt und heilt.',
    gratitude: 'Nimm eine kleine Gnade wahr, die schon da ist.',
    purpose: 'Dein nächster Schritt muss nicht groß sein, sondern wahrhaftig.',
    hope: 'Diese Zeit ist nicht die ganze Geschichte. Geh hoffnungsvoll weiter.',
  },
  it: {
    habit: 'Un piccolo passo fedele oggi è già un inizio.',
    peace: 'Respira lentamente. Non devi portare tutto in una volta.',
    prayer: 'Questo momento può diventare una preghiera semplice e sincera.',
    study: 'Leggi con calma; una verità può accompagnarti per tutto il giorno.',
    relationships: 'Scegli oggi la parola che avvicina, accoglie e guarisce.',
    gratitude: 'Riconosci una piccola grazia che è già presente.',
    purpose: 'Il tuo prossimo passo non deve essere grande; deve essere autentico.',
    hope: 'Questa stagione non è tutta la storia. Continua a camminare con speranza.',
  },
  ru: {
    habit: 'Один верный шаг сегодня — уже начало.',
    peace: 'Дышите медленно. Вам не нужно нести всё сразу.',
    prayer: 'Этот миг может стать простой и искренней молитвой.',
    study: 'Читайте неспешно; одна истина может сопровождать вас весь день.',
    relationships: 'Выберите сегодня слова, которые сближают, принимают и исцеляют.',
    gratitude: 'Заметьте маленькую благодать, которая уже рядом.',
    purpose: 'Следующий шаг не должен быть большим; он должен быть настоящим.',
    hope: 'Этот период — не вся история. Продолжайте идти с надеждой.',
  },
  pl: {
    habit: 'Jeden wierny krok dzisiaj jest już początkiem.',
    peace: 'Oddychaj powoli. Nie musisz nieść wszystkiego naraz.',
    prayer: 'Ta chwila może stać się prostą i szczerą modlitwą.',
    study: 'Czytaj spokojnie; jedna prawda może towarzyszyć Ci przez cały dzień.',
    relationships: 'Wybierz dziś słowo, które zbliża, przyjmuje i uzdrawia.',
    gratitude: 'Dostrzeż małą łaskę, która już jest obecna.',
    purpose: 'Twój następny krok nie musi być wielki; musi być prawdziwy.',
    hope: 'Ten czas nie jest całą historią. Idź dalej z nadzieją.',
  },
};

export function notificationTheme(input: Pick<DueDailyVerseNotification, 'goal' | 'focus'>) {
  if (input.focus === 'anxiety' || input.goal === 'peace') return 'peace';
  if (input.focus === 'relationships' || input.goal === 'family') return 'relationships';
  if (input.focus === 'gratitude') return 'gratitude';
  if (input.focus === 'purpose') return 'purpose';
  if (input.focus === 'hard_season') return 'hope';
  if (input.goal === 'prayer') return 'prayer';
  if (input.goal === 'study') return 'study';
  return 'habit';
}

function stableReferenceIndex(seed: string, size: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % size;
}

export function selectNotificationReference(due: DueDailyVerseNotification) {
  const theme = notificationTheme(due);
  const references = THEME_REFERENCES[theme];
  const firstIndex = stableReferenceIndex(`${due.user_id}:${due.local_day}:${theme}`, references.length);
  return references[(firstIndex + Math.max(0, due.slot - 1)) % references.length];
}

export function gentleNotificationBody(
  language: string,
  input: Pick<DueDailyVerseNotification, 'goal' | 'focus'>,
) {
  const normalized = SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
    ? language as SupportedLanguage
    : 'en';
  return GENTLE_MESSAGES[normalized][notificationTheme(input)];
}

export function notificationTitle(language: string, style: 'scripture' | 'gentle') {
  const normalized = SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
    ? language as SupportedLanguage
    : 'en';
  return TITLES[normalized][style];
}

export function notificationBody(text: string, reference: VerseReference) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const maxVerseLength = 178;
  const verse = normalized.length > maxVerseLength
    ? `${normalized.slice(0, maxVerseLength - 1).trimEnd()}…`
    : normalized;
  return `${verse} — ${reference.book} ${reference.chapter}:${reference.verse}`;
}

export function notificationFallbackBody(language: string, reference: VerseReference) {
  const normalized = SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
    ? language as SupportedLanguage
    : 'en';
  return `${FALLBACK_PROMPTS[normalized]} · ${reference.book} ${reference.chapter}:${reference.verse}`;
}

function firstRelation<T>(value: T | T[]): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function normalizeDailyVerseRow(input: unknown): VerseResult | null {
  if (!input || typeof input !== 'object') return null;
  const relation = firstRelation((input as { bible_verses?: unknown | unknown[] }).bible_verses);
  if (!relation || typeof relation !== 'object') return null;
  const row = relation as Partial<VerseResult>;
  const book = firstRelation(row.bible_books ?? []);
  if (
    typeof row.id !== 'string'
    || typeof row.text_content !== 'string'
    || !Number.isInteger(row.chapter)
    || !Number.isInteger(row.verse)
    || !book
    || typeof book.code !== 'string'
  ) return null;
  return row as VerseResult;
}

function verseReference(verse: VerseResult): VerseReference {
  const book = firstRelation(verse.bible_books);
  return { book: book?.code ?? 'BIBLE', chapter: verse.chapter, verse: verse.verse };
}

async function loadDailyVerse(
  supabase: AppSupabaseClient,
  language: SupportedLanguage,
  day: string,
): Promise<LoadedDailyVerse | null> {
  const select = `
    verse_id,
    bible_verses!inner(
      id,
      text_content,
      chapter,
      verse,
      bible_books!inner(code),
      bible_versions!inner(is_active)
    )
  `;
  const query = async (lang: SupportedLanguage) => supabase
    .from('daily_verses')
    .select(select)
    .eq('language_code', lang)
    .eq('day', day)
    .eq('bible_verses.bible_versions.is_active', true)
    .limit(1)
    .maybeSingle();

  const localized = await query(language);
  if (localized.error) throw new Error('Localized daily verse lookup failed');
  const localizedVerse = normalizeDailyVerseRow(localized.data);
  if (localizedVerse) return { verse: localizedVerse, localized: true };
  if (language === 'en') return null;

  const fallback = await query('en');
  if (fallback.error) throw new Error('Fallback daily verse lookup failed');
  const fallbackVerse = normalizeDailyVerseRow(fallback.data);
  return fallbackVerse ? { verse: fallbackVerse, localized: false } : null;
}

async function claimDelivery(
  supabase: AppSupabaseClient,
  due: DueDailyVerseNotification,
  token: PushToken,
  verseId: string,
) {
  const { data, error } = await supabase
    .from('daily_verse_notification_deliveries')
    .insert({
      user_id: due.user_id,
      push_token_id: token.id,
      local_day: due.local_day,
      slot: due.slot,
      verse_id: verseId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error?.code === '23505') return null;
  if (error || !data) throw new Error(error?.message ?? 'Could not claim notification delivery');
  return data.id as string;
}

async function updateDelivery(
  supabase: AppSupabaseClient,
  deliveryId: string,
  values: Record<string, unknown>,
) {
  await supabase.from('daily_verse_notification_deliveries').update(values).eq('id', deliveryId);
}

export async function processPushReceipts(supabase: AppSupabaseClient, now = new Date()) {
  const cutoff = new Date(now.getTime() - 15 * 60_000).toISOString();
  const { data } = await supabase
    .from('daily_verse_notification_deliveries')
    .select('id, push_token_id, expo_ticket_id')
    .eq('status', 'accepted')
    .lt('attempted_at', cutoff)
    .not('expo_ticket_id', 'is', null)
    .limit(500);

  const pending = (data ?? []).filter((item) => typeof item.expo_ticket_id === 'string');
  if (pending.length === 0) return { checked: 0, delivered: 0, failed: 0 };

  const receipts = await getExpoPushReceipts(pending.map((item) => item.expo_ticket_id as string));
  let delivered = 0;
  let failed = 0;
  for (const item of pending) {
    const receipt = receipts[item.expo_ticket_id as string];
    if (!receipt) continue;
    const errorCode = receipt.details?.error ?? null;
    const nextStatus = receipt.status === 'ok' ? 'delivered' : 'failed';
    await updateDelivery(supabase, item.id, {
      status: nextStatus,
      receipt_checked_at: now.toISOString(),
      error_code: errorCode,
      error_message: receipt.message ?? null,
    });
    if (receipt.status === 'ok') delivered += 1;
    else failed += 1;
    if (errorCode === 'DeviceNotRegistered') {
      await supabase.from('user_push_tokens').update({ is_active: false }).eq('id', item.push_token_id);
    }
  }
  return { checked: pending.length, delivered, failed };
}

export async function sendDueDailyVerseNotifications(
  supabase: AppSupabaseClient,
  dueItems: DueDailyVerseNotification[],
  options: { dryRun?: boolean } = {},
) {
  const result = {
    due: dueItems.length,
    activeTokens: 0,
    cacheDays: 0,
    cachePrepared: 0,
    cacheFailed: 0,
    claimed: 0,
    accepted: 0,
    failed: 0,
    skipped: {
      noActiveToken: 0,
      noVerse: 0,
      verseLookupFailed: 0,
      alreadyClaimed: 0,
      dryRun: 0,
      claimFailed: 0,
    },
  };
  const userIds = [...new Set(dueItems.map((item) => item.user_id))];
  if (userIds.length === 0) return result;

  const { data: tokenRows, error: tokenError } = await supabase
    .from('user_push_tokens')
    .select('id, user_id, expo_push_token')
    .eq('is_active', true)
    .in('user_id', userIds);
  if (tokenError) throw new Error(tokenError.message);
  const tokens = (tokenRows ?? []) as PushToken[];
  result.activeTokens = tokens.length;

  const tokensByUser = new Map<string, PushToken[]>();
  for (const token of tokens) {
    const current = tokensByUser.get(token.user_id) ?? [];
    current.push(token);
    tokensByUser.set(token.user_id, current);
  }

  const deliverableDueItems = dueItems.filter((due) => {
    if ((tokensByUser.get(due.user_id)?.length ?? 0) > 0) return true;
    result.skipped.noActiveToken += 1;
    return false;
  });

  const localDays = [...new Set(deliverableDueItems.map((due) => due.local_day))];
  result.cacheDays = localDays.length;
  if (!options.dryRun) {
    for (const localDay of localDays) {
      try {
        await ensureDailyVersesForDay(supabase, localDay);
        result.cachePrepared += 1;
      } catch (error) {
        result.cacheFailed += 1;
        console.error('[daily-verse-notifications] cache_prepare_failed', {
          localDay,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  const verseCache = new Map<string, LoadedDailyVerse | null>();
  const verseLookupFailures = new Set<string>();
  const messages: ExpoPushMessage[] = [];
  const claims: Array<{ deliveryId: string; tokenId: string }> = [];

  for (const due of deliverableDueItems) {
    const cacheKey = `${due.local_day}:${due.language_code}`;
    if (!verseCache.has(cacheKey)) {
      try {
        verseCache.set(cacheKey, await loadDailyVerse(supabase, due.language_code, due.local_day));
      } catch (error) {
        verseCache.set(cacheKey, null);
        verseLookupFailures.add(cacheKey);
        console.error('[daily-verse-notifications] verse_lookup_failed', {
          localDay: due.local_day,
          language: due.language_code,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    const loadedVerse = verseCache.get(cacheKey);
    if (!loadedVerse) {
      if (verseLookupFailures.has(cacheKey)) result.skipped.verseLookupFailed += 1;
      else result.skipped.noVerse += 1;
      continue;
    }
    const { verse } = loadedVerse;
    const reference = verseReference(verse);
    const userTokens = tokensByUser.get(due.user_id) ?? [];
    for (const token of userTokens) {
      if (options.dryRun) {
        result.skipped.dryRun += 1;
        continue;
      }
      let deliveryId: string | null;
      try {
        deliveryId = await claimDelivery(supabase, due, token, verse.id);
      } catch (error) {
        result.failed += 1;
        result.skipped.claimFailed += 1;
        console.error('[daily-verse-notifications] delivery_claim_failed', {
          localDay: due.local_day,
          slot: due.slot,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        continue;
      }
      if (!deliveryId) {
        result.skipped.alreadyClaimed += 1;
        continue;
      }
      claims.push({ deliveryId, tokenId: token.id });
      messages.push({
        to: token.expo_push_token,
        sound: 'default',
        channelId: 'vella-daily',
        priority: 'high',
        title: notificationTitle(due.language_code, due.reminder_style),
        body: due.reminder_style === 'gentle'
          ? gentleNotificationBody(due.language_code, due)
          : loadedVerse.localized
            ? notificationBody(verse.text_content, reference)
            : notificationFallbackBody(due.language_code, reference),
        data: {
          source: 'vella-daily-verse',
          route: '/(tabs)/read',
          verseId: verse.id,
          language: due.language_code,
          slot: due.slot,
        },
      });
    }
  }

  result.claimed = claims.length;
  if (options.dryRun || messages.length === 0) {
    return result;
  }

  let tickets;
  try {
    tickets = await sendExpoPushMessages(messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[daily-verse-notifications] expo_send_failed', {
      messageCount: messages.length,
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    await Promise.all(claims.map((claim) => updateDelivery(supabase, claim.deliveryId, {
      status: 'failed',
      error_code: 'expo_request_failed',
      error_message: message,
    })));
    result.failed += claims.length;
    return result;
  }

  for (let index = 0; index < claims.length; index += 1) {
    const claim = claims[index];
    const ticket = tickets[index];
    if (ticket?.status === 'ok' && ticket.id) {
      result.accepted += 1;
      await updateDelivery(supabase, claim.deliveryId, { status: 'accepted', expo_ticket_id: ticket.id });
      continue;
    }
    result.failed += 1;
    const errorCode = ticket?.details?.error ?? 'expo_ticket_error';
    await updateDelivery(supabase, claim.deliveryId, {
      status: 'failed',
      error_code: errorCode,
      error_message: ticket?.message ?? 'Expo rejected the notification',
    });
    if (errorCode === 'DeviceNotRegistered') {
      await supabase.from('user_push_tokens').update({ is_active: false }).eq('id', claim.tokenId);
    }
  }

  if (result.failed > 0) {
    console.warn('[daily-verse-notifications] expo_tickets_rejected', {
      claimed: result.claimed,
      accepted: result.accepted,
      failed: result.failed,
    });
  }

  return result;
}
