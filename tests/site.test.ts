import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { generateMetadata as generateLocaleMetadata } from '@/app/[locale]/layout';
import sitemap from '@/app/sitemap';
import { middleware } from '@/middleware';
import { StoreLinks } from '@/components/site/StoreLinks';
import { BLOG_SLUGS, getPosts } from '@/lib/site/blog';
import {
  APP_STORE_URL,
  ANDROID_STORE_AVAILABLE,
  DEFAULT_LOCALE,
  IOS_STORE_AVAILABLE,
  LOCALES,
  PLAY_STORE_URL,
  STORE_CAMPAIGN,
  STORE_CTA_EVENT,
  availableStoreUrls,
  languageAlternates,
  localizedPath,
  playStoreCampaignUrl,
  storeAvailabilityFromEnv,
  storeCtaId,
} from '@/lib/site/config';
import { getCopy } from '@/lib/site/content';
import { localizedMetadata } from '@/lib/site/metadata';
import {
  PRAYER_SPACE_ARTICLE_PATH,
  PRAYER_SPACE_PATH,
  getPrayerSpaceCopy,
} from '@/lib/site/prayerSpace';
import { PRAYER_SPACE_ARTICLE_SLUG } from '@/lib/site/prayerSpaceArticle';
import storeMetadata from '@/docs/store-metadata.json';

const storeSubmissionPackage = readFileSync(
  new URL('../docs/STORE_SUBMISSION_PACKAGE.md', import.meta.url),
  'utf8',
);
const googleAdsReadiness = readFileSync(
  new URL('../docs/GOOGLE_ADS_BR_ANDROID_READY.md', import.meta.url),
  'utf8',
);
const growthPlatformAccess = readFileSync(
  new URL('../docs/GROWTH_PLATFORM_ACCESS_BR.md', import.meta.url),
  'utf8',
);
const appleReviewNotes = readFileSync(
  new URL('../docs/APPLE_REVIEW_NOTES_READY.md', import.meta.url),
  'utf8',
);
const releaseFinishLine = readFileSync(
  new URL('../docs/RELEASE_FINISH_LINE.md', import.meta.url),
  'utf8',
);
const historicalFinalProductAudit = readFileSync(
  new URL('../docs/FINAL_PRODUCT_AUDIT_2026-07-31.md', import.meta.url),
  'utf8',
);
const historicalProductionAudit = readFileSync(
  new URL('../docs/VELLA_PRODUCTION_AUDIT.md', import.meta.url),
  'utf8',
);
const renderToStaticMarkup = (
  createRequire(import.meta.url)('react-dom/server') as {
    renderToStaticMarkup: (element: unknown) => string;
  }
).renderToStaticMarkup;

function markdownSection(source: string, startHeading: string, endHeading: string): string {
  const start = source.indexOf(startHeading);
  if (start < 0) return '';
  const end = source.indexOf(endHeading, start + startHeading.length);
  return source.slice(start, end < 0 ? undefined : end);
}

function markdownTableRows(section: string): string[][] {
  return section
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| ---'))
    .slice(1)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

const subscriptionCopyChecks = {
  en: { trial: '14-day trial', locked: 'features lock' },
  pt: { trial: '14 dias de teste', locked: 'recursos do app ficam bloqueados' },
  es: { trial: '14 días de prueba', locked: 'funciones de la app quedarán bloqueados' },
  fr: { trial: "14 jours d'essai", locked: "fonctionnalités de l'app sont verrouillés" },
  de: { trial: '14 tage kostenlos', locked: 'app-inhalte und -funktionen gesperrt' },
  it: { trial: '14 giorni di prova', locked: "funzioni dell'app vengono bloccati" },
  ru: { trial: '14-дневный пробный период', locked: 'функции приложения будут заблокированы' },
  pl: { trial: '14-dniowy okres próbny', locked: 'funkcje aplikacji zostaną zablokowane' },
} as const;

const crossPlatformDownloadChecks = {
  en: {
    body: 'Vella is available now in the App Store for iPhone and on Google Play for Android.',
    availability: 'Available now in the App Store and on Google Play.',
    desktopHint: 'Open the App Store or Google Play to install Vella on your phone.',
    contextualBody: 'Open Vella on iPhone or Android to save Scripture, pray in your own words, and return tomorrow.',
    iosUnavailable: 'App Store temporarily unavailable',
  },
  pt: {
    body: 'A Vella já está disponível na App Store para iPhone e no Google Play para Android.',
    availability: 'Disponível agora na App Store e no Google Play.',
    desktopHint: 'Abra a App Store ou o Google Play para instalar a Vella no seu celular.',
    contextualBody: 'Abra a Vella no iPhone ou Android para salvar versículos, orar com suas próprias palavras e voltar amanhã.',
    iosUnavailable: 'App Store temporariamente indisponível',
  },
  es: {
    body: 'Vella ya está disponible en App Store para iPhone y en Google Play para Android.',
    availability: 'Disponible ahora en App Store y Google Play.',
    desktopHint: 'Abre App Store o Google Play para instalar Vella en tu teléfono.',
    contextualBody: 'Abre Vella en iPhone o Android para guardar pasajes, orar con tus propias palabras y volver mañana.',
    iosUnavailable: 'App Store no disponible temporalmente',
  },
  fr: {
    body: "Vella est maintenant disponible dans l'App Store pour iPhone et sur Google Play pour Android.",
    availability: "Disponible maintenant dans l'App Store et sur Google Play.",
    desktopHint: "Ouvrez l'App Store ou Google Play pour installer Vella sur votre téléphone.",
    contextualBody: 'Ouvrez Vella sur iPhone ou Android pour enregistrer des passages, prier avec vos propres mots et revenir demain.',
    iosUnavailable: 'App Store temporairement indisponible',
  },
  de: {
    body: 'Vella ist jetzt im App Store für iPhone sowie bei Google Play für Android verfügbar.',
    availability: 'Jetzt im App Store und bei Google Play verfügbar.',
    desktopHint: 'Öffne den App Store oder Google Play, um Vella auf deinem Smartphone zu installieren.',
    contextualBody: 'Öffne Vella auf iPhone oder Android, um Bibelstellen zu speichern, mit eigenen Worten zu beten und morgen zurückzukehren.',
    iosUnavailable: 'App Store vorübergehend nicht verfügbar',
  },
  it: {
    body: "Vella è ora disponibile sull'App Store per iPhone e su Google Play per Android.",
    availability: "Disponibile ora sull'App Store e su Google Play.",
    desktopHint: "Apri l'App Store o Google Play per installare Vella sul tuo telefono.",
    contextualBody: 'Apri Vella su iPhone o Android per salvare brani, pregare con parole tue e tornare domani.',
    iosUnavailable: 'App Store temporaneamente non disponibile',
  },
  ru: {
    body: 'Vella уже доступна в App Store для iPhone и в Google Play для Android.',
    availability: 'Уже доступно в App Store и Google Play.',
    desktopHint: 'Откройте App Store или Google Play, чтобы установить Vella на телефон.',
    contextualBody: 'Откройте Vella на iPhone или Android, чтобы сохранять отрывки, молиться своими словами и вернуться завтра.',
    iosUnavailable: 'App Store временно недоступен',
  },
  pl: {
    body: "Vella jest już dostępna w App Store na iPhone'a oraz w Google Play na Androida.",
    availability: 'Już dostępna w App Store i Google Play.',
    desktopHint: 'Otwórz App Store lub Google Play, aby zainstalować Vella na telefonie.',
    contextualBody: 'Otwórz Vella na iPhonie lub Androidzie, aby zapisywać fragmenty, modlić się własnymi słowami i wrócić jutro.',
    iosUnavailable: 'App Store tymczasowo niedostępny',
  },
} as const;

const storeDescriptionContract = {
  en: {
    mobileLocale: 'en-US',
    tableLocale: 'en',
    firstExperience: 'Before account creation, each new user receives exactly one anonymous, personalized first Vella moment. Account creation follows that moment. After sign-in, app content and features remain locked until an active Vella Premium subscription or active eligible introductory trial is confirmed; there is no permanent free tier.',
    subscription: 'The monthly plan is charged immediately and has no free trial. Eligible new annual subscribers may receive exactly 14 days from Apple or Google; the store determines eligibility and shows the full localized annual renewal price and terms before confirmation. The annual subscription renews automatically. Manage or cancel it in Apple or Google subscription settings. Cancel before the trial ends and you will not be charged the annual price. If you are not eligible for the annual offer or choose monthly, no free trial is offered.',
  },
  pt: {
    mobileLocale: 'pt-BR',
    tableLocale: 'pt-BR',
    firstExperience: 'Antes da criação da conta, cada novo usuário recebe exatamente um primeiro momento Vella anônimo e personalizado. A criação da conta vem depois desse momento. Após o login, o conteúdo e os recursos do app ficam bloqueados até a confirmação de uma assinatura Vella Premium ativa ou de um teste introdutório elegível ativo; não há plano gratuito permanente.',
    subscription: 'O plano mensal é cobrado imediatamente e não tem teste grátis. Novos assinantes anuais elegíveis podem receber exatamente 14 dias da Apple ou do Google; a loja determina a elegibilidade e exibe o preço anual completo de renovação e os termos localizados antes da confirmação. A assinatura anual é renovada automaticamente. Gerencie ou cancele nos ajustes de assinaturas da Apple ou do Google. Cancele antes do fim do teste e o preço anual não será cobrado. Se você não for elegível para a oferta anual ou escolher o plano mensal, não haverá teste grátis.',
  },
  es: {
    mobileLocale: 'es-ES',
    tableLocale: 'es-ES',
    firstExperience: 'Antes de crear la cuenta, cada nuevo usuario recibe exactamente un primer momento Vella anónimo y personalizado. La creación de la cuenta viene después de ese momento. Tras iniciar sesión, el contenido y las funciones de la app permanecen bloqueados hasta que se confirme una suscripción activa a Vella Premium o una prueba introductoria elegible activa; no hay un nivel gratuito permanente.',
    subscription: 'El plan mensual se cobra de inmediato y no incluye prueba gratuita. Los nuevos suscriptores anuales elegibles pueden recibir exactamente 14 días de Apple o Google; la tienda determina la elegibilidad y muestra el precio anual completo de renovación y los términos localizados antes de la confirmación. La suscripción anual se renueva automáticamente. Adminístrala o cancélala en los ajustes de suscripciones de Apple o Google. Cancela antes de que termine la prueba y no se te cobrará el precio anual. Si no cumples los requisitos para la oferta anual o eliges el plan mensual, no se ofrece ninguna prueba gratuita.',
  },
  fr: {
    mobileLocale: 'fr-FR',
    tableLocale: 'fr-FR',
    firstExperience: "Avant la création du compte, chaque nouvel utilisateur reçoit exactement un premier moment Vella anonyme et personnalisé. La création du compte suit ce moment. Après la connexion, les contenus et fonctions de l'app restent verrouillés jusqu'à la confirmation d'un abonnement Vella Premium actif ou d'un essai promotionnel éligible actif ; il n'existe aucune offre gratuite permanente.",
    subscription: "Le forfait mensuel est facturé immédiatement et ne comprend aucun essai gratuit. Les nouveaux abonnés annuels éligibles peuvent recevoir exactement 14 jours de la part d'Apple ou de Google ; la boutique détermine l'éligibilité et affiche le prix annuel complet du renouvellement et les conditions localisées avant confirmation. L'abonnement annuel se renouvelle automatiquement. Gérez-le ou annulez-le dans les réglages d'abonnement Apple ou Google. Annulez avant la fin de l'essai et le prix annuel ne vous sera pas facturé. Si vous n'êtes pas éligible à l'offre annuelle ou choisissez le forfait mensuel, aucun essai gratuit n'est proposé.",
  },
  de: {
    mobileLocale: 'de-DE',
    tableLocale: 'de-DE',
    firstExperience: 'Vor der Kontoerstellung erhält jeder neue Nutzer genau einen anonymen, personalisierten ersten Vella-Moment. Danach wird das Konto erstellt. Nach der Anmeldung bleiben App-Inhalte und Funktionen gesperrt, bis ein aktives Vella-Premium-Abonnement oder ein aktiver berechtigter Einführungszeitraum bestätigt ist; es gibt keine dauerhaft kostenlose Stufe.',
    subscription: 'Der Monatsplan wird sofort berechnet und hat keinen kostenlosen Testzeitraum. Berechtigte neue Jahresabonnenten können genau 14 Tage erhalten; Apple oder Google stellt sie bereit, und der Store bestimmt die Berechtigung und zeigt vor der Bestätigung den vollständigen lokalisierten Jahresverlängerungspreis und die Bedingungen. Das Jahresabonnement verlängert sich automatisch. Verwalte oder kündige es in den Abonnementeinstellungen von Apple oder Google. Kündige vor Ende des Testzeitraums; dann wird der Jahrespreis nicht berechnet. Wenn du für das Jahresangebot nicht berechtigt bist oder den Monatsplan wählst, gibt es keinen kostenlosen Testzeitraum.',
  },
  it: {
    mobileLocale: 'it',
    tableLocale: 'it-IT',
    firstExperience: "Prima della creazione dell'account, ogni nuovo utente riceve esattamente un primo momento Vella anonimo e personalizzato. La creazione dell'account avviene dopo quel momento. Dopo l'accesso, i contenuti e le funzioni dell'app restano bloccati finché non viene confermato un abbonamento Vella Premium attivo o una prova introduttiva idonea attiva; non esiste un livello gratuito permanente.",
    subscription: "Il piano mensile viene addebitato subito e non include una prova gratuita. I nuovi abbonati annuali idonei possono ricevere esattamente 14 giorni da Apple o Google; lo store determina l'idoneità e mostra il prezzo annuale completo di rinnovo e i termini localizzati prima della conferma. L'abbonamento annuale si rinnova automaticamente. Gestiscilo o annullalo nelle impostazioni degli abbonamenti Apple o Google. Annulla prima della fine della prova e il prezzo annuale non ti verrà addebitato. Se non hai diritto all'offerta annuale o scegli il piano mensile, non viene offerta alcuna prova gratuita.",
  },
  ru: {
    mobileLocale: 'ru',
    tableLocale: 'ru',
    firstExperience: 'До создания учётной записи каждый новый пользователь получает ровно один анонимный персонализированный первый момент Vella. Затем создаётся учётная запись. После входа контент и функции приложения остаются заблокированными, пока не будет подтверждена активная подписка Vella Premium или активный доступный вводный пробный период; постоянного бесплатного уровня нет.',
    subscription: 'Месячный план оплачивается сразу и не включает бесплатный пробный период. Отвечающие условиям новые годовые подписчики могут получить ровно 14 дней от Apple или Google; магазин определяет право и показывает полную локализованную годовую цену продления и условия до подтверждения. Годовая подписка продлевается автоматически. Управляйте ею или отмените её в настройках подписок Apple или Google. Отмените подписку до окончания пробного периода, и годовая цена не будет списана. Если вы не соответствуете условиям годового предложения или выбираете месячный план, бесплатный пробный период не предоставляется.',
  },
  pl: {
    mobileLocale: 'pl',
    tableLocale: 'pl',
    firstExperience: 'Przed utworzeniem konta każdy nowy użytkownik otrzymuje dokładnie jeden anonimowy, spersonalizowany pierwszy moment Vella. Utworzenie konta następuje po tym momencie. Po zalogowaniu treści i funkcje aplikacji pozostają zablokowane do czasu potwierdzenia aktywnej subskrypcji Vella Premium lub aktywnego kwalifikującego się okresu próbnego; nie ma stałego bezpłatnego poziomu.',
    subscription: 'Plan miesięczny jest płatny od razu i nie obejmuje bezpłatnego okresu próbnego. Uprawnieni nowi subskrybenci planu rocznego mogą otrzymać dokładnie 14 dni od Apple lub Google; sklep określa uprawnienie i pokazuje przed potwierdzeniem pełną zlokalizowaną roczną cenę odnowienia i warunki. Subskrypcja roczna odnawia się automatycznie. Zarządzaj nią lub anuluj ją w ustawieniach subskrypcji Apple lub Google. Anuluj przed końcem okresu próbnego, a roczna cena nie zostanie pobrana. Jeśli nie kwalifikujesz się do oferty rocznej lub wybierzesz plan miesięczny, bezpłatny okres próbny nie jest dostępny.',
  },
} as const;

const workspaceMobileStoreConfigUrl = new URL('../../mobile/store.config.json', import.meta.url);
const workspaceMobileStoreConfig = existsSync(workspaceMobileStoreConfigUrl)
  ? JSON.parse(readFileSync(workspaceMobileStoreConfigUrl, 'utf8')) as {
      apple: { info: Record<string, { description: string }> };
    }
  : null;

const prayerPrivacyChecks = {
  en: {
    private: 'private Prayer Space entries',
    fields: 'prayer check-in dates and counts, answered status, and optional gratitude notes',
    voiceAi: 'recording is securely sent to OpenAI',
    audioRetention: 'does not store the audio',
    notifications: 'never included in notification content',
    accountDeletion: 'account deletion',
  },
  pt: {
    private: 'registros privados',
    fields: 'datas e contagens de check-ins de oração, status de resposta e notas opcionais de gratidão',
    voiceAi: 'gravação será enviada com segurança à OpenAI',
    audioRetention: 'não armazena o áudio',
    notifications: 'nunca é incluído em notificações',
    accountDeletion: 'exclusão da conta',
  },
  es: {
    private: 'entradas privadas',
    fields: 'las fechas y los recuentos de tus momentos de oración, el estado de respuesta y las notas opcionales de gratitud',
    voiceAi: 'grabación se envía de forma segura a OpenAI',
    audioRetention: 'no guarda el audio',
    notifications: 'nunca se incluye en notificaciones',
    accountDeletion: 'eliminar la cuenta',
  },
  fr: {
    private: 'entrées privées',
    fields: 'les dates et le nombre de moments de prière, le statut de réponse et les notes de gratitude facultatives',
    voiceAi: "enregistrement est envoyé de manière sécurisée à OpenAI",
    audioRetention: "ne conserve pas l'audio",
    notifications: "n'est jamais inclus dans les notifications",
    accountDeletion: 'suppression du compte',
  },
  de: {
    private: 'privaten Einträge',
    fields: 'Daten und Anzahl deiner Gebets-Check-ins, den Status ‚erhört‘ und optionale Dankbarkeitsnotizen',
    voiceAi: 'Aufnahme sicher und nur zur Erstellung eines bearbeitbaren Entwurfs an OpenAI',
    audioRetention: 'speichert das Audio nicht',
    notifications: 'wird niemals in Benachrichtigungen aufgenommen',
    accountDeletion: 'Kontolöschung',
  },
  it: {
    private: 'voci private',
    fields: 'date e conteggi dei momenti in cui hai pregato, stato di esaudimento e note facoltative di gratitudine',
    voiceAi: 'registrazione viene inviata in modo sicuro a OpenAI',
    audioRetention: "non conserva l'audio",
    notifications: 'non viene mai incluso nelle notifiche',
    accountDeletion: "eliminazione dell'account",
  },
  ru: {
    private: 'личные записи',
    fields: 'даты и количество отметок о молитве, статус ответа и необязательные заметки благодарности',
    voiceAi: 'запись безопасно отправляется OpenAI',
    audioRetention: 'не хранит аудио',
    notifications: 'никогда не включается в уведомления',
    accountDeletion: 'удалённые вместе с аккаунтом',
  },
  pl: {
    private: 'prywatne wpisy',
    fields: 'daty i liczbę oznaczeń modlitwy, status wysłuchania oraz opcjonalne notatki wdzięczności',
    voiceAi: 'nagranie jest bezpiecznie wysyłane do OpenAI',
    audioRetention: 'nie przechowuje audio',
    notifications: 'nigdy nie trafia do powiadomień',
    accountDeletion: 'usunięte wraz z kontem',
  },
} as const;

const growthAnalyticsPrivacyChecks = {
  en: {
    identifier: 'random pseudonymous installation identifier',
    session: 'random pseudonymous session identifier',
    mechanics: 'paywall views',
    mechanicsEnd: 'store-button clicks',
    excluded: 'Analytics properties deliberately exclude prayers',
    identity: 'email addresses, names, notification tokens, purchase receipts, religious preferences',
    retention: 'no more than 90 days',
    cohorts: 'suppress small cohorts',
    ads: 'audiences for targeted advertising',
  },
  pt: {
    identifier: 'identificador aleatório e pseudônimo de instalação',
    session: 'outro de sessão no site',
    mechanics: 'visualização do paywall',
    mechanicsEnd: 'cliques nos botões das lojas',
    excluded: 'excluem intencionalmente orações',
    identity: 'endereços de e-mail, nomes, tokens de notificação, recibos de compra, preferências religiosas',
    retention: 'no máximo 90 dias',
    cohorts: 'Suprimimos coortes pequenas',
    ads: 'públicos de publicidade direcionada',
  },
  es: {
    identifier: 'identificador aleatorio y seudónimo de instalación',
    session: 'otro de sesión en el sitio web',
    mechanics: 'vistas del muro de pago',
    mechanicsEnd: 'clics en los botones de las tiendas',
    excluded: 'excluyen deliberadamente oraciones',
    identity: 'direcciones de correo electrónico, nombres, tokens de notificación, recibos de compra, preferencias religiosas',
    retention: 'máximo de 90 días',
    cohorts: 'Suprimimos las cohortes pequeñas',
    ads: 'audiencias de publicidad dirigida',
  },
  fr: {
    identifier: "identifiant d'installation aléatoire et pseudonyme",
    session: 'identifiant de session aléatoire et pseudonyme',
    mechanics: "l'affichage du paywall",
    mechanicsEnd: 'clics sur les boutons des boutiques',
    excluded: 'excluent délibérément les prières',
    identity: "adresses e-mail, les noms, les jetons de notification, les reçus d'achat, les préférences religieuses",
    retention: '90 jours au maximum',
    cohorts: 'supprimons les petites cohortes',
    ads: 'audiences de publicité ciblée',
  },
  de: {
    identifier: 'zufälligen pseudonymen Installationskennung',
    session: 'zufälligen pseudonymen Sitzungskennung',
    mechanics: 'Paywall-Aufrufe',
    mechanicsEnd: 'Klicks auf Store-Schaltflächen',
    excluded: 'schließen Gebete, Suchen',
    identity: 'E-Mail-Adressen, Namen, Benachrichtigungstoken, Kaufbelege, religiöse Präferenzen',
    retention: 'höchstens 90 Tage',
    cohorts: 'Kleine Kohorten werden in Berichten unterdrückt',
    ads: 'Zielgruppen für personalisierte Werbung',
  },
  it: {
    identifier: "identificativo casuale e pseudonimo dell'installazione",
    session: 'identificativo casuale e pseudonimo della sessione',
    mechanics: 'visualizzazioni del paywall',
    mechanicsEnd: 'clic sui pulsanti degli store',
    excluded: 'escludono intenzionalmente preghiere',
    identity: 'indirizzi e-mail, nomi, token di notifica, ricevute di acquisto, preferenze religiose',
    retention: 'non più di 90 giorni',
    cohorts: 'escludiamo le coorti piccole',
    ads: 'segmenti di pubblico per pubblicità mirata',
  },
  ru: {
    identifier: 'случайным псевдонимным идентификатором установки',
    session: 'случайным псевдонимным идентификатором сессии',
    mechanics: 'просмотр экрана подписки',
    mechanicsEnd: 'нажатия кнопок магазинов приложений',
    excluded: 'намеренно не включаются молитвы',
    identity: 'адреса электронной почты, имена, токены уведомлений, чеки о покупке, религиозные предпочтения',
    retention: 'не более 90 дней',
    cohorts: 'исключаем малые когорты',
    ads: 'аудиторий для таргетированной рекламы',
  },
  pl: {
    identifier: 'losowym pseudonimowym identyfikatorem instalacji',
    session: 'losowym pseudonimowym identyfikatorem sesji',
    mechanics: 'wyświetlenie ekranu płatności',
    mechanicsEnd: 'kliknięcia przycisków sklepów',
    excluded: 'celowo wykluczają modlitwy',
    identity: 'adresy e-mail, imiona i nazwiska, tokeny powiadomień, potwierdzenia zakupu, preferencje religijne',
    retention: 'nie dłużej niż 90 dni',
    cohorts: 'pomijamy małe kohorty',
    ads: 'grup odbiorców reklamy ukierunkowanej',
  },
} as const;

const installAttributionPrivacyChecks = {
  en: {
    coarse: 'coarse first-party install attribution',
    androidDiscard: 'discards the raw referrer on the device',
    appleToken: 'transient Apple AdServices attribution token',
    appleBounded: 'only coarse, bounded campaign fields',
    appleDiscard: "discards both the token and Apple's raw response",
    profile: 'linked to that Vella profile',
    excluded: 'IDFA, Google Advertising ID (AAID), ATT, device fingerprinting, or cross-app tracking',
  },
  pt: {
    coarse: 'atribuição própria e aproximada da instalação',
    androidDiscard: 'descarta o referenciador bruto no próprio aparelho',
    appleToken: 'token transitório de atribuição do Apple AdServices',
    appleBounded: 'apenas campos de campanha gerais e delimitados',
    appleDiscard: 'descarta tanto o token quanto a resposta bruta da Apple',
    profile: 'vinculada a esse perfil da Vella',
    excluded: 'IDFA, o ID de publicidade do Google (AAID), ATT, impressão digital do dispositivo ou rastreamento entre apps',
  },
  es: {
    coarse: 'atribución propia y aproximada de la instalación',
    androidDiscard: 'descarta el referidor sin procesar en el dispositivo',
    appleToken: 'token transitorio de atribución de Apple AdServices',
    appleBounded: 'solo campos de campaña generales y acotados',
    appleDiscard: 'descarta tanto el token como la respuesta sin procesar de Apple',
    profile: 'vincularse a ese perfil de Vella',
    excluded: 'IDFA, el identificador de publicidad de Google (AAID), ATT, huellas digitales del dispositivo ni seguimiento entre apps',
  },
  fr: {
    coarse: "attribution interne et approximative de l'installation",
    androidDiscard: "supprime le référent brut sur l'appareil",
    appleToken: "jeton d'attribution temporaire Apple AdServices",
    appleBounded: 'uniquement des champs de campagne généraux et bornés',
    appleDiscard: "supprime à la fois le jeton et la réponse brute d'Apple",
    profile: 'associée à ce profil Vella',
    excluded: "IDFA, l'identifiant publicitaire Google (AAID), ATT, l'empreinte numérique de l'appareil ni le suivi inter-apps",
  },
  de: {
    coarse: 'grobe, selbst erhobene Installationsattribution',
    androidDiscard: 'verwirft den rohen Referrer auf dem Gerät',
    appleToken: 'vorübergehendes Apple-AdServices-Attributionstoken',
    appleBounded: 'nur grobe, begrenzte Kampagnenfelder',
    appleDiscard: 'sowohl das Token als auch die rohe Antwort von Apple',
    profile: 'mit diesem Vella-Profil verknüpft',
    excluded: 'IDFA, Google Advertising ID (AAID), ATT, Geräte-Fingerprinting noch App-übergreifendes Tracking',
  },
  it: {
    coarse: "attribuzione approssimativa e proprietaria dell'installazione",
    androidDiscard: 'elimina il referrer grezzo sul dispositivo',
    appleToken: 'token transitorio di attribuzione Apple AdServices',
    appleBounded: 'solo campi di campagna generali e delimitati',
    appleDiscard: 'elimina sia il token sia la risposta grezza di Apple',
    profile: 'collegata a quel profilo Vella',
    excluded: "IDFA, l'ID pubblicitario di Google (AAID), ATT, l'impronta digitale del dispositivo o il tracciamento tra app",
  },
  ru: {
    coarse: 'приблизительную собственную атрибуцию установки',
    androidDiscard: 'необработанный реферер удаляется на устройстве',
    appleToken: 'временный токен атрибуции Apple AdServices',
    appleBounded: 'только укрупнённые поля кампании с ограниченным набором значений',
    appleDiscard: 'удаляет и токен, и необработанный ответ Apple',
    profile: 'связана с этим профилем Vella',
    excluded: 'IDFA, рекламный идентификатор Google (AAID), ATT, цифровые отпечатки устройства или межприложенное отслеживание',
  },
  pl: {
    coarse: 'przybliżoną własną atrybucję instalacji',
    androidDiscard: 'usuwa surowy referrer na urządzeniu',
    appleToken: 'tymczasowy token atrybucji Apple AdServices',
    appleBounded: 'wyłącznie ogólne, ograniczone pola kampanii',
    appleDiscard: 'usuwa zarówno token, jak i surową odpowiedź Apple',
    profile: 'powiązana z tym profilem Vella',
    excluded: 'IDFA, identyfikatora reklamowego Google (AAID), ATT, fingerprintingu urządzenia ani śledzenia między aplikacjami',
  },
} as const;

const firebaseAnalyticsPrivacyChecks = {
  en: [
    'separate Google Analytics for Firebase SDK stream',
    'app-instance identifier',
    'approximate location inferred from a masked IP address',
    'lifecycle, session, engagement, and app-update events',
    'subscription product, value, and currency fields',
    'SDK transport diagnostics',
    'closed list of exactly ten custom marketing events',
    'localized prices, and raw errors',
    'does not set a Firebase account user ID or user properties',
    'does not collect an advertising ID',
    'Ad storage, ad user data, and ad personalization are disabled',
    'never authoritative subscription validation',
    'Only the custom server-verified',
    'configured Google Analytics retention settings and applicable Google terms',
    "not to Google's SDK stream",
  ],
  pt: [
    'fluxo separado do SDK Google Analytics for Firebase',
    'identificador de instância do app',
    'localização aproximada inferida de um endereço IP mascarado',
    'ciclo de vida, sessão, engajamento e atualização do app',
    'produto de assinatura, valor e moeda',
    'diagnósticos de transporte do SDK',
    'lista fechada de exatamente dez eventos personalizados de marketing',
    'preços localizados e erros brutos',
    'não define um ID de usuário da conta no Firebase nem propriedades de usuário',
    'não coleta identificador de publicidade',
    'armazenamento de anúncios, dados do usuário para anúncios e personalização de anúncios ficam desativados',
    'nunca constituem validação autoritativa da assinatura',
    'Somente os resultados personalizados verificados pelo servidor',
    'configurações de retenção definidas no Google Analytics e os termos aplicáveis do Google',
    'não ao fluxo do SDK do Google',
  ],
  es: [
    'flujo separado del SDK Google Analytics for Firebase',
    'identificador de instancia de la app',
    'ubicación aproximada inferida de una dirección IP enmascarada',
    'ciclo de vida, sesión, interacción y actualización de la app',
    'producto de suscripción, valor y moneda',
    'diagnósticos de transporte del SDK',
    'lista cerrada de exactamente diez eventos personalizados de marketing',
    'precios localizados y errores sin procesar',
    'no establece un ID de usuario de la cuenta en Firebase ni propiedades de usuario',
    'no recopila un identificador de publicidad',
    'almacenamiento de anuncios, los datos de usuario para anuncios y la personalización de anuncios están desactivados',
    'nunca constituyen una validación autoritativa de la suscripción',
    'Solo los resultados personalizados verificados por el servidor',
    'ajustes de conservación configurados en Google Analytics y los términos aplicables de Google',
    'no al flujo del SDK de Google',
  ],
  fr: [
    'flux distinct du SDK Google Analytics for Firebase',
    "identifiant d'instance de l'app",
    "position approximative déduite d'une adresse IP masquée",
    "cycle de vie, session, engagement et mise à jour de l'app",
    "produit d'abonnement, valeur et devise",
    'diagnostics de transport du SDK',
    'liste fermée de exactement dix événements marketing personnalisés',
    'prix localisés et erreurs brutes',
    "ne définit aucun identifiant de compte utilisateur dans Firebase ni aucune propriété utilisateur",
    "ne collecte aucun identifiant publicitaire",
    "stockage publicitaire, les données utilisateur à des fins publicitaires et la personnalisation des annonces sont désactivés",
    "ne constituent jamais une validation d'abonnement faisant autorité",
    'Seuls les résultats personnalisés vérifiés par le serveur',
    'paramètres de conservation configurés dans Google Analytics et les conditions Google applicables',
    "pas au flux du SDK de Google",
  ],
  de: [
    'getrennten Datenstrom des Google Analytics for Firebase SDK',
    'App-Instanzkennung',
    'ungefähren Standort, der aus einer maskierten IP-Adresse abgeleitet wird',
    'Lebenszyklus, Sitzung, Interaktion und App-Aktualisierung',
    'Abonnementprodukt, Wert und Währung',
    'SDK-Transportdiagnosen',
    'geschlossene Liste mit genau zehn benutzerdefinierten Marketingereignissen',
    'lokalisierte Preise und rohe Fehler',
    'legt in Firebase weder eine Nutzer-ID des Vella-Kontos noch Nutzereigenschaften fest',
    'erfasst keine Werbe-ID',
    'Anzeigenspeicherung, Anzeigen-Nutzerdaten und Anzeigenpersonalisierung sind deaktiviert',
    'niemals eine maßgebliche Abonnementvalidierung',
    'Nur die benutzerdefinierten, serververifizierten Ergebnisse',
    'konfigurierten Aufbewahrungseinstellungen von Google Analytics und den geltenden Google-Bedingungen',
    'nicht für den SDK-Datenstrom von Google',
  ],
  it: [
    "flusso separato dell'SDK Google Analytics for Firebase",
    "identificativo dell'istanza dell'app",
    'posizione approssimativa dedotta da un indirizzo IP mascherato',
    "ciclo di vita, sessione, coinvolgimento e aggiornamento dell'app",
    "prodotto dell'abbonamento, valore e valuta",
    "diagnostica di trasporto dell'SDK",
    'elenco chiuso di esattamente dieci eventi di marketing personalizzati',
    'prezzi localizzati ed errori grezzi',
    "non imposta in Firebase un ID utente dell'account né proprietà utente",
    'non raccoglie un identificativo pubblicitario',
    'archiviazione pubblicitaria, i dati utente per la pubblicità e la personalizzazione degli annunci sono disattivati',
    "non costituiscono mai una convalida autorevole dell'abbonamento",
    'Solo gli esiti personalizzati verificati dal server',
    'impostazioni di conservazione configurate in Google Analytics e i termini Google applicabili',
    "non al flusso dell'SDK di Google",
  ],
  ru: [
    'отдельный поток SDK Google Analytics for Firebase',
    'идентификатор экземпляра приложения',
    'примерное местоположение, определённое по маскированному IP-адресу',
    'жизненного цикла, сессии, взаимодействия и обновления приложения',
    'продукт подписки, стоимость и валюту',
    'диагностику транспорта SDK',
    'закрытый список ровно из десяти пользовательских маркетинговых событий',
    'локализованные цены и необработанные ошибки',
    'не задаёт в Firebase ID пользователя учётной записи или свойства пользователя',
    'не собирает рекламный идентификатор',
    'хранилище рекламы, рекламные пользовательские данные и персонализация рекламы отключены',
    'никогда не являются авторитетной проверкой подписки',
    'Только пользовательские результаты, проверенные сервером',
    'настроенным параметрам хранения Google Analytics и применимым условиям Google',
    'не к потоку SDK Google',
  ],
  pl: [
    'oddzielnego strumienia SDK Google Analytics for Firebase',
    'identyfikator instancji aplikacji',
    'przybliżoną lokalizację ustaloną z zamaskowanego adresu IP',
    'cyklu życia, sesji, zaangażowania i aktualizacji aplikacji',
    'produkt subskrypcji, wartość i walutę',
    'diagnostykę transportu SDK',
    'zamkniętą listę dokładnie dziesięciu niestandardowych zdarzeń marketingowych',
    'zlokalizowane ceny i surowe błędy',
    'nie ustawia w Firebase identyfikatora użytkownika konta ani właściwości użytkownika',
    'nie zbiera identyfikatora reklamowego',
    'przechowywanie reklam, dane użytkownika na potrzeby reklam i personalizacja reklam są wyłączone',
    'nigdy nie stanowią miarodajnej weryfikacji subskrypcji',
    'Tylko niestandardowe wyniki zweryfikowane przez serwer',
    'skonfigurowanymi ustawieniami przechowywania Google Analytics i obowiązującymi warunkami Google',
    'nie do strumienia SDK Google',
  ],
} as const;

const firebasePolicyUpdatedChecks = {
  en: 'Last updated: August 25, 2026',
  pt: 'Última atualização: 25 de agosto de 2026',
  es: 'Última actualización: 25 de agosto de 2026',
  fr: 'Dernière mise à jour : 25 août 2026',
  de: 'Zuletzt aktualisiert: 25. August 2026',
  it: 'Ultimo aggiornamento: 25 agosto 2026',
  ru: 'Последнее обновление: 25 августа 2026 г.',
  pl: 'Ostatnia aktualizacja: 25 sierpnia 2026 r.',
} as const;

const firebaseCustomMarketingEvents = [
  'onboarding_begin',
  'onboarding_complete',
  'first_experience_begin',
  'first_experience_complete',
  'vella_profile_initialized',
  'paywall_view',
  'plan_select',
  'begin_checkout',
  'verified_trial_start',
  'verified_subscription_start',
] as const;

const retiredFreeTierClaims = [
  'premium is always optional',
  'o premium é opcional',
  'premium es opcional',
  'premium reste facultatif',
  'premium ist optional',
  'premium è facoltativo',
  'premium — по желанию',
  'premium jest opcjonalne',
  'without requiring payment',
  'sem assinatura obrigatória',
  'sin suscripción obligatoria',
  'sans abonnement obligatoire',
  'ohne pflichtabo',
  'senza abbonamento obbligatorio',
  'без обязательной подписки',
  'bez obowiązkowej subskrypcji',
];

function articleWordCount(locale: (typeof LOCALES)[number], slug: string) {
  const post = getPosts(locale).find((item) => item.slug === slug);
  if (!post) return 0;
  const text = post.sections.flatMap((section) => [
    ...section.paragraphs,
    ...(section.numberedPractices ?? []),
    ...(section.reflectionPrompts ?? []),
  ]).join(' ');
  return text.trim().split(/\s+/u).length;
}

describe('Vella localized website', () => {
  it('loads complete copy for every app locale', async () => {
    for (const locale of LOCALES) {
      const copy = await getCopy(locale);
      expect(copy.locale).toBe(locale);
      expect(copy.features).toHaveLength(8);
      expect(copy.rhythm.steps).toHaveLength(3);
      expect(copy.support.faqs.length).toBeGreaterThanOrEqual(6);
      expect(copy.legal.privacySections.length).toBeGreaterThanOrEqual(6);
      expect(copy.legal.termsSections.length).toBeGreaterThanOrEqual(6);
      expect(copy.legal.guidelinesSections.length).toBeGreaterThanOrEqual(5);
      const serialized = JSON.stringify(copy);
      expect(serialized).toContain('support@vella.one');
      expect(serialized).toContain('privacy@vella.one');
      expect(serialized).not.toContain('vella.app');
      expect(serialized).not.toContain('velah.app');
    }
  });

  it('describes subscription-only access consistently in every locale', async () => {
    for (const locale of LOCALES) {
      const copy = await getCopy(locale);
      const serialized = JSON.stringify(copy).toLocaleLowerCase(locale);
      const checks = subscriptionCopyChecks[locale];

      expect(serialized).toContain(checks.trial);
      expect(serialized).toContain(checks.locked);
      expect(retiredFreeTierClaims.some((claim) => serialized.includes(claim))).toBe(false);
    }
  });

  it('publishes adult-only eligibility, named processors, and partial-deletion controls in every locale', async () => {
    for (const locale of LOCALES) {
      const copy = await getCopy(locale);
      const privacy = JSON.stringify(copy.legal.privacySections);
      const terms = JSON.stringify(copy.legal.termsSections);

      expect(copy.support.eligibilityNotice).toContain('18');
      expect(copy.legal.guidelinesIntro).toContain('18');
      expect(privacy).toContain('18');
      expect(terms).toContain('18');
      expect(copy.support.partialDeletionSteps).toHaveLength(4);
      expect(copy.support.partialDeletionSteps.join(' ')).toContain('privacy@vella.one');
      for (const processor of ['Supabase', 'Vercel', 'OpenAI', 'Expo', 'Apple', 'Google']) {
        expect(privacy).toContain(processor);
      }
    }
  });

  it('discloses Prayer Space storage and privacy boundaries in every locale', async () => {
    for (const locale of LOCALES) {
      const copy = await getCopy(locale);
      const privacy = JSON.stringify(copy.legal.privacySections);
      const checks = prayerPrivacyChecks[locale];

      expect(privacy).toContain(checks.private);
      expect(privacy).toContain(checks.fields);
      expect(privacy).toContain(checks.voiceAi);
      expect(privacy).toContain(checks.audioRetention);
      expect(privacy).toContain(checks.notifications);
      expect(privacy).toContain(checks.accountDeletion);
    }
  });

  it('discloses privacy-minimized first-party analytics in every locale', async () => {
    for (const locale of LOCALES) {
      const copy = await getCopy(locale);
      const privacy = JSON.stringify(copy.legal.privacySections);
      const checks = growthAnalyticsPrivacyChecks[locale];

      expect(privacy).toContain(checks.identifier);
      expect(privacy).toContain(checks.session);
      expect(privacy).toContain(checks.mechanics);
      expect(privacy).toContain(checks.mechanicsEnd);
      expect(privacy).toContain(checks.excluded);
      expect(privacy).toContain(checks.identity);
      expect(privacy).toContain(checks.retention);
      expect(privacy).toContain(checks.cohorts);
      expect(privacy).toContain(checks.ads);
    }
  });

  it('discloses privacy-safe native install attribution in every locale', async () => {
    for (const locale of LOCALES) {
      const copy = await getCopy(locale);
      const privacy = JSON.stringify(copy.legal.privacySections);
      const checks = installAttributionPrivacyChecks[locale];

      expect(privacy).toContain(checks.coarse);
      expect(privacy).toContain(checks.androidDiscard);
      expect(privacy).toContain(checks.appleToken);
      expect(privacy).toContain(checks.appleBounded);
      expect(privacy).toContain(checks.appleDiscard);
      expect(privacy).toContain(checks.profile);
      expect(privacy).toContain(checks.excluded);
    }
  });

  it('discloses the separate Google Analytics for Firebase SDK stream in every locale', async () => {
    expect(firebaseCustomMarketingEvents).toHaveLength(10);

    for (const locale of LOCALES) {
      const copy = await getCopy(locale);
      const privacy = JSON.stringify(copy.legal.privacySections);

      for (const check of firebaseAnalyticsPrivacyChecks[locale]) {
        expect(privacy).toContain(check);
      }
      for (const eventName of firebaseCustomMarketingEvents) {
        expect(privacy).toContain(eventName);
      }
      expect(copy.legal.updated).toBe(firebasePolicyUpdatedChecks[locale]);
    }
  });

  it('keeps English canonical and all other locales prefixed', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(localizedPath('en')).toBe('/');
    expect(localizedPath('en', '/features')).toBe('/features');
    expect(localizedPath('pt', '/features')).toBe('/pt/features');
    expect(Object.keys(languageAlternates('/blog'))).toHaveLength(LOCALES.length + 1);
  });

  it('ships the same substantial journal catalog in every language', () => {
    for (const locale of LOCALES) {
      const posts = getPosts(locale);
      expect(posts.map((post) => post.slug)).toEqual([...BLOG_SLUGS]);
      for (const slug of BLOG_SLUGS) {
        expect(articleWordCount(locale, slug)).toBeGreaterThan(500);
      }
    }
  });

  it('ships a complete private Prayer Space experience in every language', () => {
    for (const locale of LOCALES) {
      const prayer = getPrayerSpaceCopy(locale);
      expect(prayer.locale).toBe(locale);
      expect(prayer.title.length).toBeGreaterThan(10);
      expect(prayer.seoTitle.length).toBeGreaterThan(20);
      expect(prayer.seoDescription.length).toBeGreaterThan(80);
      expect(prayer.promise.points).toHaveLength(4);
      expect(prayer.flow.steps).toHaveLength(5);
      expect(prayer.privacy.points).toHaveLength(4);
      expect(prayer.complements.items).toHaveLength(6);
      expect(prayer.faq.items).toHaveLength(5);

      const article = getPosts(locale).find((post) => post.slug === PRAYER_SPACE_ARTICLE_SLUG);
      expect(article).toBeDefined();
      expect(article?.sections).toHaveLength(8);
      expect(article?.cta?.path).toBe(PRAYER_SPACE_PATH);
      expect(articleWordCount(locale, PRAYER_SPACE_ARTICLE_SLUG)).toBeGreaterThan(1000);
    }
  });

  it('publishes unique localized URLs with hreflang alternates', () => {
    const entries = sitemap();
    const expected = LOCALES.length * (9 + BLOG_SLUGS.length);
    expect(entries).toHaveLength(expected);
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(expected);
    for (const entry of entries) {
      expect(Object.keys(entry.alternates?.languages ?? {})).toHaveLength(LOCALES.length + 1);
    }
    for (const locale of LOCALES) {
      expect(entries.some((entry) => entry.url === new URL(localizedPath(locale, PRAYER_SPACE_PATH), 'https://vella.one').toString().replace(/\/$/, ''))).toBe(true);
      expect(entries.some((entry) => entry.url === new URL(localizedPath(locale, PRAYER_SPACE_ARTICLE_PATH), 'https://vella.one').toString().replace(/\/$/, ''))).toBe(true);
    }
  });

  it('does not append the Vella brand twice in localized page titles', () => {
    const branded = localizedMetadata({
      locale: 'pt',
      title: 'Recursos para um ritmo de fé mais constante | Vella',
      description: 'Descrição de teste suficientemente clara.',
      path: '/features',
    });
    const unbranded = localizedMetadata({
      locale: 'en',
      title: 'A private prayer journal for everyday life',
      description: 'A sufficiently clear test description.',
      path: PRAYER_SPACE_PATH,
    });

    expect(branded.title).toEqual({ absolute: 'Recursos para um ritmo de fé mais constante | Vella' });
    expect(unbranded.title).toBe('A private prayer journal for everyday life');
  });

  it('records the exact platform-bound runtime 1.3 release truth', () => {
    const currentCandidate = markdownSection(
      storeSubmissionPackage,
      '## Current release candidate — 2026-08-25',
      '## Historical release context — 2026-07-31 (superseded)',
    );
    const historicalContext = markdownSection(
      storeSubmissionPackage,
      '## Historical release context — 2026-07-31 (superseded)',
      '## Exact store metadata',
    );
    const finalChecklist = markdownSection(
      storeSubmissionPackage,
      '## Final submission checklist',
      '## Official references',
    );
    const releaseCurrentStatus = markdownSection(
      releaseFinishLine,
      '## 1. Current status',
      '## 2. Commercial configuration — configured, still test end to end',
    );

    expect(currentCandidate.includes('Runtime: `1.3`.')).toBe(true);
    expect(currentCandidate).toContain('- Archived source commit for both artifacts: `39157ccf5c34ad01b74897ee87e279929bca8bab`.');
    expect(currentCandidate).toContain('- Android: version `1.0.1`, version code `25`; EAS build `460d034c-b51f-494a-9281-4a9fe07471b3`; inspected AAB SHA-256 `145fd5ce504f7ab5c4ccc508b0d9b3a0a993fef08a1c2ca2a32b87890447981d`.');
    expect(currentCandidate).toContain('- iOS: version `1.0.1`, build `23`; EAS build `8c14f38c-e50d-4d1f-a168-fc67ffd9ba6f`; inspected IPA SHA-256 `36295217084dc5dbb15ca925d4212e07c52a8804b991feb1790f46612f68088c`.');
    expect(currentCandidate).toContain('Both signed runtime-1.3 EAS production artifacts are finished and inspected');
    expect(currentCandidate).toContain('The API `main` branch and production deployment are already current');
    expect(currentCandidate).toContain('EAS submission `d897fd82-bd2d-42a4-acb9-63f0a4c3c96a` successfully uploaded the exact iOS build to App Store Connect');
    expect(currentCandidate).toContain('completed App Store Connect processing at `2026-08-25T06:27:47Z`');
    expect(currentCandidate).toContain('available to test in TestFlight at `2026-08-25T06:30Z`');
    expect(currentCandidate).toContain('not installed from TestFlight');
    expect(currentCandidate).toContain('not selected or submitted for App Review');
    expect(currentCandidate).toContain('targeted Google Play Internal');
    expect(currentCandidate).toContain('Android Publisher API is enabled on the verified Google Cloud project `vella-faith-2026` (`15173925854`)');
    expect(currentCandidate).toContain('retry submission `8160f454-f502-4e31-8697-4b528421d582` failed');
    expect(currentCandidate).toContain('`vella-expo-push@vella-faith-2026.iam.gserviceaccount.com` lacks Vella app permissions in Play Console');
    expect(currentCandidate).toContain('No Android release was created');
    expect(currentCandidate).toContain('authoritative production runtime-1.3 update group is `83e563c4-20c1-4250-9612-b19e1f98920e`');
    expect(currentCandidate).toContain('source commit `d8259d77a3aa6a4299f71149ad1d13cb5ebe631a`');
    expect(currentCandidate).toContain('iOS update `01a037a2-d739-7d8c-8fc0-d0505924afbc`');
    expect(currentCandidate).toContain('Android update `01a037a2-d739-706b-8802-42177a13019d`');
    expect(currentCandidate).toContain('Direct update-server probes prove that the production channel at runtime `1.3` serves that exact final group');
    expect(currentCandidate).toContain('runtime `1.2` remains on the prior `a670fc29…` group');
    expect(currentCandidate).toContain('Two earlier runtime-1.3 groups are superseded');
    expect(currentCandidate).toContain('Exact first-launch installed-client proof remains open');
    expect(currentCandidate).toContain('`APPLE_ADS_ORG_ID`');
    expect(currentCandidate).toContain('not configured');
    expect(currentCandidate).toContain('No paid campaign is active');
    expect(currentCandidate.includes('`5000 ms` native launch wait')).toBe(true);
    expect(currentCandidate.includes('branded splash')).toBe(true);
    expect(currentCandidate.includes('Do not reuse or decrease either build number')).toBe(true);
    expect(currentCandidate.includes('No signed runtime-1.3 EAS build exists yet')).toBe(false);
    expect(currentCandidate.includes('signed EAS build ID pending')).toBe(false);
    expect(currentCandidate.includes('`1.0.0 (13)`')).toBe(false);
    expect(currentCandidate.includes('`1.0.0 (15)`')).toBe(false);
    expect(historicalContext.includes('Android build `1.0.0 (13)`')).toBe(true);
    expect(historicalContext.includes('iOS build `1.0.0 (15)`')).toBe(true);
    expect(finalChecklist.includes('iOS build 23')).toBe(true);
    expect(finalChecklist.includes('Android version code 25')).toBe(true);
    expect(finalChecklist.includes('build 15')).toBe(false);
    expect(finalChecklist.includes('build 13')).toBe(false);
    expect(releaseFinishLine).toContain('Runtime `1.3`');
    expect(releaseFinishLine).toContain('iOS build `23`');
    expect(releaseFinishLine).toContain('Android version code `25`');
    expect(releaseFinishLine).toContain('`8c14f38c-e50d-4d1f-a168-fc67ffd9ba6f`');
    expect(releaseFinishLine).toContain('`460d034c-b51f-494a-9281-4a9fe07471b3`');
    expect(releaseFinishLine).toContain('signed EAS artifacts are finished and inspected');
    expect(releaseFinishLine).not.toContain('No signed runtime-1.3 EAS build exists yet');
    expect(releaseFinishLine).toContain('5000 ms');
    expect(releaseCurrentStatus).toContain('The API `main` branch and production deployment are already current');
    expect(releaseCurrentStatus).toContain('`d897fd82-bd2d-42a4-acb9-63f0a4c3c96a`');
    expect(releaseCurrentStatus).toContain('completed App Store Connect processing at `2026-08-25T06:27:47Z`');
    expect(releaseCurrentStatus).toContain('available to test in TestFlight at `2026-08-25T06:30Z`');
    expect(releaseCurrentStatus).toContain('not installed from TestFlight');
    expect(releaseCurrentStatus).toContain('not selected or submitted for App Review');
    expect(releaseCurrentStatus).toContain('Google Play Internal');
    expect(releaseCurrentStatus).toContain('`vella-faith-2026` (`15173925854`)');
    expect(releaseCurrentStatus).toContain('`8160f454-f502-4e31-8697-4b528421d582`');
    expect(releaseCurrentStatus).toContain('`vella-expo-push@vella-faith-2026.iam.gserviceaccount.com`');
    expect(releaseCurrentStatus).toContain('No Android release was created');
    expect(releaseCurrentStatus).toContain('`83e563c4-20c1-4250-9612-b19e1f98920e`');
    expect(releaseCurrentStatus).toContain('`d8259d77a3aa6a4299f71149ad1d13cb5ebe631a`');
    expect(releaseCurrentStatus).toContain('`01a037a2-d739-7d8c-8fc0-d0505924afbc`');
    expect(releaseCurrentStatus).toContain('`01a037a2-d739-706b-8802-42177a13019d`');
    expect(releaseCurrentStatus).toContain('runtime `1.2` remains on the prior `a670fc29…` group');
    expect(releaseCurrentStatus).toContain('Two earlier runtime-1.3 groups are superseded');
    expect(releaseCurrentStatus).toContain('Exact first-launch installed-client proof remains open');
    expect(releaseCurrentStatus).toContain('`APPLE_ADS_ORG_ID` is not configured');
    expect(releaseCurrentStatus).toContain('Keep every paid campaign inactive');
    expect(releaseCurrentStatus).not.toContain('No runtime-1.3 OTA has been published');
    expect(releaseCurrentStatus).not.toContain('not yet submitted or store-distributed');
    expect(releaseCurrentStatus).not.toContain('is processing in App Store Connect');
  });

  it('keeps Apple and Play privacy answers form-ready for optional voice transcription', () => {
    const applePrivacy = markdownSection(
      storeSubmissionPackage,
      '## Apple App Privacy answers',
      '## Google Play Data safety draft',
    );
    const googlePrivacy = markdownSection(
      storeSubmissionPackage,
      '## Google Play Data safety draft',
      '## UGC, age rating, and target audience',
    );
    const appleRows = markdownTableRows(applePrivacy);
    const linkedAnswers = new Map(appleRows.map((row) => [row[0], row[2]]));
    const trackingAnswers = new Map(appleRows.map((row) => [row[0], row[3]]));
    const purposes = new Map(appleRows.map((row) => [row[0], row[4]]));
    const categoricalAudioExclusion = /do (?:\*\*)?not(?:\*\*)? select[^.\n]{0,160}\baudio\b/iu;
    const submissionCopy = storeSubmissionPackage.toLowerCase();

    expect(appleRows.length).toBeGreaterThan(10);
    expect([...linkedAnswers.values()].every((answer) => answer === 'Yes' || answer === 'No')).toBe(true);
    expect(linkedAnswers.get('Identifiers — Device ID')).toBe('Yes');
    expect(linkedAnswers.get('Location — Coarse Location')).toBe('No');
    expect(linkedAnswers.get('Purchases — Purchase History')).toBe('Yes');
    expect(linkedAnswers.get('Usage Data — Product Interaction')).toBe('Yes');
    expect(linkedAnswers.get('Diagnostics — Other Diagnostic Data')).toBe('Yes');
    expect(linkedAnswers.get('User Content — Audio Data')).toBe('Yes');
    expect(linkedAnswers.get('Advertising Data')).toBe('Yes');
    expect(trackingAnswers.get('Advertising Data')).toBe('No');
    expect(purposes.get('Advertising Data')).toContain('Analytics');
    expect(purposes.get('Advertising Data')).toContain("Developer's Advertising");
    for (const type of [
      'Identifiers — User ID',
      'Identifiers — Device ID',
      'Purchases — Purchase History',
      'Usage Data — Product Interaction',
    ]) {
      expect(purposes.get(type)).toContain('Analytics');
      expect(purposes.get(type)).toContain("Developer's Advertising");
    }
    expect(applePrivacy.includes('Firebase app-instance stream remains pseudonymous')).toBe(true);
    expect(applePrivacy).toContain('raw Android referrer is discarded on-device');
    expect(applePrivacy).toContain('Apple token and raw response are transient and discarded');
    expect(applePrivacy).toContain('only coarse, bounded campaign fields');
    expect(applePrivacy).not.toContain('numeric Apple Ads campaign fields');
    expect(applePrivacy).not.toContain('only numeric campaign fields');
    expect(applePrivacy).toContain('No IDFA, AAID, ATT prompt, fingerprinting, or cross-app tracking');
    expect(googlePrivacy.includes('| Audio files — Voice recordings | Yes | Optional/user-initiated |')).toBe(true);
    expect(googlePrivacy).toContain('Advertising or marketing');
    expect(googlePrivacy).toContain('raw Android referrer is discarded on-device');
    expect(googlePrivacy).toContain('Apple token and raw response are transient and discarded');
    expect(submissionCopy.includes('optional, user-initiated voice transcription')).toBe(true);
    expect(submissionCopy.includes('microphone permission is requested only')).toBe(true);
    expect(submissionCopy.includes('recording leaves the device for openai transcription')).toBe(true);
    expect(submissionCopy.includes('vella does not retain the recording')).toBe(true);
    expect(submissionCopy.includes('only confirmed text is saved')).toBe(true);
    expect(submissionCopy.includes('provider retention')).toBe(true);
    expect(submissionCopy.includes('ephemeral processing')).toBe(true);
    expect(categoricalAudioExclusion.test(storeSubmissionPackage)).toBe(false);
  });

  it('keeps the Google Ads readiness document bound to the verified account and campaign', () => {
    const accountIdentifiers = [...googleAdsReadiness.matchAll(/\b\d{3}-\d{3}-\d{4}\b/gu)]
      .map((match) => match[0]);
    const rawAppIdentifier = /\b[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}\b/iu;

    expect(accountIdentifiers).toEqual(['712-460-9192']);
    expect(rawAppIdentifier.test(googleAdsReadiness)).toBe(false);
    expect(googleAdsReadiness.includes('- Manager account: approved manager account (identifier omitted).')).toBe(true);
    expect(googleAdsReadiness.includes('- Client account: `712-460-9192`.')).toBe(true);
    expect(googleAdsReadiness.includes('- App listing: approved Vella Android store listing (identifier omitted).')).toBe(true);
    expect(googleAdsReadiness.includes('Campaign name: `Vella_BR_Android_202608_PrayerDaily`')).toBe(true);
    expect(googleAdsReadiness.includes('Historical campaign ID: `24120421103`')).toBe(true);
    expect(googleAdsReadiness.includes('Planned campaign ID: pending')).toBe(true);
  });

  it('keeps acquisition runbooks on shipped attribution truth and paused spend', () => {
    expect(googleAdsReadiness).toContain('Budget: R$60/day');
    expect(googleAdsReadiness).toContain('14-day campaign cap of R$840');
    expect(googleAdsReadiness).toContain('R$1,000 total learning ceiling');
    expect(googleAdsReadiness).toContain('start state: **paused**');
    expect(googleAdsReadiness).toContain('vella_profile_initialized');
    expect(googleAdsReadiness).not.toMatch(/\bsign_up\b/u);
    expect(googleAdsReadiness).toContain('native Install Referrer bridge is implemented in candidate source');
    expect(googleAdsReadiness).not.toContain('native Install Referrer bridge is shipped');
    expect(googleAdsReadiness).not.toContain('proper native attribution bridge is shipped');
    expect(growthPlatformAccess).toContain('Apple Ads campaign remains paused');
    expect(growthPlatformAccess).toContain('R$40/day');
    expect(growthPlatformAccess).toContain('R$560');
    expect(growthPlatformAccess).toContain('R$56');
    expect(growthPlatformAccess).not.toContain('added in a future store build');
    expect(googleAdsReadiness).toContain('Historical campaign status observed: **Ended / inactive**');
    expect(googleAdsReadiness).toContain('Historical budget: R$46/day');
    expect(googleAdsReadiness).not.toContain('Campaign status observed: **Paused**');
    expect(googleAdsReadiness).toContain('R$594.09');
    expect(googleAdsReadiness).toContain('R$594.08');
    expect(googleAdsReadiness).toMatch(/R\$0\.01\s+display\/reconciliation difference/u);
    expect(googleAdsReadiness).toContain('custom lifecycle events are not yet production-shipped');
    expect(growthPlatformAccess).toContain('`APPLE_ADS_ORG_ID` is not configured');
    expect(growthPlatformAccess).toContain('historical campaign `24120421103` remains ended/inactive');
    expect(growthPlatformAccess).toContain('replacement campaign ID is pending');
  });

  it('keeps reviewer guidance aligned with compact onboarding and shared-profile auth', () => {
    expect(appleReviewNotes).toContain('`8c14f38c-e50d-4d1f-a168-fc67ffd9ba6f`');
    expect(appleReviewNotes).toContain('`d897fd82-bd2d-42a4-acb9-63f0a4c3c96a`');
    expect(appleReviewNotes).toContain('successfully uploaded');
    expect(appleReviewNotes).toContain('completed App Store Connect processing at `2026-08-25T06:27:47Z`');
    expect(appleReviewNotes).toContain('available to test in TestFlight at `2026-08-25T06:30Z`');
    expect(appleReviewNotes).toContain('not yet installed from TestFlight');
    expect(appleReviewNotes).toContain('not selected or submitted for App Review');
    expect(appleReviewNotes).toContain('`83e563c4-20c1-4250-9612-b19e1f98920e`');
    expect(appleReviewNotes).toContain('`01a037a2-d739-7d8c-8fc0-d0505924afbc`');
    expect(appleReviewNotes).toContain('Exact first-launch installed-client proof remains open');
    expect(appleReviewNotes).toContain('compact onboarding');
    expect(appleReviewNotes).toContain('one anonymous first Vella moment');
    expect(appleReviewNotes).toContain('Continue with Apple, Continue with Google, or email');
    expect(appleReviewNotes).toContain('active subscriber goes directly into Vella');
    expect(appleReviewNotes).toContain('creates the missing Vella profile');
    expect(appleReviewNotes).toContain('Microphone permission is requested only after');
    expect(appleReviewNotes).not.toContain('seven-step onboarding');
    expect(appleReviewNotes).not.toContain('does not request camera, microphone');
  });

  it('marks dated audits as superseded operational history', () => {
    for (const audit of [historicalFinalProductAudit, historicalProductionAudit]) {
      expect(audit.slice(0, 600)).toContain('SUPERSEDED');
      expect(audit.slice(0, 600)).toContain('RELEASE_FINISH_LINE.md');
      expect(audit.slice(0, 600)).toContain('STORE_SUBMISSION_PACKAGE.md');
    }
  });

  it('uses the verified store identifiers', () => {
    expect(APP_STORE_URL).toContain('6790616297');
    expect(PLAY_STORE_URL).toContain('io.vella.app');
  });

  it('defaults both store listings and rendered CTAs on unless a store is explicitly disabled', async () => {
    expect(storeAvailabilityFromEnv(undefined)).toBe(true);
    expect(storeAvailabilityFromEnv('true')).toBe(true);
    expect(storeAvailabilityFromEnv('false')).toBe(false);
    expect(storeAvailabilityFromEnv(' FALSE ')).toBe(false);
    expect(ANDROID_STORE_AVAILABLE).toBe(true);
    expect(IOS_STORE_AVAILABLE).toBe(true);
    const urls = availableStoreUrls();
    expect(urls).toHaveLength(2);
    expect(urls.includes(APP_STORE_URL)).toBe(true);
    expect(urls.includes(PLAY_STORE_URL)).toBe(true);

    const copy = await getCopy('en');
    expect(copy.download.playStore).toContain('Google Play');
    expect(copy.download.appStore).toContain('App Store');
    const storeLinks = renderToStaticMarkup(createElement(StoreLinks, { copy: copy.download }));
    expect((storeLinks.match(/data-vella-cta="store"/gu) ?? [])).toHaveLength(2);
    expect(storeLinks.includes('data-cta-platform="android"')).toBe(true);
    expect(storeLinks.includes('data-cta-platform="ios"')).toBe(true);
    expect(storeLinks.includes('data-vella-cta="store-unavailable"')).toBe(false);

    const metadata = await generateLocaleMetadata({ params: Promise.resolve({ locale: 'en' }) });
    expect(Object.keys(metadata.other ?? {}).includes('apple-itunes-app')).toBe(true);
  });

  it('builds stable first-party CTA identifiers and Google Install Referrer data', () => {
    const url = new URL(playStoreCampaignUrl('blog-article'));
    const referrer = new URLSearchParams(url.searchParams.get('referrer') ?? '');

    expect(url.hostname).toBe('play.google.com');
    expect(url.searchParams.get('id')).toBe('io.vella.app');
    expect(referrer.get('utm_source')).toBe('vella.one');
    expect(referrer.get('utm_medium')).toBe('website');
    expect(referrer.get('utm_campaign')).toBe(STORE_CAMPAIGN);
    expect(referrer.get('utm_content')).toBe('blog-article');
    expect(STORE_CTA_EVENT).toBe('vella:store-cta-click');
    expect(storeCtaId('prayer-space', 'android')).toBe('vella-store-cta-prayer-space-android');
  });

  it('publishes current App Store and Google Play availability copy in every locale', async () => {
    for (const locale of LOCALES) {
      const copy = await getCopy(locale);
      const expected = crossPlatformDownloadChecks[locale];
      expect(copy.download.body).toBe(expected.body);
      expect(copy.download.availability).toBe(expected.availability);
      expect(copy.download.desktopHint).toBe(expected.desktopHint);
      expect(copy.download.contextualBody).toBe(expected.contextualBody);
      expect(copy.download.appStoreSoon).toBe(expected.iosUnavailable);
      expect(copy.download.appStore).toContain('App Store');
      expect(copy.download.playStore).toContain('Google Play');
      expect(copy.download.contextualTitle.length).toBeGreaterThan(20);
    }
  });

  it('publishes the complete paid lifecycle in every console-copy description', () => {
    const descriptions = LOCALES.map((locale) => storeMetadata.locales[locale].description);

    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const locale of LOCALES) {
      const description = storeMetadata.locales[locale].description;
      const contract = storeDescriptionContract[locale];
      const firstExperienceIndex = description.indexOf(contract.firstExperience);
      const subscriptionIndex = description.indexOf(contract.subscription);

      expect(firstExperienceIndex).toBeGreaterThanOrEqual(0);
      expect(subscriptionIndex).toBeGreaterThan(firstExperienceIndex);
      expect(description.split(contract.firstExperience)).toHaveLength(2);
      expect(description.split(contract.subscription)).toHaveLength(2);
    }
  });

  it('matches workspace mobile descriptions when the sibling checkout is available', () => {
    // Standalone API CI always has the lifecycle contract above; the shared workspace adds exact parity.
    if (!workspaceMobileStoreConfig) return;

    for (const locale of LOCALES) {
      const contract = storeDescriptionContract[locale];
      const mobileDescription = workspaceMobileStoreConfig.apple.info[contract.mobileLocale]?.description;

      expect(typeof mobileDescription).toBe('string');
      expect(storeMetadata.locales[locale].description === mobileDescription).toBe(true);
    }
  });

  it('keeps every submission-package length derived from canonical metadata', () => {
    const exactMetadataSection = markdownSection(
      storeSubmissionPackage,
      '## Exact store metadata',
      '### Categories and declarations',
    );
    const expectedHeaders = [
      'Locale',
      'Name / 30',
      'Subtitle / 30',
      'Apple promo / 170',
      'Play short / 80',
      'Keywords bytes / 100',
      'Description / 4000',
    ];
    const tableRows = exactMetadataSection
      .split('\n')
      .filter((line) => line.startsWith('| '))
      .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
    const tableLocales = new Set<string>(
      Object.values(storeDescriptionContract).map(({ tableLocale }) => tableLocale),
    );
    const documentedRows = tableRows.filter((cells) => tableLocales.has(cells[0]));
    const documentedLengths = new Map(
      documentedRows.map((cells) => {
        expect(cells).toHaveLength(expectedHeaders.length);
        const metrics = cells.slice(1).map(Number);
        expect(metrics.every((metric) => Number.isInteger(metric) && metric >= 0)).toBe(true);
        return [cells[0], metrics] as const;
      }),
    );

    expect(tableRows[0]).toEqual(expectedHeaders);
    expect(documentedRows).toHaveLength(LOCALES.length);
    expect(documentedLengths.size).toBe(LOCALES.length);
    for (const locale of LOCALES) {
      const tableLocale = storeDescriptionContract[locale].tableLocale;
      const copy = storeMetadata.locales[locale];
      expect(documentedLengths.get(tableLocale)).toEqual([
        copy.name.length,
        copy.subtitle.length,
        copy.promotionalText.length,
        copy.shortDescription.length,
        new TextEncoder().encode(copy.keywords).byteLength,
        copy.description.length,
      ]);
    }
  });

  it('keeps every localized store field inside Apple and Google limits', () => {
    expect(Object.keys(storeMetadata.locales)).toEqual([...LOCALES]);

    for (const copy of Object.values(storeMetadata.locales)) {
      expect(copy.name.length).toBeLessThanOrEqual(30);
      expect(copy.subtitle.length).toBeLessThanOrEqual(30);
      expect(copy.promotionalText.length).toBeLessThanOrEqual(170);
      expect(copy.shortDescription.length).toBeLessThanOrEqual(80);
      expect(new TextEncoder().encode(copy.keywords).byteLength).toBeLessThanOrEqual(100);
      expect(copy.description.length).toBeLessThanOrEqual(4000);
    }

    for (const product of Object.values(storeMetadata.subscriptions.localizations)) {
      expect(product.monthlyDisplayName.length).toBeLessThanOrEqual(30);
      expect(product.annualDisplayName.length).toBeLessThanOrEqual(30);
      expect(product.monthlyDescription.length).toBeLessThanOrEqual(45);
      expect(product.annualDescription.length).toBeLessThanOrEqual(45);
    }
  });

  it('keeps metadata files outside locale rewrites and does not cache language redirects', () => {
    const metadataResponse = middleware(new NextRequest('https://vella.one/llms.txt'));
    expect(metadataResponse.headers.get('x-middleware-next')).toBe('1');
    expect(metadataResponse.headers.get('x-middleware-rewrite')).toBeNull();

    const redirectResponse = middleware(new NextRequest('https://vella.one/', {
      headers: { 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8' },
    }));
    expect(redirectResponse.status).toBe(307);
    expect(redirectResponse.headers.get('location')).toBe('https://vella.one/pt');
    expect(redirectResponse.headers.get('cache-control')).toBe('private, no-store');
    expect(redirectResponse.headers.get('vary')).toBe('Accept-Language');
  });
});
