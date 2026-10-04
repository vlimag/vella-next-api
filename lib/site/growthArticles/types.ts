import type { BlogPost } from '../blog';

export type ArticleCopy = Omit<BlogPost, 'slug' | 'locale' | 'publishedAt' | 'socialImage'>;
export type ArticlePair = { bible: ArticleCopy; night: ArticleCopy };
