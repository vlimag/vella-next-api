import type { Locale } from './config';

type UiLabels = {
  skipToContent: string;
  dayJourney: string;
  quietMinutes: string;
  accountData: string;
  onThisPage: string;
  shareByEmail: string;
};

export const UI_LABELS: Record<Locale, UiLabels> = {
  en: {
    skipToContent: 'Skip to content',
    dayJourney: 'day journey',
    quietMinutes: 'quiet minutes',
    accountData: 'Account & data',
    onThisPage: 'On this page',
    shareByEmail: 'Email',
  },
  pt: {
    skipToContent: 'Pular para o conteúdo',
    dayJourney: 'dias de jornada',
    quietMinutes: 'minutos de quietude',
    accountData: 'Conta e dados',
    onThisPage: 'Nesta página',
    shareByEmail: 'E-mail',
  },
  es: {
    skipToContent: 'Saltar al contenido',
    dayJourney: 'días de camino',
    quietMinutes: 'minutos de calma',
    accountData: 'Cuenta y datos',
    onThisPage: 'En esta página',
    shareByEmail: 'Correo',
  },
  fr: {
    skipToContent: 'Aller au contenu',
    dayJourney: 'jours de parcours',
    quietMinutes: 'minutes de calme',
    accountData: 'Compte et données',
    onThisPage: 'Sur cette page',
    shareByEmail: 'E-mail',
  },
  de: {
    skipToContent: 'Zum Inhalt springen',
    dayJourney: 'Tage auf dem Weg',
    quietMinutes: 'ruhige Minuten',
    accountData: 'Konto und Daten',
    onThisPage: 'Auf dieser Seite',
    shareByEmail: 'E-Mail',
  },
  it: {
    skipToContent: 'Vai al contenuto',
    dayJourney: 'giorni di percorso',
    quietMinutes: 'minuti di quiete',
    accountData: 'Account e dati',
    onThisPage: 'In questa pagina',
    shareByEmail: 'E-mail',
  },
  ru: {
    skipToContent: 'Перейти к содержимому',
    dayJourney: 'дней пути',
    quietMinutes: 'минут тишины',
    accountData: 'Аккаунт и данные',
    onThisPage: 'На этой странице',
    shareByEmail: 'Эл. почта',
  },
  pl: {
    skipToContent: 'Przejdź do treści',
    dayJourney: 'dni drogi',
    quietMinutes: 'minut ciszy',
    accountData: 'Konto i dane',
    onThisPage: 'Na tej stronie',
    shareByEmail: 'E-mail',
  },
};
