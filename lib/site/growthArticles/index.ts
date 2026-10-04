import type { BlogPost } from '../blog';
import type { Locale } from '../config';
import { en } from './en';
import { pt } from './pt';
import { es } from './es';
import { fr } from './fr';
import { de } from './de';
import { it } from './it';
import { ru } from './ru';
import { pl } from './pl';

export const NEW_BLOG_SLUGS = ['how-to-start-reading-the-bible-seven-day-plan', 'a-short-night-prayer-for-the-end-of-the-day'] as const;
const pairs = { en, pt, es, fr, de, it, ru, pl };
const editorialNotes: Record<Locale, string> = {
  en: 'Vella guide created with AI assistance. Check the referenced passages in your Bible; this is not Scripture or a substitute for pastoral guidance.',
  pt: 'Guia da Vella elaborado com auxílio de IA. Confira as passagens na sua Bíblia; este texto não é Escritura nem substitui orientação pastoral.',
  es: 'Guía de Vella elaborada con ayuda de IA. Comprueba los pasajes en tu Biblia; este texto no es Escritura ni sustituye la orientación pastoral.',
  fr: 'Guide Vella rédigé avec l’aide de l’IA. Vérifiez les passages dans votre Bible ; ce texte n’est pas l’Écriture et ne remplace pas un accompagnement pastoral.',
  de: 'Vella-Leitfaden mit KI-Unterstützung erstellt. Prüfe die Stellen in deiner Bibel; dieser Text ist keine Heilige Schrift und ersetzt keine seelsorgliche Begleitung.',
  it: 'Guida Vella elaborata con l’aiuto dell’IA. Verifica i brani nella tua Bibbia: questo testo non è Scrittura e non sostituisce l’accompagnamento pastorale.',
  ru: 'Руководство Vella подготовлено с помощью ИИ. Проверяйте отрывки в своей Библии: этот текст не является Писанием и не заменяет пастырского наставления.',
  pl: 'Przewodnik Vella przygotowany z pomocą AI. Sprawdzaj fragmenty w swojej Biblii: ten tekst nie jest Pismem i nie zastępuje opieki duszpasterskiej.',
};
type NewSlug = (typeof NEW_BLOG_SLUGS)[number];
type Content = Omit<BlogPost, 'slug' | 'locale'>;

export function growthArticles(locale: Locale): Record<NewSlug, Content> {
  return {
    [NEW_BLOG_SLUGS[0]]: { ...pairs[locale].bible, publishedAt: '2026-10-04', socialImage: `/blog/reading-${locale}.png`, editorialNote: editorialNotes[locale] },
    [NEW_BLOG_SLUGS[1]]: { ...pairs[locale].night, publishedAt: '2026-10-04', socialImage: `/blog/evening-${locale}.png`, editorialNote: editorialNotes[locale] },
  };
}
