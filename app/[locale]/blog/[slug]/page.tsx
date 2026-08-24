import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/site/JsonLd';
import { PageShell } from '@/components/site/PageShell';
import { StoreLinks } from '@/components/site/StoreLinks';
import { BLOG_SLUGS, getPost } from '@/lib/site/blog';
import { SITE_URL, absoluteUrl, isLocale, localizedPath } from '@/lib/site/config';
import { getCopy } from '@/lib/site/content';
import { localizedMetadata } from '@/lib/site/metadata';
import { UI_LABELS } from '@/lib/site/uiLabels';

export function generateStaticParams() {
  return BLOG_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const post = getPost(locale, slug);
  if (!post) return {};
  const copy = await getCopy(locale);
  const path = `/blog/${post.slug}`;
  return localizedMetadata({
    locale,
    title: post.title,
    description: post.description,
    path,
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt ?? post.publishedAt,
    authors: ['Vella'],
    rssTitle: copy.blog.title,
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: value, slug } = await params;
  if (!isLocale(value)) notFound();
  const post = getPost(value, slug);
  if (!post) notFound();
  const copy = await getCopy(value);
  const path = `/blog/${post.slug}`;
  const articleUrl = absoluteUrl(value, path);
  const shareMessage = encodeURIComponent(`${post.title} — ${articleUrl}`);
  const shareSubject = encodeURIComponent(post.title);

  return (
    <PageShell locale={value} copy={copy} currentPath={path}>
      <JsonLd data={[
        {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt ?? post.publishedAt,
          articleSection: post.category,
          inLanguage: value,
          mainEntityOfPage: articleUrl,
          author: { '@type': 'Organization', name: 'Vella', url: SITE_URL },
          publisher: { '@type': 'Organization', name: 'Vella', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
          image: `${SITE_URL}/og.png`,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: copy.footer.home, item: absoluteUrl(value) },
            { '@type': 'ListItem', position: 2, name: copy.blog.title, item: absoluteUrl(value, '/blog') },
            { '@type': 'ListItem', position: 3, name: post.title, item: articleUrl },
          ],
        },
      ]} />
      <header className="subpage-hero article-hero">
        <div className="hero-ambient ambient-two"></div>
        <div className="shell subpage-hero-inner article-hero-inner">
          <div className="article-meta"><span>{post.category}</span><span>·</span><span>{post.dateLabel}</span><span>·</span><span>{post.readTime}</span></div>
          <h1>{post.title}</h1>
          <p>{post.description}</p>
        </div>
      </header>
      <article className="article-body">
        <div className="shell article-layout">
          <aside className="article-aside">
            <Link href={localizedPath(value, '/blog')}>← {copy.blog.back}</Link>
            <div className="article-share">
              <p>{copy.blog.share}</p>
              <div className="article-share-links">
                <a href={`https://wa.me/?text=${shareMessage}`} target="_blank" rel="noreferrer" aria-label={`${copy.blog.share}: WhatsApp`}>WhatsApp</a>
                <a href={`mailto:?subject=${shareSubject}&body=${shareMessage}`} aria-label={`${copy.blog.share}: ${UI_LABELS[value].shareByEmail}`}>{UI_LABELS[value].shareByEmail}</a>
              </div>
            </div>
          </aside>
          <div className="article-prose">
            <blockquote className="article-quote">{post.heroQuote}</blockquote>
            {post.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.numberedPractices ? <ol>{section.numberedPractices.map((practice) => <li key={practice}>{practice}</li>)}</ol> : null}
                {section.reflectionPrompts ? (
                  <div className="reflection-box"><ul>{section.reflectionPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul></div>
                ) : null}
              </section>
            ))}
            {post.cta ? (
              <aside className="article-feature-cta">
                <p className="eyebrow">{post.cta.eyebrow}</p>
                <h2>{post.cta.title}</h2>
                <p>{post.cta.body}</p>
                <Link className="button button-dark" href={localizedPath(value, post.cta.path)}>{post.cta.label}<span aria-hidden="true">→</span></Link>
              </aside>
            ) : null}
            <aside className="article-install-cta">
              <p className="eyebrow">{copy.download.contextualEyebrow}</p>
              <h2>{copy.download.contextualTitle}</h2>
              <p>{copy.download.contextualBody}</p>
              <StoreLinks copy={copy.download} compact placement="blog-article" />
            </aside>
          </div>
        </div>
      </article>
    </PageShell>
  );
}
